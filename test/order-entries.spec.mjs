import { expect } from 'chai'

import {
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
