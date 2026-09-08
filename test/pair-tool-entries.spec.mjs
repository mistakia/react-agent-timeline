import { expect } from 'chai'

import {
  latest_row,
  pair_tool_entries
} from '../src/agent-session-timeline/pair-tool-entries.mjs'

const call = (id, tool_call_id) => ({
  id,
  type: 'tool_call',
  content: { tool_name: 'Bash', tool_call_id }
})

const result = (id, tool_call_id, text) => ({
  id,
  type: 'tool_result',
  content: { tool_call_id, result: text }
})

const message = (id) => ({
  id,
  type: 'message',
  role: 'assistant',
  content: id
})

describe('pairing a tool call to its result', () => {
  it('joins on tool_call_id when both sides carry one', () => {
    const rows = pair_tool_entries([
      call('call-a', 'toolu_a'),
      call('call-b', 'toolu_b'),
      result('result-b', 'toolu_b', 'b output'),
      result('result-a', 'toolu_a', 'a output')
    ])

    // The ids cross, so a positional join would pair them the other way round.
    // That is what makes this case prove the id is being read at all.
    expect(rows).to.have.length(2)
    expect(rows[0].entry.id).to.equal('call-a')
    expect(rows[0].tool_result.id).to.equal('result-a')
    expect(rows[1].entry.id).to.equal('call-b')
    expect(rows[1].tool_result.id).to.equal('result-b')
  })

  // The already-published shares. Their projection dropped tool_call_id, so
  // this is the join that has to work on real stored data, not a fallback for
  // malformed input.
  it('joins on position when neither side carries an id', () => {
    const rows = pair_tool_entries([
      call('call-a'),
      result('result-a', undefined, 'a output'),
      call('call-b'),
      result('result-b', undefined, 'b output')
    ])

    expect(rows).to.have.length(2)
    expect(rows[0].tool_result.id).to.equal('result-a')
    expect(rows[1].tool_result.id).to.equal('result-b')
  })

  it('keeps non-tool entries in place and unpaired', () => {
    const rows = pair_tool_entries([
      message('m1'),
      call('call-a', 'toolu_a'),
      result('result-a', 'toolu_a', 'output'),
      message('m2')
    ])

    expect(rows.map((row) => row.entry.id)).to.eql(['m1', 'call-a', 'm2'])
    expect(rows[0].tool_result).to.equal(null)
    expect(rows[2].tool_result).to.equal(null)
  })

  it('leaves a call with no result yet unpaired rather than borrowing one', () => {
    const rows = pair_tool_entries([call('call-a', 'toolu_a')])

    expect(rows).to.have.length(1)
    expect(rows[0].tool_result).to.equal(null)
  })

  // A dropped result is invisible on the surface -- the row still renders, it
  // just has nothing behind its disclosure -- so it needs asserting directly.
  it('emits an orphan result as its own row rather than discarding it', () => {
    const rows = pair_tool_entries([
      result('orphan', 'toolu_missing', 'output nobody called for')
    ])

    expect(rows).to.have.length(1)
    expect(rows[0].entry.id).to.equal('orphan')
  })

  it('does not let one result claim two calls', () => {
    const rows = pair_tool_entries([
      call('call-a', 'toolu_a'),
      call('call-b', 'toolu_b'),
      result('result-a', 'toolu_a', 'output')
    ])

    expect(rows).to.have.length(2)
    expect(rows[0].tool_result.id).to.equal('result-a')
    expect(rows[1].tool_result).to.equal(null)
  })
})

describe('the row the collapsed line shows', () => {
  const spine = (entries) =>
    entries.map((entry, index) => ({
      ...entry,
      ordering: { timeline_index: index, timeline_epoch: 0 }
    }))

  const rows_of = (entries) => pair_tool_entries(spine(entries))

  it('shows the CALL when the newest entry is its result', () => {
    const row = latest_row(
      rows_of([
        message('m1'),
        call('call-a', 'toolu_a'),
        result('result-a', 'toolu_a', 'output')
      ])
    )

    expect(row.entry.id).to.equal('call-a')
    // Carried, not dropped: the row still knows its output, it just does not
    // render it while the line is collapsed.
    expect(row.tool_result.id).to.equal('result-a')
  })

  it('advances to a pair whose result landed after an older message', () => {
    const row = latest_row(
      rows_of([
        call('call-a', 'toolu_a'),
        message('m1'),
        result('result-a', 'toolu_a', 'output')
      ])
    )

    // The call precedes the message, so ordering by the CALL alone would leave
    // the collapsed line on `m1` after the tool returned.
    expect(row.entry.id).to.equal('call-a')
  })

  it('shows a no-argument call rather than skipping to something older', () => {
    const bare_call = {
      id: 'call-bare',
      type: 'tool_call',
      content: { tool_name: 'Bash' }
    }

    const row = latest_row(rows_of([message('m1'), bare_call]))

    expect(row.entry.id).to.equal('call-bare')
  })

  it('still shows an orphan result, which is the only row there is', () => {
    const row = latest_row(rows_of([result('orphan', 'toolu_x', 'output')]))

    expect(row.entry.id).to.equal('orphan')
  })

  it('returns null for an empty timeline', () => {
    expect(latest_row([])).to.equal(null)
    expect(latest_row(null)).to.equal(null)
  })
})
