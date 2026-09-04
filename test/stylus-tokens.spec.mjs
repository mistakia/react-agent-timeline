import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import { expect } from 'chai'
import stylus from 'stylus'

// The package's second rule, checked against EMITTED CSS rather than against
// the source.
//
// Reading a .styl file cannot distinguish a token that resolves from one that
// does not: Stylus emits nothing for an unknown variable rather than erroring,
// so a file missing its token import compiles green and renders a blank
// declaration. `react-table/src/table/table.styl` is the live instance — it
// uses $rt_* three times with no import at all, base injects those variables
// through dedicated webpack branches, and league's single stylus rule does not,
// so the same file silently renders nothing under league.
//
// Every file is compiled with NO injected variables, which is the strictest
// consumer: if it emits real values here, it emits them under any consumer.

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'src'
)

function collect_stylesheets(dir, found = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) collect_stylesheets(full, found)
    else if (entry.name.endsWith('.styl')) found.push(full)
  }
  return found
}

const render = (file) =>
  stylus(fs.readFileSync(file, 'utf8')).set('filename', file).render()

// A declaration whose value never resolved: `color:;` or `padding: ;`. This is
// exactly what an un-imported token produces.
const EMPTY_DECLARATION = /:\s*;/

const stylesheets = collect_stylesheets(root)

describe('stylus self-sufficiency', () => {
  it('finds the package stylesheets rather than silently checking nothing', () => {
    // Guards the whole suite against a path change turning it into a vacuous
    // pass over an empty file list.
    expect(stylesheets.length).to.be.greaterThan(5)
  })

  for (const file of stylesheets) {
    const name = path.relative(root, file)

    it(`${name} compiles with no injected variables`, () => {
      expect(() => render(file)).to.not.throw()
    })

    it(`${name} emits no empty declaration`, () => {
      const css = render(file)
      expect(css).to.not.match(EMPTY_DECLARATION)
    })
  }

  it('emits real values for the tokens the event row uses', () => {
    const css = render(
      path.join(root, 'timeline-event', 'timeline-event-row.styl')
    )

    expect(css).to.contain('.rat-event-row')
    expect(css).to.match(/min-height:\s*var\(--rat-row-min-height,\s*24px\)/)
    expect(css).to.match(/font-size:\s*var\(--rat-font-size-md,\s*13px\)/)
  })

  it('every stylesheet other than tokens.styl imports the package tokens', () => {
    const missing = stylesheets
      .filter((file) => path.basename(file) !== 'tokens.styl')
      .filter(
        (file) =>
          !/@import\s+'[^']*tokens\.styl'/.test(fs.readFileSync(file, 'utf8'))
      )
      .map((file) => path.relative(root, file))

    expect(missing).to.eql([])
  })
})
