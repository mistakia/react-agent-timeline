import React, { act } from 'react'
import { expect } from 'chai'

import AgentSessionTimeline from '../src/agent-session-timeline/index.js'
import RunStatus from '../src/agent-session-timeline/run-status.js'
import { DEFAULT_LABELS } from '../src/labels.mjs'
import { render } from './helpers/render.jsx'

const entries = [
  {
    id: 'a',
    type: 'message',
    role: 'assistant',
    content: 'reading the column catalog',
    ordering: { timeline_index: 1, timeline_epoch: 0 }
  },
  {
    id: 'b',
    type: 'tool_call',
    content: { tool_name: 'Bash', tool_parameters: { command: 'ls' } },
    ordering: { timeline_index: 2, timeline_epoch: 0 }
  }
]

describe('a run that is still going', () => {
  it('counts up from the start it was handed, not from mount', async () => {
    // Started well before this component existed, which is the reload case: a
    // counter measuring its own mount would read a fraction of a second here.
    const view = render(
      <RunStatus started_at_ms={Date.now() - 90_000} labels={DEFAULT_LABELS} />
    )

    expect(view.text()).to.contain('1m 30s')
    view.unmount()
  })

  // Sampling once cannot tell a live clock from a frozen one -- both read
  // exactly right at the instant you look.
  it('advances between two readings', async () => {
    const view = render(
      <RunStatus started_at_ms={Date.now() - 1000} labels={DEFAULT_LABELS} />
    )
    const first = view.text()

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 350))
    })

    expect(view.text()).to.not.equal(first)
    view.unmount()
  })

  it('renders the label alone when no start time is known', () => {
    const view = render(<RunStatus labels={DEFAULT_LABELS} />)

    expect(view.text()).to.equal(DEFAULT_LABELS.running)
    view.unmount()
  })

  it('shows the live counter instead of a final duration while running', () => {
    const view = render(
      <AgentSessionTimeline
        entries={entries}
        is_running
        started_at_ms={Date.now() - 5000}
        duration_ms={999_000}
        labels={DEFAULT_LABELS}
      />
    )

    expect(view.text()).to.contain(DEFAULT_LABELS.running)
    // The finished-run duration must not sit beside the moving one.
    expect(view.text()).to.not.contain(DEFAULT_LABELS.duration)
    view.unmount()
  })

  it('shows the final duration once the run is over', () => {
    const view = render(
      <AgentSessionTimeline
        entries={entries}
        duration_ms={12_000}
        labels={DEFAULT_LABELS}
      />
    )

    expect(view.text()).to.contain(DEFAULT_LABELS.duration)
    expect(view.text()).to.contain('12s')
    expect(view.text()).to.not.contain(DEFAULT_LABELS.running)
    view.unmount()
  })

  it('tallies the tool calls it rendered', () => {
    const view = render(
      <AgentSessionTimeline entries={entries} labels={DEFAULT_LABELS} />
    )

    expect(view.text()).to.contain(`1 ${DEFAULT_LABELS.tool_call_one}`)
    view.unmount()
  })
})
