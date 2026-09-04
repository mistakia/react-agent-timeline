import React from 'react'
import { expect } from 'chai'

import TimelineEvent from '../src/timeline-event/index.jsx'
import { DEFAULT_LABELS } from '../src/labels.mjs'
import { render } from './helpers/render.jsx'

const ordering = (index) => ({ timeline_index: index, timeline_epoch: 0 })

describe('TimelineEvent per-type rendering', () => {
  it('renders an assistant message content', () => {
    const view = render(
      <TimelineEvent
        entry={{
          id: 'a',
          type: 'message',
          role: 'assistant',
          content: 'checked how that stat is measured',
          ordering: ordering(1)
        }}
      />
    )
    expect(view.text()).to.contain('checked how that stat is measured')
    expect(view.text()).to.contain(DEFAULT_LABELS.assistant)
    view.unmount()
  })

  it('renders a user message content', () => {
    const view = render(
      <TimelineEvent
        entry={{
          id: 'u',
          type: 'message',
          role: 'user',
          content: 'add passing touchdowns',
          ordering: ordering(2)
        }}
      />
    )
    expect(view.text()).to.contain('add passing touchdowns')
    view.unmount()
  })

  it('renders a thinking entry content', () => {
    const view = render(
      <TimelineEvent
        entry={{
          id: 't',
          type: 'thinking',
          thinking_type: 'reasoning',
          content: 'weighing two joins',
          ordering: ordering(3)
        }}
      />
    )
    expect(view.text()).to.contain('weighing two joins')
    expect(view.text()).to.contain(DEFAULT_LABELS.thinking)
    view.unmount()
  })

  it('renders a system entry content', () => {
    const view = render(
      <TimelineEvent
        entry={{
          id: 's',
          type: 'system',
          system_type: 'status',
          content: 'session resumed',
          ordering: ordering(4)
        }}
      />
    )
    expect(view.text()).to.contain('session resumed')
    view.unmount()
  })

  it('renders a tool_call by its tool name', () => {
    const view = render(
      <TimelineEvent
        entry={{
          id: 'tc',
          type: 'tool_call',
          content: {
            tool_name: 'Bash',
            tool_parameters: { command: 'yarn build' },
            tool_call_id: 'toolu_1',
            execution_status: 'completed'
          },
          ordering: ordering(5)
        }}
      />
    )
    expect(view.text()).to.contain('Bash')
    expect(view.text()).to.contain('yarn build')
    view.unmount()
  })

  it('renders a successful tool_result by its result', () => {
    const view = render(
      <TimelineEvent
        entry={{
          id: 'tr',
          type: 'tool_result',
          content: {
            tool_call_id: 'toolu_1',
            result: 'build succeeded',
            error: null
          },
          ordering: ordering(6)
        }}
      />
    )
    expect(view.text()).to.contain('build succeeded')
    expect(view.text()).to.contain(DEFAULT_LABELS.tool_result)
    view.unmount()
  })

  // A failing tool that renders like a succeeding one is what let a run spend
  // six minutes retrying behind a static progress line.
  it('renders a failed tool_result through the error branch', () => {
    const view = render(
      <TimelineEvent
        entry={{
          id: 'te',
          type: 'tool_result',
          content: {
            tool_call_id: 'toolu_2',
            result: null,
            error: 'column does not exist'
          },
          ordering: ordering(7)
        }}
      />
    )
    expect(view.text()).to.contain('column does not exist')
    expect(view.text()).to.contain(DEFAULT_LABELS.tool_error)
    expect(
      view.container.querySelector('.rat-event-row-tool-error')
    ).to.not.equal(null)
    view.unmount()
  })
})

describe('TimelineEvent fallback', () => {
  // The control that proves the fallback is reachable rather than dead code.
  it('renders an unknown type generically and does not throw', () => {
    const view = render(
      <TimelineEvent
        entry={{
          id: 'x',
          type: 'a_type_this_package_has_never_heard_of',
          content: 'still legible',
          ordering: ordering(8)
        }}
      />
    )
    expect(view.text()).to.contain('still legible')
    expect(view.text()).to.contain('a_type_this_package_has_never_heard_of')
    expect(view.container.querySelector('.rat-event-row-generic')).to.not.equal(
      null
    )
    view.unmount()
  })

  it('renders an entry with no type at all', () => {
    const view = render(
      <TimelineEvent entry={{ id: 'y', content: 'orphan' }} />
    )
    expect(view.text()).to.contain('orphan')
    view.unmount()
  })
})

describe('TimelineEvent degraded shapes', () => {
  it('renders an elided entry as a visible affordance, never as blank', () => {
    const placeholder =
      '[Attachment elided: document (application/pdf), 24.1 MB. Open this entry to load the full content.]'
    const view = render(
      <TimelineEvent
        entry={{
          id: 'e',
          type: 'message',
          role: 'user',
          content: placeholder,
          content_elided: true,
          ordering: ordering(9)
        }}
      />
    )
    expect(view.text()).to.contain('Attachment elided')
    expect(view.container.querySelector('.rat-event-elided')).to.not.equal(null)
    view.unmount()
  })

  it('falls back to a label when an elided entry carries no placeholder text', () => {
    const view = render(
      <TimelineEvent
        entry={{
          id: 'e2',
          type: 'message',
          role: 'user',
          content: '',
          content_elided: true,
          ordering: ordering(10)
        }}
      />
    )
    expect(view.text()).to.contain(DEFAULT_LABELS.elided)
    view.unmount()
  })

  // The load-bearing one. A masked read has correct structure, correct types,
  // correct ordering and correct counts, so rendering the mask as content is
  // how a permission failure comes to look like a quiet run.
  it('renders a redacted entry as masked rather than as its content', () => {
    const view = render(
      <TimelineEvent
        entry={{
          id: 'r',
          type: 'message',
          role: 'assistant',
          content: '****************',
          is_redacted: true,
          ordering: ordering(11)
        }}
      />
    )
    expect(view.text()).to.contain(DEFAULT_LABELS.redacted)
    expect(view.text()).to.not.contain('****************')
    expect(
      view.container.querySelector('.rat-event-row-redacted')
    ).to.not.equal(null)
    view.unmount()
  })
})

describe('TimelineEvent labels', () => {
  it('takes every consumer-facing word from the labels prop', () => {
    const view = render(
      <TimelineEvent
        entry={{
          id: 'l',
          type: 'message',
          role: 'assistant',
          content: 'body',
          ordering: ordering(12)
        }}
        labels={{ assistant: 'Generator' }}
      />
    )
    expect(view.text()).to.contain('Generator')
    expect(view.text()).to.not.contain(DEFAULT_LABELS.assistant)
    view.unmount()
  })
})
