// Assert that every relative import in the package carries a file extension and
// resolves to a file that exists.
//
// This is the mechanical form of the package's first rule. The defect it exists
// to prevent is `react-table`'s: 67 extensionless relative imports, which a
// bundler resolves happily and bare Node ESM does not, which is what made most
// of its modules unimportable outside a webpack build.
//
// It is a RESOLUTION check, not an import check. Actually importing index.js
// under bare Node fails on JSX syntax no matter how correct the specifiers are,
// because Node has no JSX parser — so an import-based check cannot distinguish
// a missing extension from a JSX file and would report failure either way. This
// walks the specifiers instead, which is the property that actually matters.

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const SOURCE_EXTENSIONS = new Set(['.js', '.jsx', '.mjs'])
const IMPORTABLE_EXTENSIONS = new Set(['.js', '.jsx', '.mjs', '.styl', '.css'])

// Matches the specifier of a static import/export-from and of a dynamic
// import(). Comments are not stripped, so a commented-out import is checked
// too — a false positive is cheap here and a false negative is not.
const SPECIFIER_PATTERN =
  /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|import\s*['"]([^'"]+)['"]/g

function collect_source_files(dir, found = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) collect_source_files(full, found)
    else if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) found.push(full)
  }
  return found
}

const files = [
  path.join(root, 'index.js'),
  ...collect_source_files(path.join(root, 'src')),
  ...collect_source_files(path.join(root, 'scripts')),
  ...collect_source_files(path.join(root, 'test'))
]

const failures = []

for (const file of files) {
  const source = fs.readFileSync(file, 'utf8')
  for (const match of source.matchAll(SPECIFIER_PATTERN)) {
    const specifier = match[1] || match[2] || match[3]
    if (!specifier || !specifier.startsWith('.')) continue

    const relative_file = path.relative(root, file)
    const extension = path.extname(specifier)

    if (!IMPORTABLE_EXTENSIONS.has(extension)) {
      failures.push(
        `${relative_file}: '${specifier}' has no file extension — a bundler resolves this, bare Node ESM does not`
      )
      continue
    }

    const resolved = path.resolve(path.dirname(file), specifier)
    if (!fs.existsSync(resolved)) {
      failures.push(`${relative_file}: '${specifier}' resolves to no file`)
    }
  }
}

if (failures.length) {
  console.error(`relative import check FAILED (${failures.length}):`)
  for (const failure of failures) console.error(`  ${failure}`)
  process.exit(1)
}

console.log(`relative import check passed across ${files.length} files`)
