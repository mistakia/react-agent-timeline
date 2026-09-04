import React from 'react'
import { expect } from 'chai'

import AgentSessionTimeline from '../src/agent-session-timeline/index.js'
import { DEFAULT_LABELS } from '../src/labels.mjs'
import { render } from './helpers/render.jsx'

const message = (index, content) => ({
  id: `m-${index}`,
  type: 'message',
  role: 'assistant',
  content,
  ordering: { timeline_index: index, timeline_epoch: 0 }
})

describe('AgentSessionTimeline collapsed', () => {
  // An in-order fixture cannot distinguish "highest ordered" from "last array
  // element" — both rules pass it. Feeding out of order is what makes this a
  // test rather than a coincidence.
  it('shows the highest-ordered entry, not the last-arrived', () => {
    const view = render(
      <AgentSessionTimeline
        entries={[
          message(1, 'first step'),
          message(9, 'final answer'),
          message(4, 'middle step')
        ]}
      />
    )

    expect(view.text()).to.contain('final answer')
    expect(view.text()).to.not.contain('middle step')
    expect(view.text()).to.not.contain('first step')
    view.unmount()
  })

  it('renders exactly one row when collapsed', () => {
    const view = render(
      <AgentSessionTimeline
        entries={[message(1, 'a'), message(2, 'b'), message(3, 'c')]}
      />
    )
    expect(view.container.querySelectorAll('.rat-event-row')).to.have.length(1)
    view.unmount()
  })

  it('renders the empty label for no entries', () => {
    const view = render(<AgentSessionTimeline entries={[]} />)
    expect(view.text()).to.contain(DEFAULT_LABELS.empty)
    view.unmount()
  })

  it('renders the empty label rather than throwing when entries is absent', () => {
    const view = render(<AgentSessionTimeline />)
    expect(view.text()).to.contain(DEFAULT_LABELS.empty)
    view.unmount()
  })
})

describe('AgentSessionTimeline expanded', () => {
  it('renders every entry in ordering order', () => {
    const view = render(
      <AgentSessionTimeline
        is_expanded
        entries={[
          message(3, 'third'),
          message(1, 'first'),
          message(2, 'second')
        ]}
      />
    )

    const bodies = [...view.container.querySelectorAll('.rat-event-body')].map(
      (node) => node.textContent
    )
    expect(bodies).to.eql(['first', 'second', 'third'])
    view.unmount()
  })

  // A backfill overlapping a live tail is the shape this guards.
  it('renders one row per index when a backfill overlaps a live tail', () => {
    const backfill = [message(1, 'a'), message(2, 'b'), message(3, 'c')]
    const live_tail = [message(3, 'c'), message(4, 'd')]

    const view = render(
      <AgentSessionTimeline is_expanded entries={[...backfill, ...live_tail]} />
    )

    expect(view.container.querySelectorAll('.rat-event-row')).to.have.length(4)
    view.unmount()
  })
})

describe('AgentSessionTimeline expansion control', () => {
  it('calls the toggle handler and takes its word for the current state', () => {
    let calls = 0
    const view = render(
      <AgentSessionTimeline
        entries={[message(1, 'a'), message(2, 'b')]}
        on_toggle_expanded={() => {
          calls += 1
        }}
      />
    )

    const toggle = view.container.querySelector('.rat-timeline-toggle')
    expect(toggle.textContent).to.equal(DEFAULT_LABELS.expand)
    toggle.click()
    expect(calls).to.equal(1)
    view.unmount()
  })

  it('offers no toggle without a handler', () => {
    const view = render(
      <AgentSessionTimeline entries={[message(1, 'a'), message(2, 'b')]} />
    )
    expect(view.container.querySelector('.rat-timeline-toggle')).to.equal(null)
    view.unmount()
  })

  it('offers no toggle when there is nothing more to show', () => {
    const view = render(
      <AgentSessionTimeline
        entries={[message(1, 'a')]}
        on_toggle_expanded={() => {}}
      />
    )
    expect(view.container.querySelector('.rat-timeline-toggle')).to.equal(null)
    view.unmount()
  })
})

describe('AgentSessionTimeline redaction', () => {
  // A fully masked timeline is structurally indistinguishable from a real one,
  // so the collapsed row is where the user finds out.
  it('shows the collapsed row as masked when the latest entry is redacted', () => {
    const view = render(
      <AgentSessionTimeline
        entries={[
          { ...message(1, '****'), is_redacted: true },
          { ...message(2, '********'), is_redacted: true }
        ]}
      />
    )

    expect(view.text()).to.contain(DEFAULT_LABELS.redacted)
    expect(view.text()).to.not.contain('********')
    view.unmount()
  })
})
