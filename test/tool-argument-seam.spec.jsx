import React, { act } from 'react'
import { expect } from 'chai'

import TimelineEvent from '../src/timeline-event/index.js'
import { normalize_tool_fields } from '../src/entry-shape.mjs'
import { render } from './helpers/render.jsx'

// The consumer's answer for what a tool call was about.
//
// The package's own answer is a guess ordered by how identifying a parameter
// usually is, and for an agent whose tools are CLI scripts reached through a
// shell it picks `command` and renders the whole invocation. Only the consumer
// knows its own tools, so `resolve_tool_argument` is where it says — and the
// property that matters is that the row then shows the consumer's fields and
// keeps the raw invocation reachable rather than replacing it.

const ordering = (index) => ({ timeline_index: index, timeline_epoch: 0 })

const shell_call = (command) => ({
  id: 'call',
  type: 'tool_call',
  content: {
    tool_name: 'Bash',
    tool_call_id: 'c1',
    tool_parameters: { command, description: 'search the catalog' }
  },
  ordering: ordering(1)
})

const INVOCATION =
  'echo \'{"query":"fantasy points","grain":"player"}\' | node scripts/search.mjs'

const search_fields = () => [
  { label: 'query', value: 'fantasy points' },
  { label: 'grain', value: 'player' }
]

const expanded_row = (props) => (
  <TimelineEvent entry={shell_call(INVOCATION)} is_expandable {...props} />
)

describe('the tool argument seam', () => {
  it('shows the consumer fields on the row instead of the invocation', () => {
    const view = render(
      expanded_row({
        resolve_tool_name: () => 'search_columns',
        resolve_tool_argument: search_fields
      })
    )

    const body = view.container.querySelector('.rat-event-body')
    expect(body.textContent).to.contain('fantasy points')
    expect(body.textContent).to.contain('player')
    expect(body.textContent).to.contain('query')
    expect(body.textContent).to.not.contain('scripts/search.mjs')

    view.unmount()
  })

  // The control for the check above. Same entry, same row, no seam supplied —
  // and the invocation IS on the row, so the assertion that it is gone is
  // reading a real change rather than an element that never had it.
  it('shows the invocation on the row when the consumer supplies no fields', () => {
    const view = render(
      expanded_row({ resolve_tool_name: () => 'search_columns' })
    )

    const body = view.container.querySelector('.rat-event-body')
    expect(body.textContent).to.contain('scripts/search.mjs')
    // The fields are what the first check reads, so their ABSENCE is what makes
    // this the control for it. The query string is in the invocation either
    // way, and asserting on the text would pass for the wrong reason.
    expect(view.container.querySelector('.rat-tool-fields')).to.equal(null)

    view.unmount()
  })

  // THE FIELDS ARE A READING OF THE CALL, NOT THE CALL. A reader who wants to
  // check that reading against what actually ran has to be able to reach it,
  // which is why the row opens even for an invocation short enough to fit.
  it('keeps the raw invocation reachable behind the disclosure', () => {
    const view = render(
      expanded_row({
        resolve_tool_name: () => 'search_columns',
        resolve_tool_argument: search_fields
      })
    )

    const toggle = view.container.querySelector('.rat-event-row-toggle')
    expect(toggle).to.not.equal(null)
    expect(view.text()).to.not.contain('scripts/search.mjs')

    act(() => toggle.click())
    expect(
      view.container.querySelector('.rat-event-detail').textContent
    ).to.contain('scripts/search.mjs')

    view.unmount()
  })

  // The control for the check above: a short invocation with no fields offers
  // no disclosure at all, so the row opening is caused by the fields rather
  // than by the row being expandable.
  it('offers no disclosure for a short invocation with no fields', () => {
    const view = render(
      expanded_row({ resolve_tool_name: () => 'search_columns' })
    )

    expect(view.container.querySelector('.rat-event-row-toggle')).to.equal(null)

    view.unmount()
  })

  it('falls back to the package reading when the consumer declines', () => {
    const view = render(
      expanded_row({
        resolve_tool_name: () => 'search_columns',
        resolve_tool_argument: () => null
      })
    )

    expect(
      view.container.querySelector('.rat-event-body').textContent
    ).to.contain('scripts/search.mjs')

    view.unmount()
  })

  // THE SEAM IS ASKED FOR THE SURFACE IT RENDERS ON. A call reads differently
  // in the expanded list (a record, where the request is the thing) than on the
  // collapsed status line (where the outcome is the thing), and the consumer is
  // the only side that can tell the two messages apart for its own tools — so
  // the row says which half it is showing and hands over the paired result.
  it('hands the resolver the paired result and the surface it renders on', () => {
    const seen = []
    const tool_result = {
      id: 'result',
      type: 'tool_result',
      content: { tool_call_id: 'c1', result: 'ok' }
    }
    const resolver = (...args) => {
      seen.push(args)
      return search_fields()
    }

    const expanded = render(
      expanded_row({
        resolve_tool_name: () => 'search_columns',
        resolve_tool_argument: resolver,
        tool_result
      })
    )
    expect(seen[0][1]).to.eql({ tool_result, is_collapsed: false })
    expanded.unmount()

    seen.length = 0
    const collapsed = render(
      <TimelineEvent
        entry={shell_call(INVOCATION)}
        tool_result={tool_result}
        resolve_tool_name={() => 'search_columns'}
        resolve_tool_argument={resolver}
      />
    )
    expect(seen[0][1]).to.eql({ tool_result, is_collapsed: true })
    collapsed.unmount()
  })

  // A field the consumer marks failed spends the accent on the value that says
  // so — the one register the accent owns. The control is the untinted field,
  // which must not carry the class.
  it('tints a value the consumer marked as a failure', () => {
    const view = render(
      expanded_row({
        resolve_tool_name: () => 'search_columns',
        resolve_tool_argument: () => [
          { label: 'query', value: 'fantasy points' },
          { value: 'no results', tone: 'error' }
        ]
      })
    )

    const values = [...view.container.querySelectorAll('.rat-tool-field-value')]
    expect(values[0].className).to.not.contain('--error')
    expect(values[1].className).to.contain('rat-tool-field-value--error')
    expect(values[1].textContent).to.equal('no results')

    view.unmount()
  })

  // The disclosure's argument caption says what the block holds. A row the
  // consumer NAMES holds a tool; a row it leaves unresolved holds a shell
  // line, and "Tool" above that would call the shell command what it is not.
  it("names an unresolved bash row's reveal without a tool caption", () => {
    const long_command = `echo '{"query":"${'x'.repeat(140)}"}' | node scripts/search.mjs`
    const view = render(
      <TimelineEvent entry={shell_call(long_command)} is_expandable />
    )

    const toggle = view.container.querySelector('.rat-event-row-toggle')
    expect(toggle).to.not.equal(null)
    act(() => toggle.click())

    const detail = view.container.querySelector('.rat-event-detail')
    expect(detail.textContent).to.contain('scripts/search.mjs')
    expect(detail.querySelector('.rat-tool-caption')).to.equal(null)

    view.unmount()
  })
})

describe('normalize_tool_fields', () => {
  it('keeps labelled and unlabelled fields in the order given', () => {
    expect(
      normalize_tool_fields([
        { label: 'query', value: 'fantasy points' },
        { value: 'SELECT 1' }
      ])
    ).to.eql([
      { label: 'query', value: 'fantasy points' },
      { label: null, value: 'SELECT 1' }
    ])
  })

  it('drops fields with no value, so a partial reading still renders', () => {
    expect(
      normalize_tool_fields([
        { label: 'column', value: 'player_targets' },
        { label: 'params', value: null },
        { label: 'grain', value: '   ' }
      ])
    ).to.eql([{ label: 'column', value: 'player_targets' }])
  })

  // Anything unusable is null rather than an empty render, which is what makes
  // the fallback reachable: an empty field list would blank the row.
  it('returns null for anything that is not a usable field list', () => {
    expect(normalize_tool_fields(null)).to.equal(null)
    expect(normalize_tool_fields([])).to.equal(null)
    expect(normalize_tool_fields([{ value: '' }])).to.equal(null)
    expect(normalize_tool_fields('fantasy points')).to.equal(null)
  })

  it("carries a field's tone, and omits it when a field has none", () => {
    expect(
      normalize_tool_fields([{ label: 'query', value: 'fantasy points' }])
    ).to.eql([{ label: 'query', value: 'fantasy points' }])

    expect(
      normalize_tool_fields([{ label: 'query', value: 'ppr', tone: 'error' }])
    ).to.eql([{ label: 'query', value: 'ppr', tone: 'error' }])

    expect(normalize_tool_fields([{ value: 'hide me', tone: '   ' }])).to.eql([
      { label: null, value: 'hide me' }
    ])
  })
})
