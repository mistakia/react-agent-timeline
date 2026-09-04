import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import { expect } from 'chai'

// The package's third rule, made mechanical.
//
// One component runs under base's emotion engine and league's
// styled-components engine only because it touches neither. A single
// `styled()` call or `@emotion` import compiles fine in whichever consumer was
// tested and breaks in the other, and nothing about the source says so — this
// is the rule that is invisible until it breaks, so it gets a check rather
// than a convention.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const FORBIDDEN = [
  {
    pattern: /@emotion\//,
    reason: 'an @emotion import binds the package to one style engine'
  },
  {
    pattern: /\bstyled\(/,
    reason: 'a styled() call binds the package to one style engine'
  },
  {
    pattern: /styled-components/,
    reason: 'a styled-components import binds the package to one style engine'
  }
]

function collect_sources(dir, found = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) collect_sources(full, found)
    else if (/\.(js|jsx|mjs)$/.test(entry.name)) found.push(full)
  }
  return found
}

const sources = [
  path.join(root, 'index.js'),
  ...collect_sources(path.join(root, 'src'))
]

describe('style engine independence', () => {
  it('finds the package sources rather than silently checking nothing', () => {
    expect(sources.length).to.be.greaterThan(5)
  })

  it('holds no styled() call and no style-engine import', () => {
    const violations = []

    for (const file of sources) {
      const source = fs.readFileSync(file, 'utf8')
      for (const { pattern, reason } of FORBIDDEN) {
        if (pattern.test(source)) {
          violations.push(`${path.relative(root, file)}: ${reason}`)
        }
      }
    }

    expect(violations).to.eql([])
  })

  it('declares no style-engine peer dependency', () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(root, 'package.json'), 'utf8')
    )
    const peers = Object.keys(manifest.peerDependencies || {})

    expect(
      peers.filter((name) => /emotion|styled-components/.test(name))
    ).to.eql([])
  })
})
