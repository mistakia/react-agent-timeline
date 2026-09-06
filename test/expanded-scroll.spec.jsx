import React, { act } from 'react'
import { expect } from 'chai'

import AgentSessionTimeline from '../src/agent-session-timeline/index.js'
import { DEFAULT_LABELS } from '../src/labels.mjs'
import { render } from './helpers/render.jsx'

// The expanded view reads bottom-up like a message thread, and the failure that
// makes such a view unusable is the naive one: scrolling to the bottom on every
// new entry, which yanks a reader who scrolled up back down mid-sentence.
//
// The DOM here reports no layout, so overflow has to be imposed rather than
// produced -- a test that let happy-dom answer would see scrollHeight 0, read
// "nothing to scroll", and pass whatever the rule did.

const message = (index, content) => ({
  id: `m-${index}`,
  type: 'message',
  role: 'assistant',
  content,
  ordering: { timeline_index: index, timeline_epoch: 0 }
})

const entries_through = (count) =>
  Array.from({ length: count }, (unused, index) =>
    message(index, `step ${index}`)
  )

// Give the scroll container a viewport it overflows, with a scrollTop that
// actually holds what is written to it. Both are inert in happy-dom otherwise.
const impose_overflow = (element, { client_height = 200 } = {}) => {
  let scroll_top = 0
  Object.defineProperty(element, 'clientHeight', { get: () => client_height })
  Object.defineProperty(element, 'scrollHeight', {
    get: () => client_height + 800
  })
  Object.defineProperty(element, 'scrollTop', {
    get: () => scroll_top,
    set: (next) => {
      scroll_top = next
    }
  })
  return element
}

const scroll_container_of = (view) =>
  view.container.querySelector('.rat-timeline-entries')

const scroll_to = (element, scroll_top) => {
  act(() => {
    element.scrollTop = scroll_top
    element.dispatchEvent(new window.Event('scroll'))
  })
}

const expanded = (entries) => (
  <AgentSessionTimeline
    entries={entries}
    is_expanded
    on_toggle_expanded={() => {}}
  />
)

describe('AgentSessionTimeline expanded scrolling', () => {
  it('opens at the newest entry rather than the oldest', () => {
    const view = render(expanded(entries_through(40)))
    const element = impose_overflow(scroll_container_of(view))

    // Re-render so the mount effects run against the imposed geometry.
    view.rerender(expanded(entries_through(41)))

    expect(element.scrollTop).to.equal(element.scrollHeight)
    view.unmount()
  })

  it('follows new entries while the reader is at the bottom', () => {
    const view = render(expanded(entries_through(10)))
    const element = impose_overflow(scroll_container_of(view))
    view.rerender(expanded(entries_through(11)))

    scroll_to(element, element.scrollHeight)
    element.scrollTop = 0

    view.rerender(expanded(entries_through(12)))

    expect(element.scrollTop).to.equal(element.scrollHeight)
    view.unmount()
  })

  // The case a naive implementation fails.
  it('does not move a reader who scrolled away when entries arrive', () => {
    const view = render(expanded(entries_through(10)))
    const element = impose_overflow(scroll_container_of(view))
    view.rerender(expanded(entries_through(11)))

    scroll_to(element, 120)
    view.rerender(expanded(entries_through(12)))

    expect(element.scrollTop).to.equal(120)
    view.unmount()
  })

  it('offers a jump control only once the reader has scrolled away', () => {
    const view = render(expanded(entries_through(10)))
    const element = impose_overflow(scroll_container_of(view))
    view.rerender(expanded(entries_through(11)))

    expect(view.container.querySelector('.rat-timeline-jump')).to.equal(null)

    scroll_to(element, 120)
    const jump = view.container.querySelector('.rat-timeline-jump')
    expect(jump).to.not.equal(null)
    expect(jump.textContent).to.equal(DEFAULT_LABELS.jump_to_latest)
    view.unmount()
  })

  it('re-engages the pin when the reader scrolls back to the bottom', () => {
    const view = render(expanded(entries_through(10)))
    const element = impose_overflow(scroll_container_of(view))
    view.rerender(expanded(entries_through(11)))

    scroll_to(element, 120)
    scroll_to(element, element.scrollHeight)

    expect(view.container.querySelector('.rat-timeline-jump')).to.equal(null)

    element.scrollTop = 0
    view.rerender(expanded(entries_through(12)))
    expect(element.scrollTop).to.equal(element.scrollHeight)
    view.unmount()
  })

  it('pins again when the reader collapses and re-expands', () => {
    const view = render(expanded(entries_through(10)))
    const element = impose_overflow(scroll_container_of(view))
    view.rerender(expanded(entries_through(11)))

    scroll_to(element, 120)
    expect(view.container.querySelector('.rat-timeline-jump')).to.not.equal(
      null
    )

    view.rerender(
      <AgentSessionTimeline
        entries={entries_through(11)}
        on_toggle_expanded={() => {}}
      />
    )
    view.rerender(expanded(entries_through(11)))

    expect(view.container.querySelector('.rat-timeline-jump')).to.equal(null)
    view.unmount()
  })
})

describe('AgentSessionTimeline duration', () => {
  it('renders a duration it is handed', () => {
    const view = render(
      <AgentSessionTimeline
        entries={[message(1, 'done')]}
        duration_ms={72_000}
      />
    )

    expect(view.text()).to.contain('Took 1m 12s')
    view.unmount()
  })

  it('renders no duration when it was handed none', () => {
    const view = render(<AgentSessionTimeline entries={[message(1, 'done')]} />)

    expect(view.container.querySelector('.rat-timeline-duration')).to.equal(
      null
    )
    view.unmount()
  })

  it('takes the surrounding word from the consumer', () => {
    const view = render(
      <AgentSessionTimeline
        entries={[message(1, 'done')]}
        duration_ms={5000}
        labels={{ duration: 'Built in' }}
      />
    )

    expect(view.text()).to.contain('Built in 5s')
    view.unmount()
  })
})
