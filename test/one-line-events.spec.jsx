import React, { act } from 'react'
import { expect } from 'chai'

import AgentSessionTimeline from '../src/agent-session-timeline/index.js'
import TimelineEvent from '../src/timeline-event/index.js'
import { DEFAULT_LABELS } from '../src/labels.mjs'
import { render } from './helpers/render.jsx'

// Every entry in the expanded list is one line, and the assistant message is
// the one exception.
//
// The defect: a reasoning entry is routinely twenty lines and a run holds
// dozens of them, so unclamped they filled the panel end to end and the tool
// calls between them could not be reached without scrolling past the agent's
// deliberation. Measured on a real generation share, where four thinking
// entries occupied the whole expanded panel.

const ordering = (index) => ({ timeline_index: index, timeline_epoch: 0 })

// Long enough to clear the collapse threshold, and carrying a tail that exists
// nowhere in the clamped prefix -- so "hidden until opened" is an assertion
// about what is rendered rather than a guess.
const long_prose = (tail) =>
  `The request needs two joins and the second one is the expensive half. ${'x'.repeat(
    200
  )} ${tail}`

const body_text = (container) =>
  ((container.querySelector('.rat-event-body') || {}).textContent || '').trim()

describe('expanded events are one line', () => {
  // The reported defect, stated as the type it was reported against.
  it('clamps a thinking entry and reveals the whole of it on open', () => {
    const view = render(
      <TimelineEvent
        entry={{
          id: 'th',
          type: 'thinking',
          content: long_prose('THINKING-TAIL'),
          ordering: ordering(1)
        }}
        is_expandable
      />
    )

    expect(view.text()).to.not.contain('THINKING-TAIL')

    const toggle = view.container.querySelector('.rat-event-row-toggle')
    expect(toggle).to.not.equal(null)
    act(() => {
      toggle.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
    })

    expect(view.text()).to.contain('THINKING-TAIL')
    view.unmount()
  })

  it('clamps a system entry the same way', () => {
    const view = render(
      <TimelineEvent
        entry={{
          id: 'sy',
          type: 'system',
          content: long_prose('SYSTEM-TAIL'),
          ordering: ordering(2)
        }}
        is_expandable
      />
    )
    expect(view.text()).to.not.contain('SYSTEM-TAIL')
    view.unmount()
  })

  it('clamps an unknown type through the same fallback', () => {
    const view = render(
      <TimelineEvent
        entry={{
          id: 'ge',
          type: 'a_type_this_package_has_never_heard_of',
          content: long_prose('GENERIC-TAIL'),
          ordering: ordering(3)
        }}
        is_expandable
      />
    )
    expect(view.text()).to.not.contain('GENERIC-TAIL')
    view.unmount()
  })

  // A multi-line message that is SHORT is still not on one line, so shape has
  // to open the row as well as length. Without this the check above passes on a
  // threshold alone and a three-line note renders as three lines.
  it('offers the disclosure for a short entry that carries newlines', () => {
    const view = render(
      <TimelineEvent
        entry={{
          id: 'nl',
          type: 'thinking',
          content: 'first line\nsecond line\nMULTILINE-TAIL',
          ordering: ordering(4)
        }}
        is_expandable
      />
    )

    expect(body_text(view.container)).to.equal(
      'first line second line MULTILINE-TAIL'
    )
    expect(view.container.querySelector('.rat-event-row-toggle')).to.not.equal(
      null
    )
    view.unmount()
  })

  // The control. A rule that clamped everything would pass every assertion
  // above and still be wrong, because the agent's own words are what a reader
  // opened the run to read.
  it('leaves an assistant message whole, with no disclosure', () => {
    const view = render(
      <TimelineEvent
        entry={{
          id: 'as',
          type: 'message',
          role: 'assistant',
          content: long_prose('ASSISTANT-TAIL'),
          ordering: ordering(5)
        }}
        is_expandable
      />
    )

    expect(view.text()).to.contain('ASSISTANT-TAIL')
    expect(view.container.querySelector('.rat-event-row-toggle')).to.equal(null)
    view.unmount()
  })
})

describe('the collapsed surface names what it shows', () => {
  const entries = [
    {
      id: 'a',
      type: 'message',
      role: 'assistant',
      content: 'first step',
      ordering: ordering(1)
    },
    {
      id: 'b',
      type: 'message',
      role: 'assistant',
      content: 'second step',
      ordering: ordering(2)
    }
  ]

  it('captions the collapsed row as the latest event', () => {
    const view = render(<AgentSessionTimeline entries={entries} />)

    const caption = view.container.querySelector('.rat-timeline-latest')
    expect(caption).to.not.equal(null)
    expect(caption.textContent).to.equal(DEFAULT_LABELS.latest)
    view.unmount()
  })

  it('drops the caption when the whole run is on screen', () => {
    const view = render(<AgentSessionTimeline is_expanded entries={entries} />)
    expect(view.container.querySelector('.rat-timeline-latest')).to.equal(null)
    view.unmount()
  })

  // A caption over nothing would announce a latest event that is not there.
  it('drops the caption when there is no entry to introduce', () => {
    const view = render(<AgentSessionTimeline entries={[]} />)
    expect(view.container.querySelector('.rat-timeline-latest')).to.equal(null)
    expect(view.text()).to.contain(DEFAULT_LABELS.empty)
    view.unmount()
  })

  it('takes the caption word from the labels prop', () => {
    const view = render(
      <AgentSessionTimeline entries={entries} labels={{ latest: 'Now' }} />
    )
    expect(
      view.container.querySelector('.rat-timeline-latest').textContent
    ).to.equal('Now')
    view.unmount()
  })

  // The expand control has to read as a control. Its state is on the element
  // rather than only in its word, which is what the stylesheet's glyph and any
  // assistive technology both read.
  it('reports its expansion state on the toggle itself', () => {
    const view = render(
      <AgentSessionTimeline entries={entries} on_toggle_expanded={() => {}} />
    )
    expect(
      view.container
        .querySelector('.rat-timeline-toggle')
        .getAttribute('aria-expanded')
    ).to.equal('false')
    view.unmount()

    const open = render(
      <AgentSessionTimeline
        is_expanded
        entries={entries}
        on_toggle_expanded={() => {}}
      />
    )
    expect(
      open.container
        .querySelector('.rat-timeline-toggle')
        .getAttribute('aria-expanded')
    ).to.equal('true')
    open.unmount()
  })
})

describe('an entry with nothing in it', () => {
  const said = {
    id: 'said',
    type: 'message',
    role: 'assistant',
    content: 'searching the catalog',
    ordering: ordering(1)
  }
  // What every message whose whole content was a tool use looks like. It used
  // to render as the word ASSISTANT over a blank line, which says something
  // happened and nothing about what.
  const silent = {
    id: 'silent',
    type: 'message',
    role: 'assistant',
    content: '',
    ordering: ordering(2)
  }

  it('gets no row in the expanded list', () => {
    const view = render(
      <AgentSessionTimeline is_expanded entries={[said, silent]} />
    )
    expect(view.container.querySelectorAll('.rat-event-row')).to.have.length(1)
    expect(view.text()).to.contain('searching the catalog')
    view.unmount()
  })

  // The control. A filter that dropped rows on some other property would pass
  // the assertion above and take the run with it.
  it('is the only row dropped, and a spoken one stays', () => {
    const view = render(
      <AgentSessionTimeline
        is_expanded
        entries={[said, { ...silent, content: 'and now the answer' }]}
      />
    )
    expect(view.container.querySelectorAll('.rat-event-row')).to.have.length(2)
    view.unmount()
  })

  // A tool call is never silent: the tool's NAME is that row's content, so a
  // no-argument call must survive a filter written against entry text.
  it('keeps a tool call that carried no argument', () => {
    const view = render(
      <AgentSessionTimeline
        is_expanded
        entries={[
          said,
          {
            id: 'bare',
            type: 'tool_call',
            content: { tool_name: 'list_views', tool_parameters: {} },
            ordering: ordering(3)
          }
        ]}
      />
    )
    expect(view.container.querySelectorAll('.rat-event-row')).to.have.length(2)
    expect(view.text()).to.contain('list_views')
    view.unmount()
  })
})
