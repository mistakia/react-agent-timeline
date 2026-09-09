import React, { act } from 'react'
import { expect } from 'chai'

import AgentSessionTimeline from '../src/agent-session-timeline/index.js'
import { render } from './helpers/render.jsx'

// The jump control floats over the list and takes no height.
//
// THE FAILURE IT FIXES IS A MOVING PANEL. In normal flow the control appeared
// the moment the reader scrolled up and vanished the moment they returned, so
// the host panel grew and shrank by the control's own height under whatever
// they were reading — a control whose whole job is to steady the view was the
// one thing moving it.
//
// Two halves, checked separately because each can be broken without the other:
// the DOM half is that the control is a sibling of the scroll container inside
// a non-scrolling wrapper (inside the scroller it would scroll away with the
// content; outside the wrapper it would float over the footer), and the CSS
// half is that it is taken out of flow. The CSS half lives in
// floating-jump-stylesheet.spec.mjs, asserted on emitted CSS rather than on
// computed style, for the reason event-row-shrink.spec.mjs states at length:
// happy-dom applies no stylesheets and has no layout engine.

const message = (index) => ({
  id: `m-${index}`,
  type: 'message',
  role: 'assistant',
  content: `step ${index}`,
  ordering: { timeline_index: index, timeline_epoch: 0 }
})

const entries_through = (count) =>
  Array.from({ length: count }, (unused, index) => message(index))

const impose_overflow = (element) => {
  let scroll_top = 0
  Object.defineProperty(element, 'clientHeight', { get: () => 200 })
  Object.defineProperty(element, 'scrollHeight', { get: () => 1000 })
  Object.defineProperty(element, 'scrollTop', {
    get: () => scroll_top,
    set: (next) => {
      scroll_top = next
    }
  })
  return element
}

const expanded = (entries) => (
  <AgentSessionTimeline
    entries={entries}
    is_expanded
    on_toggle_expanded={() => {}}
  />
)

const scrolled_away = () => {
  const view = render(expanded(entries_through(10)))
  const scroller = impose_overflow(
    view.container.querySelector('.rat-timeline-entries')
  )
  view.rerender(expanded(entries_through(11)))
  act(() => {
    scroller.scrollTop = 120
    scroller.dispatchEvent(new window.Event('scroll'))
  })
  return { view, scroller }
}

describe('the jump-to-latest control', () => {
  it('hangs off the list wrapper rather than off the scroll container', () => {
    const { view } = scrolled_away()

    const jump = view.container.querySelector('.rat-timeline-jump')
    expect(jump).to.not.equal(null)
    expect(jump.parentElement.className).to.equal('rat-timeline-body')
    expect(
      view.container.querySelector('.rat-timeline-entries .rat-timeline-jump')
    ).to.equal(null)

    view.unmount()
  })

  it('leaves the footer outside the box it floats over', () => {
    const { view } = scrolled_away()

    const body = view.container.querySelector('.rat-timeline-body')
    expect(body.querySelector('.rat-timeline-footer')).to.equal(null)
    expect(view.container.querySelector('.rat-timeline-footer')).to.not.equal(
      null
    )

    view.unmount()
  })

  // The control for both checks above: the markup they read is what the
  // component draws when the reader is AT the bottom, and there is no jump
  // control in it at all — so a test that found one nested wrongly would be
  // finding something real.
  it('draws no jump control at all while the view is pinned', () => {
    const view = render(expanded(entries_through(10)))
    impose_overflow(view.container.querySelector('.rat-timeline-entries'))
    view.rerender(expanded(entries_through(11)))

    expect(view.container.querySelector('.rat-timeline-body')).to.not.equal(
      null
    )
    expect(view.container.querySelector('.rat-timeline-jump')).to.equal(null)

    view.unmount()
  })
})
