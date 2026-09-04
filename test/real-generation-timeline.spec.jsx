import fs from 'fs'

import React from 'react'
import { expect } from 'chai'

import AgentSessionTimeline from '../src/agent-session-timeline/index.js'
import TimelineEvent from '../src/timeline-event/index.js'
import { entry_kind } from '../src/entry-shape.mjs'
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

  it('expands to exactly one row per entry, dropping none', function () {
    const view = render(<AgentSessionTimeline is_expanded entries={entries} />)

    expect(view.container.querySelectorAll('.rat-event-row')).to.have.length(
      entries.length
    )
    view.unmount()
  })

  it('renders the tool exchange with its tool names', function () {
    const tool_calls = entries.filter((entry) => entry.type === 'tool_call')
    expect(tool_calls.length).to.be.greaterThan(0)

    for (const entry of tool_calls) {
      const view = render(<TimelineEvent entry={entry} />)
      expect(body_text(view.container)).to.contain(entry.content.tool_name)
      view.unmount()
    }
  })
})
