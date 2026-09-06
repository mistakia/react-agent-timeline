import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import { expect } from 'chai'
import stylus from 'stylus'

// The one layout property in this package that cannot be checked by rendering
// the component.
//
// The expanded list is a column flex container with a max-height, which makes
// its height definite, which makes every row resolve the default
// `flex-shrink: 1` against it. Rows then squeeze toward their 24px min-height
// while their wrapped bodies still need full height, and the overflow paints
// over the row below -- measured at 28px boxes holding 48px of text, so each
// entry bled 20px into its neighbour and the run rendered as overlapping lines.
//
// This asserts on emitted CSS rather than on a rendered tree because the suite
// runs under happy-dom, which has no layout engine: offsetHeight is 0 for every
// element there, so a DOM assertion would pass whether the rule is present or
// not. That is the vacuous-check failure this file exists to avoid, and it is
// why the property is pinned at the stylesheet instead.

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'src'
)

const render = (file) =>
  stylus(fs.readFileSync(file, 'utf8')).set('filename', file).render()

describe('event row shrink', () => {
  const css = render(
    path.join(root, 'timeline-event', 'timeline-event-row.styl')
  )

  // The ROW's own block, and nothing after it. Sliced to the closing brace
  // because `.rat-event-label` carries its own `flex: none` a few lines below:
  // an assertion over the rest of the file matches that one and passes with the
  // row's pin deleted, which is how the first version of this check behaved.
  const row_rule = css.match(/\.rat-event-row \{([^}]*)\}/)?.[1]

  it('finds the row rule, rather than asserting over nothing', () => {
    expect(row_rule).to.be.a('string')
  })

  it('pins the row against flex shrink', () => {
    expect(row_rule).to.match(/flex:\s*none/)
  })

  it('still floors the row height, which is a separate job from the pin', () => {
    // Stated so a future edit cannot satisfy the check above by deleting the
    // min-height: the floor and the pin look interchangeable and are not.
    expect(css).to.match(/min-height:\s*var\(--rat-row-min-height,\s*24px\)/)
  })
})
