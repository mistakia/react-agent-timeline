import fs from 'fs'

import React, { act } from 'react'
import { expect } from 'chai'

import AgentSessionTimeline from '../src/agent-session-timeline/index.js'
import TimelineEvent from '../src/timeline-event/index.js'
import { entry_kind, is_noise_system_entry } from '../src/entry-shape.mjs'
import { has_display_content } from '../src/agent-session-timeline/order-entries.mjs'
import { render } from './helpers/render.jsx'

// The package rendered against the SHAPE of a real run, not against a fixture
// hand-written from the schema -- a hand-written one can agree with a wrong
// reading of the schema and prove nothing.
//
// Provenance: a league data-view generation thread's timeline.jsonl, produced
// after the reconciler fix landed on 2026-09-04. Every structural field is
// verbatim from that run -- type, role, system_type, thinking_type, the
// ordering spine, the tool_call and tool_result content shapes, and crucially
// which entries have empty content. Free text is neutralized because this
// repository is public and the run's text carried container paths; emptiness is
// preserved exactly, since that is the property the collapsed-row rule turns
// on.
//
// A fixture cannot verify a type it does not contain, so the exercised set is
// asserted below rather than assumed.

const entries = fs
  .readFileSync('test/fixtures/generation-timeline.jsonl', 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((line) => JSON.parse(line))

const body_text = (container) => {
  const body = container.querySelector('.rat-event-body')
  return ((body && body.textContent) || '').trim()
}

describe('a real generation timeline', function () {
  it('exercises five of the six entry kinds', function () {
    const kinds = new Set(entries.map(entry_kind))

    // Named explicitly so that a fixture which silently stops covering a kind
    // fails here rather than quietly narrowing what this spec proves.
    expect([...kinds].sort()).to.eql([
      'assistant_message',
      'system',
      'thinking',
      'tool_call',
      'tool_result',
      'user_message'
    ])
    // The generic fallback is NOT exercised by real data, by definition -- it
    // exists for a type this package has not seen. test/timeline-event.spec.jsx
    // covers it with a fabricated type.
  })

  it('renders every entry that has content, with its content', function () {
    const blank = []

    for (const entry of entries) {
      if (!has_display_content(entry)) continue
      const view = render(<TimelineEvent entry={entry} />)
      if (!body_text(view.container))
        blank.push({ id: entry.id, type: entry.type })
      view.unmount()
    }

    expect(blank).to.eql([])
  })

  it('has contentless entries, so the case below is real and not hypothetical', function () {
    const contentless = entries.filter((entry) => !has_display_content(entry))

    expect(contentless.length).to.be.greaterThan(0)
    // The run ENDED on them, which is what made this a defect rather than a
    // curiosity: the collapsed row is the surface a user watches.
    expect(has_display_content(entries[entries.length - 1])).to.equal(false)
  })

  // The defect this fixture caught. Before the fix, the collapsed row rendered
  // the word "System" and an empty body, because the two highest-ordered
  // entries of a successful run are contentless system/status records.
  it('collapses to the latest entry that actually says something', function () {
    const view = render(<AgentSessionTimeline entries={entries} />)

    expect(body_text(view.container)).to.not.equal('')
    view.unmount()
  })

  // Two entries become one row where a result was folded into its call, and a
  // noise entry becomes none. Everything else is still one for one, and the
  // expected count is DERIVED from the fixture rather than written down, so a
  // change that starts dropping content fails here instead of moving a
  // hard-coded number to match itself.
  it('expands to one row per entry, folding results and dropping only noise', function () {
    const view = render(<AgentSessionTimeline is_expanded entries={entries} />)

    const results = entries.filter((entry) => entry.type === 'tool_result')
    const noise = entries.filter(is_noise_system_entry)
    const expected = entries.length - results.length - noise.length

    // Both adjustments have to be real, or this assertion is just
    // `entries.length` wearing a disguise.
    expect(results.length).to.be.greaterThan(0)
    expect(noise.length).to.be.greaterThan(0)

    expect(view.container.querySelectorAll('.rat-event-row')).to.have.length(
      expected
    )
    view.unmount()
  })

  it('names the tool in its own element, apart from the argument', function () {
    const tool_calls = entries.filter((entry) => entry.type === 'tool_call')
    expect(tool_calls.length).to.be.greaterThan(0)

    for (const entry of tool_calls) {
      const view = render(<TimelineEvent entry={entry} />)

      const name = view.container.querySelector('.rat-tool-name')
      expect(name, entry.id).to.not.equal(null)
      // Every fixture call is `Bash`, and an unresolved bash call carries the
      // shell's lowercase label rather than the recorded spelling.
      const expected =
        entry.content.tool_name === 'Bash' ? 'bash' : entry.content.tool_name
      expect(name.textContent).to.equal(expected)

      // The name is no longer mashed into the body -- that separation is the
      // point of the chip, so assert the body does NOT carry it back.
      expect(body_text(view.container)).to.not.contain(entry.content.tool_name)
      // And a shell row heads its command with the prompt, the base shape this
      // presentation copies.
      expect(body_text(view.container)).to.match(/^\$\s/)
      view.unmount()
    }
  })

  it('hides a tool result until its row is opened', function () {
    const call = entries.find((entry) => entry.type === 'tool_call')
    const result = entries.find(
      (entry) =>
        entry.type === 'tool_result' &&
        entry.ordering.timeline_index > call.ordering.timeline_index
    )
    const result_text = result.content.result
    expect(result_text).to.be.a('string').and.not.equal('')

    const view = render(
      <AgentSessionTimeline is_expanded entries={[call, result]} />
    )

    expect(view.container.textContent).to.not.contain(result_text)

    const toggle = view.container.querySelector('.rat-event-row-toggle')
    expect(toggle, 'the paired row offers no disclosure').to.not.equal(null)
    act(() => {
      toggle.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
    })

    expect(view.container.textContent).to.contain(result_text)
    view.unmount()
  })
})
