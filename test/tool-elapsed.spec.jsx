import React from 'react'
import { expect } from 'chai'

import TimelineEvent from '../src/timeline-event/index.js'
import { tool_elapsed_ms } from '../src/entry-shape.mjs'
import { render } from './helpers/render.jsx'

const ordering = (index) => ({ timeline_index: index, timeline_epoch: 0 })

const call = (timestamp) => ({
  id: 'call',
  timestamp,
  type: 'tool_call',
  content: {
    tool_name: 'Bash',
    tool_call_id: 'call-1',
    tool_parameters: { command: 'node scripts/thing.mjs' }
  },
  ordering: ordering(1)
})

const result = (timestamp) => ({
  id: 'result',
  timestamp,
  type: 'tool_result',
  content: { tool_call_id: 'call-1', result: 'done' },
  ordering: ordering(2)
})

describe('tool_elapsed_ms', () => {
  it('measures a call from its own instant to its result', () => {
    expect(
      tool_elapsed_ms(
        call('2026-09-04T20:22:18.000Z'),
        result('2026-09-04T20:22:41.000Z')
      )
    ).to.equal(23000)
  })

  // The threshold, and the control for it. Nearly every call returns in about a
  // second; a number on those rows is the noise this reading exists to cut
  // through, not the reading.
  it('reports nothing for a call fast enough to be unremarkable', () => {
    expect(
      tool_elapsed_ms(
        call('2026-09-04T20:22:18.000Z'),
        result('2026-09-04T20:22:19.100Z')
      )
    ).to.equal(null)
  })

  it('reports nothing for a call still in flight', () => {
    expect(tool_elapsed_ms(call('2026-09-04T20:22:18.000Z'), null)).to.equal(
      null
    )
  })

  // A result recorded before its call is not a negative duration, it is an
  // unusable pair. Reporting it would print a minus sign on the surface.
  it('reports nothing when the two instants are out of order', () => {
    expect(
      tool_elapsed_ms(
        call('2026-09-04T20:22:41.000Z'),
        result('2026-09-04T20:22:18.000Z')
      )
    ).to.equal(null)
  })

  it('reports nothing when a timestamp is missing or unparseable', () => {
    expect(tool_elapsed_ms(call(undefined), result('bad'))).to.equal(null)
  })
})

describe('a slow tool call says so on its own row', () => {
  it('renders the elapsed time beside the row', () => {
    const view = render(
      <TimelineEvent
        entry={call('2026-09-04T20:22:18.000Z')}
        tool_result={result('2026-09-04T20:22:41.000Z')}
        is_expandable
      />
    )

    expect(
      view.container.querySelector('.rat-event-meta').textContent
    ).to.equal('23s')
    view.unmount()
  })

  // The control. The same row, a fast call, and the element is not merely empty
  // — it is absent, which is what keeps the row from reserving space for it.
  it('renders no meta element at all on a fast call', () => {
    const view = render(
      <TimelineEvent
        entry={call('2026-09-04T20:22:18.000Z')}
        tool_result={result('2026-09-04T20:22:19.100Z')}
        is_expandable
      />
    )

    expect(view.container.querySelector('.rat-event-meta')).to.equal(null)
    view.unmount()
  })

  // The number must survive the clamp that shortens the body. A duration cut in
  // half is a wrong number rather than a shortened one.
  it('keeps the number out of the clamped body', () => {
    const view = render(
      <TimelineEvent
        entry={call('2026-09-04T20:22:18.000Z')}
        tool_result={result('2026-09-04T20:22:41.000Z')}
        is_expandable
      />
    )

    expect(
      view.container.querySelector('.rat-event-body').textContent
    ).to.not.contain('23s')
    view.unmount()
  })
})
