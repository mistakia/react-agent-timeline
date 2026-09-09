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
})
