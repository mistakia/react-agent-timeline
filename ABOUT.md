---
title: react-agent-timeline
type: repository
description: >-
  Public repository holding a presentational React agent session timeline component, consumed by
  base and league as a SHA-pinned GitHub dependency.
base_uri: user:repository/active/react-agent-timeline/ABOUT.md
created_at: '2026-09-04T20:06:25.055Z'
entity_id: f2b29d0d-b7f3-4b59-bf6e-66233501e98e
public_read: false
updated_at: '2026-09-04T20:06:25.055Z'
user_public_key: 10ba842b1307fd60475b887df61ccc7e697970a2d222e7cbf011e51f5de3349b
---

## Purpose

A presentational React component that renders an agent session timeline: collapsed to the latest event by default, expandable to the full run. Props in, JSX out.

## Context

The package exists because base is private and league is public, so neither can depend on the other's client code. It follows the mechanism `react-table` already proves between the same two repos: a separate public repository, consumed by each as a SHA-pinned GitHub dependency, source-imported from `src/` and compiled by each consumer's own babel-loader.

Base is deliberately NOT migrated onto it. Base keeps its own 1090-line virtualized list and its per-tool renderer registry, which this package does not carry.

## Standards

Three rules are load-bearing, and each one fails silently rather than loudly:

- **Every relative import carries its file extension.** A bundler resolves `'./timeline-event'`; bare Node ESM does not. `react-table` has 67 extensionless imports and that is on record as what made most of its modules unimportable server-side.
- **Every `.styl` imports the package's own tokens at its top.** Stylus emits nothing for an unknown variable rather than erroring. `react-table/src/table/table.styl` uses `$rt_*` three times with no import at all, and base injects those variables through dedicated webpack branches while league's single stylus rule does not — so the same file renders as blank declarations under league.
- **No `styled()`, no `@emotion` import.** This is the property that lets one component run under base's emotion engine and league's styled-components engine unchanged, and it is invisible until it breaks. The component went further than the rule requires and uses no MUI at all — plain elements and Stylus — so the style engine is not merely avoided but absent, and `@mui/material` is not a peer. `test/style-engine-independence.spec.mjs` enforces it.

Each rule has a check that fails when it is broken, because all three fail silently otherwise: `yarn check:imports` for extensions, `test/stylus-tokens.spec.mjs` for tokens (asserting on emitted CSS, since reading the source cannot tell a resolved token from an unresolved one), and the spec above for the style engine.

Bare Node ESM cannot import `index.js`, and no correct version of this package could: Node has no `.jsx` loader, so the import fails on the extension regardless of how specifiers are written. `yarn check:imports` walks the specifiers instead, which is the property that actually matters, and the `.mjs` logic modules — `order-entries.mjs` and `entry-shape.mjs` — do import under bare Node.

No `dist/`, no `main` pointing at a build, no `prepare` script. `react-table` carries a committed build that no consumer resolves through; reproducing that would ship dead weight and invite a reader to trust it.

## Scope

**Belongs here**: the timeline shell, per-type event renderers, ordering and de-duplication, and the style tokens they need.

**Belongs elsewhere**: anything that knows where entries came from. No Redux, no router, no fetch, no domain vocabulary — the consumer supplies every label. The repository is public, so nothing private may enter it: no route shapes, no state vocabulary, no topology, no credentials.

## Notable Context

- [[user:task/react-agent-timeline/create-react-agent-timeline-package.md]] — the task that created this repository and builds the component
- [[user:repository/active/react-table/ABOUT.md]] — the precedent this package follows, and the source of both defects it is designed to avoid
