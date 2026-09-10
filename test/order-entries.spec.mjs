import { expect } from 'chai'

import {
  drop_repeated_system_entries,
  is_latest_event_advance,
  latest_entry,
  order_entries
} from '../src/agent-session-timeline/order-entries.mjs'

const entry = ({ index, epoch = 0, id, timestamp } = {}) => ({
  id: id ?? `entry-${index ?? 'x'}-${epoch}`,
  type: 'message',
  role: 'assistant',
  content: `entry ${index}`,
  timestamp,
  ...(index === undefined
    ? {}
    : { ordering: { timeline_index: index, timeline_epoch: epoch } })
})

describe('order_entries', () => {
  it('sorts ascending by timeline_index regardless of arrival order', () => {
    const ordered = order_entries([
      entry({ index: 5 }),
      entry({ index: 1 }),
      entry({ index: 3 })
    ])
    expect(ordered.map((e) => e.ordering.timeline_index)).to.eql([1, 3, 5])
  })

  it('de-duplicates an overlapping backfill and live tail to one row per index', () => {
    const backfill = [
      entry({ index: 1 }),
      entry({ index: 2 }),
      entry({ index: 3 })
    ]
    const live_tail = [entry({ index: 3 }), entry({ index: 4 })]

    const ordered = order_entries([...backfill, ...live_tail])

    expect(ordered.map((e) => e.ordering.timeline_index)).to.eql([1, 2, 3, 4])
  })

  it('keeps entries from different epochs apart rather than collapsing on index', () => {
    const ordered = order_entries([
      entry({ index: 2, epoch: 0 }),
      entry({ index: 2, epoch: 1 })
    ])
    expect(ordered).to.have.length(2)
  })

  it('sorts index-less entries after every stamped entry', () => {
    const optimistic = entry({ id: 'optimistic' })
    const ordered = order_entries([optimistic, entry({ index: 7 })])
    expect(ordered[ordered.length - 1].id).to.equal('optimistic')
  })

  it('returns an empty array for a non-array input', () => {
    expect(order_entries(undefined)).to.eql([])
    expect(order_entries(null)).to.eql([])
  })
})

describe('is_latest_event_advance', () => {
  it('refuses to move backward on index', () => {
    expect(
      is_latest_event_advance(entry({ index: 238 }), entry({ index: 243 }))
    ).to.equal(false)
  })

  it('advances on a higher index', () => {
    expect(
      is_latest_event_advance(entry({ index: 244 }), entry({ index: 243 }))
    ).to.equal(true)
  })

  it('prefers a higher epoch even when the index is lower', () => {
    const re_ranked = entry({ index: 0, epoch: 1 })
    const stale = entry({ index: 500, epoch: 0 })
    expect(is_latest_event_advance(re_ranked, stale)).to.equal(true)
    expect(is_latest_event_advance(stale, re_ranked)).to.equal(false)
  })

  it('falls back to timestamp when either side has no ordering', () => {
    const older = entry({ id: 'older', timestamp: '2026-09-04T10:00:00.000Z' })
    const newer = entry({ id: 'newer', timestamp: '2026-09-04T11:00:00.000Z' })
    expect(is_latest_event_advance(newer, older)).to.equal(true)
    expect(is_latest_event_advance(older, newer)).to.equal(false)
  })

  it('lets anything advance past a null current', () => {
    expect(is_latest_event_advance(entry({ index: 0 }), null)).to.equal(true)
  })
})

describe('latest_entry', () => {
  // The load-bearing case. An in-order fixture passes against BOTH the correct
  // rule and "take the last element", so it cannot tell them apart.
  it('picks the highest-ordered entry, not the last-arrived', () => {
    const out_of_order = [
      entry({ index: 1 }),
      entry({ index: 9 }),
      entry({ index: 4 })
    ]

    const latest = latest_entry(out_of_order)

    expect(latest.ordering.timeline_index).to.equal(9)
    expect(latest).to.not.equal(out_of_order[out_of_order.length - 1])
  })

  it('returns null for an empty timeline', () => {
    expect(latest_entry([])).to.equal(null)
  })
})

describe('drop_repeated_system_entries', () => {
  const system_entry = (id, content) => ({ id, type: 'system', content })

  // The shape measured on a real generation share: twelve system rows in an
  // eighty-four row run, all twelve byte-identical at their full stored length,
  // spread through the run rather than adjacent. A consecutive-only rule would
  // have dropped none of them, which is why the seen-set spans the whole list.
  it('keeps one row per distinct system text, however far apart the repeats', () => {
    const prompt = 'the run context, re-recorded every turn'
    const kept = drop_repeated_system_entries([
      system_entry('a', prompt),
      { id: 'tool', type: 'message', role: 'assistant', content: 'working' },
      system_entry('b', prompt),
      { id: 'think', type: 'message', role: 'assistant', content: 'thinking' },
      system_entry('c', prompt)
    ])

    expect(kept.map((item) => item.id)).to.deep.equal(['a', 'tool', 'think'])
  })

  // The FIRST occurrence survives, so the list still says the context applied
  // and says it at the point it first did.
  it('keeps the first occurrence, not the last', () => {
    const kept = drop_repeated_system_entries([
      system_entry('first', 'same'),
      system_entry('second', 'same')
    ])

    expect(kept).to.have.length(1)
    expect(kept[0].id).to.equal('first')
  })

  // A system block that genuinely CHANGES mid-run is a different string and is
  // a different row. This is the case a naive "drop every system row after the
  // first" would lose, and it is the reason the rule keys on the text.
  it('keeps a system entry whose text differs from the ones before it', () => {
    const kept = drop_repeated_system_entries([
      system_entry('a', 'first context'),
      system_entry('b', 'first context'),
      system_entry('c', 'a reminder injected later')
    ])

    expect(kept.map((item) => item.id)).to.deep.equal(['a', 'c'])
  })

  it('touches nothing that is not a system entry', () => {
    const twice = [
      { id: 'x', type: 'message', role: 'assistant', content: 'same' },
      { id: 'y', type: 'message', role: 'assistant', content: 'same' }
    ]

    expect(drop_repeated_system_entries(twice)).to.have.length(2)
  })

  // The control: the filter is capable of dropping, so the assertions above
  // are not passing because it returns its input untouched.
  it('would drop nothing if the repeats were distinct', () => {
    const distinct = [system_entry('a', 'one'), system_entry('b', 'two')]
    expect(drop_repeated_system_entries(distinct)).to.have.length(2)

    const repeats = [system_entry('a', 'one'), system_entry('b', 'one')]
    expect(drop_repeated_system_entries(repeats)).to.have.length(1)
  })
})
