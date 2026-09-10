import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import { expect } from 'chai'
import stylus from 'stylus'

// Asserted on emitted CSS rather than on a rendered tree, for the reason
// test/event-row-shrink.spec.mjs states at length: the suite runs under
// happy-dom, which has no layout engine and applies none of these stylesheets,
// so a computed-style assertion would pass whether the rule is present or not.
describe('the row stylesheet', () => {
  const src = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    'src'
  )
  const emit = (...parts) => {
    const file = path.join(src, ...parts)
    return stylus(fs.readFileSync(file, 'utf8')).set('filename', file).render()
  }

  const row_css = emit('timeline-event', 'timeline-event-row.styl')

  it('clamps the body to one line for every row, not only the collapsed one', () => {
    const body_rule = row_css.match(/\.rat-event-body \{([^}]*)\}/)?.[1]
    expect(body_rule).to.be.a('string')
    expect(body_rule).to.match(/white-space:\s*nowrap/)
    expect(body_rule).to.match(/text-overflow:\s*ellipsis/)
  })

  it('lets the assistant body out of that clamp inside the expanded list', () => {
    const assistant_css = emit(
      'timeline-event',
      'assistant-message',
      'assistant-message.styl'
    )
    expect(assistant_css).to.match(
      /\.rat-timeline-expanded \.rat-event-row-assistant-message \.rat-event-body \{[^}]*white-space:\s*pre-wrap/
    )
  })

  // The left rule is gone from every event, and the check is written against
  // the whole per-type stylesheet set rather than against the one file that
  // carried it -- a left rule reintroduced on a different type is the same
  // defect wearing a different class name.
  it('draws no left rule on any event', () => {
    const per_type = fs
      .readdirSync(path.join(src, 'timeline-event'), { withFileTypes: true })
      .filter((item) => item.isDirectory())
      .map((item) => emit('timeline-event', item.name, `${item.name}.styl`))

    for (const css of [row_css, ...per_type]) {
      expect(css).to.not.match(/border-left/)
    }
  })

  // The control for the check above: it reads the files it claims to read, and
  // it can see a border that IS there.
  it('would see a left rule if one were present', () => {
    const probe = stylus('.rat-event-row\n  border-left 2px solid red').render()
    expect(probe).to.match(/border-left/)

    const names = fs
      .readdirSync(path.join(src, 'timeline-event'), { withFileTypes: true })
      .filter((item) => item.isDirectory())
      .map((item) => item.name)
    expect(names).to.include.members([
      'assistant-message',
      'system-message',
      'thinking-message',
      'user-message'
    ])
  })

  // THE TOOL ARGUMENT DRAWS NO BOX. The chip was a bordered, grounded box on
  // every argument, and a run that is mostly tool calls rendered as dozens of
  // boxes down the list — the "rules, not boxes" rule the consuming design
  // system states outright. Written against every `.rat-event-body` block in
  // every per-type stylesheet (the same surface the left-rule check above
  // sweeps), so a chip returning on a different type is the same defect wearing
  // a different class name. The detail seam below the row keeps its own
  // border-top, which is a rule between the row and its reveal rather than a
  // box around a body; it is not caught here because it is not a `.rat-event-body`
  // block.
  it('draws no border and no ground around any event body', () => {
    const per_type = fs
      .readdirSync(path.join(src, 'timeline-event'), { withFileTypes: true })
      .filter((item) => item.isDirectory())
      .map((item) => emit('timeline-event', item.name, `${item.name}.styl`))

    // Every `.rat-event-body` block across the whole per-type set, whichever
    // stylesheet happens to declare it. Some per-type stylesheets do not touch
    // the body, so the blocks are gathered rather than demanded of each file --
    // the TOTAL must be non-zero, which is what proves the gatherer can read a
    // chip's border if one ever returns.
    const body_blocks = [row_css, ...per_type].flatMap((css) => [
      ...css.matchAll(/\.rat-event-body\s*\{([^}]*)\}/g)
    ])
    expect(body_blocks.length).to.be.greaterThan(0)

    for (const { 1: block } of body_blocks) {
      expect(block).to.not.match(/border/)
      expect(block).to.not.match(/background/)
    }
  })

  // AN ELLIPSIS CANNOT BE DRAWN ON A FLEX BOX. `.rat-event-body` owns the row's
  // clamp, but both of the elements a tool row puts inside it were `inline-flex`
  // — which sizes to max-content and overflows the clip rather than shrinking
  // inside it. Measured on production: an errored `run_sql` had a 1013px body
  // in a 783px slot and was sheared mid-glyph at the panel's edge, while a
  // thinking row beside it (plain text, so the ellipsis applies) got its `…`.
  it('lets a tool row shrink inside the body rather than overflow it', () => {
    const tool_css = emit('timeline-event', 'tool-event', 'tool-event.styl')

    for (const selector of ['.rat-tool-fields', '.rat-tool-path']) {
      const rule = tool_css.match(
        new RegExp(`\\${selector} \\{([^}]*)\\}`)
      )?.[1]
      expect(rule, selector).to.be.a('string')
      expect(rule, selector).to.match(/display:\s*flex/)
      expect(rule, selector).to.not.match(/display:\s*inline-flex/)
      expect(rule, selector).to.match(/overflow:\s*hidden/)
    }
  })

  // A FAILED CALL'S ARGUMENT READS AS FAILED. The row rule tints
  // `.rat-event-body`, and `.rat-tool-field-value` re-declares the ordinary ink
  // on the very span holding the text — so before this rule an errored call
  // drew its statement at the same colour as a successful one (measured on
  // production at rgb(68, 68, 68)) and only the tool name carried the failure.
  it('tints a failed call’s fields with the error ink', () => {
    const tool_css = emit('timeline-event', 'tool-event', 'tool-event.styl')
    expect(tool_css).to.match(
      /\.rat-event-row-tool-error \.rat-tool-field-value \{[^}]*color:\s*var\(--rat-text-error/
    )
  })

  // The control for the two checks above: the reader can tell a present rule
  // from an absent one, and the override it guards against is real.
  it('would see the field value restating the ordinary ink', () => {
    const tool_css = emit('timeline-event', 'tool-event', 'tool-event.styl')
    const value_rule = tool_css.match(/\.rat-tool-field-value \{([^}]*)\}/)?.[1]
    expect(value_rule).to.match(/color:\s*var\(--rat-text,/)
    expect(tool_css).to.not.match(/\.rat-tool-no-such-element \{/)
  })

  // The control for the check above: a chip border and ground reintroduced on a
  // tool body WOULD be caught by it.
  it('would see a chip border and ground if one were present', () => {
    const probe = stylus(
      '.rat-event-row-tool-call .rat-event-body\n  border 1px solid #d9dadd\n  background #f4f4f5'
    ).render()
    const block = probe.match(/\.rat-event-body\s*\{([^}]*)\}/)?.[1]
    expect(block).to.be.a('string')
    expect(block).to.match(/border/)
    expect(block).to.match(/background/)
  })
})
