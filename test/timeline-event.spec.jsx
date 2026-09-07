import React, { act } from 'react'
import { expect } from 'chai'

import TimelineEvent from '../src/timeline-event/index.js'
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

  it('renders an unresolved bash call as the shell row', () => {
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
    // The label is lowercase `bash` and the prompt heads the command, the way
    // base frames a genuine shell row.
    expect(view.text()).to.contain('bash')
    expect(view.text()).to.contain('$ yarn build')
    expect(view.text()).to.not.contain('Bash')
    view.unmount()
  })

  it('keeps the resolved name the consumer supplies for a bash call', () => {
    const view = render(
      <TimelineEvent
        entry={{
          id: 'tc2',
          type: 'tool_call',
          content: {
            tool_name: 'Bash',
            tool_parameters: {
              command: 'yarn scripts/data-view-search-columns.mjs'
            },
            tool_call_id: 'toolu_2',
            execution_status: 'completed'
          },
          ordering: ordering(6)
        }}
        resolve_tool_name={() => 'search_columns'}
      />
    )
    expect(view.text()).to.contain('search_columns')
    expect(view.text()).to.not.contain('bash')
    expect(view.text()).to.not.contain('Bash')
    view.unmount()
  })

  it('opens a completed bash row to reveal its command and result', () => {
    const entry = {
      id: 'tc3',
      type: 'tool_call',
      content: {
        tool_name: 'Bash',
        tool_parameters: { command: 'yarn build' },
        tool_call_id: 'toolu_3',
        execution_status: 'completed'
      },
      ordering: ordering(7)
    }
    const tool_result = {
      id: 'tr3',
      type: 'tool_result',
      content: { tool_call_id: 'toolu_3', result: 'built in 2s' },
      ordering: ordering(8)
    }

    const view = render(
      <TimelineEvent entry={entry} tool_result={tool_result} is_expandable />
    )
    expect(view.text()).to.not.contain('built in 2s')

    const toggle = view.container.querySelector('.rat-event-row-toggle')
    expect(toggle).to.not.equal(null)
    act(() => {
      toggle.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
    })

    expect(view.text()).to.contain('built in 2s')
    // The open state also drives the sticky-header class on the row.
    expect(view.container.querySelector('.rat-event-row-open')).to.not.equal(
      null
    )
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

describe('TimelineEvent long user message', () => {
  // The tail only ever appears past the collapse threshold, which is what makes
  // "it is hidden until opened" an assertion rather than a guess: a collapsed
  // row that kept the whole message would fail it.
  const long_instruction =
    'Build the passing touchdown view. ' + 'x'.repeat(300) + ' INSTRUCTION-TAIL'

  it('collapses a long instruction behind the disclosure and reveals it on open', () => {
    const view = render(
      <TimelineEvent
        entry={{
          id: 'u1',
          type: 'message',
          role: 'user',
          content: long_instruction,
          ordering: ordering(13)
        }}
        is_expandable
      />
    )

    const toggle = view.container.querySelector('.rat-event-row-toggle')
    expect(toggle).to.not.equal(null)
    expect(toggle.title).to.equal(DEFAULT_LABELS.show_details)
    expect(view.text()).to.not.contain('INSTRUCTION-TAIL')
    expect(view.container.querySelector('.rat-event-row-open')).to.equal(null)

    act(() => {
      toggle.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
    })

    expect(view.text()).to.contain('INSTRUCTION-TAIL')
    expect(toggle.title).to.equal(DEFAULT_LABELS.hide_details)
    view.unmount()
  })

  it('leaves a short message fully open with no disclosure', () => {
    const view = render(
      <TimelineEvent
        entry={{
          id: 'u2',
          type: 'message',
          role: 'user',
          content: 'add passing touchdowns',
          ordering: ordering(14)
        }}
        is_expandable
      />
    )
    expect(view.container.querySelector('.rat-event-row-toggle')).to.equal(null)
    expect(view.text()).to.contain('add passing touchdowns')
    view.unmount()
  })
})
