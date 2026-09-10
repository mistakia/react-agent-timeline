import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import { expect } from 'chai'
import stylus from 'stylus'

// The CSS half of the floating jump control -- see floating-jump.spec.jsx for
// the DOM half and for what the two together are protecting.
//
// Asserted on emitted CSS rather than on a rendered tree: the suite runs under
// happy-dom, which applies no stylesheets and has no layout engine, so a
// computed-style assertion would pass whether the rule is present or not.

describe('the jump-to-latest stylesheet', () => {
  const file = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    'src',
    'agent-session-timeline',
    'agent-session-timeline.styl'
  )
  const css = stylus(fs.readFileSync(file, 'utf8'))
    .set('filename', file)
    .render()

  // Every declaration that lands on a selector, not the first rule whose text
  // happens to contain it. The jump control takes half its look from a rule it
  // SHARES with the expand control, and a first-match reader finds that shared
  // rule and reports the control's own positioning missing when it is present.
  const rule_for = (selector) => {
    const bodies = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)]
      .filter((rule) =>
        rule[1]
          .split(',')
          .map((part) => part.trim())
          .includes(selector)
      )
      .map((rule) => rule[2])
    return bodies.length ? bodies.join('') : undefined
  }

  it('takes the control out of flow, so showing it changes no height', () => {
    const jump = rule_for('.rat-timeline-jump')
    expect(jump).to.be.a('string')
    expect(jump).to.match(/position:\s*absolute/)
    expect(jump).to.not.match(/margin-top/)
  })

  it('centres it over the list, off the bottom edge', () => {
    const jump = rule_for('.rat-timeline-jump')
    expect(jump).to.match(/left:\s*50%/)
    expect(jump).to.match(/transform:\s*translateX\(-50%\)/)
    expect(jump).to.match(/bottom:/)
  })

  it('gives it the positioning context and an opaque ground to sit on', () => {
    expect(rule_for('.rat-timeline-body')).to.match(/position:\s*relative/)
    // --rat-bg is transparent in both consuming surfaces, so a control floating
    // over the list on that token prints the list's text through itself.
    expect(rule_for('.rat-timeline-jump')).to.match(
      /background:\s*var\(--rat-bg-subtle/
    )
  })

  // AN OPAQUE CONTROL FLOATING OVER A LIST HIDES WHATEVER IS UNDER IT, and the
  // list is what has to give the ground. Measured on production before this
  // rule: the entries list carried `padding-bottom: 0`, so the control parked
  // on the bottom 8px of the last visible row and that row was unreadable for
  // as long as the reader was scrolled up — the one state the control exists
  // to serve.
  it('reserves ground under the last entry so the control covers no row', () => {
    const entries = rule_for('.rat-timeline-expanded .rat-timeline-entries')
    expect(entries).to.be.a('string')
    expect(entries).to.match(/padding-bottom:\s*var\(--rat-jump-clearance/)
  })

  // The control for the check above: the reserve is real ground and not a zero.
  it('would see a zero reserve as a failure', () => {
    const tokens = fs.readFileSync(
      path.join(path.dirname(file), '..', 'styles', 'tokens.styl'),
      'utf8'
    )
    const fallback = tokens.match(/--rat-jump-clearance,\s*(\d+)px/)?.[1]
    expect(Number(fallback)).to.be.greaterThan(24)
  })

  // The control for the three checks above: the reader finds real rules in this
  // stylesheet, and it can tell an absent declaration from an absent rule.
  it('would see the declarations if they were missing', () => {
    expect(rule_for('.rat-timeline-entries')).to.be.a('string')
    expect(rule_for('.rat-timeline-entries')).to.not.match(/position:/)
    expect(rule_for('.rat-timeline-no-such-rule')).to.equal(undefined)
  })
})
