# react-agent-timeline

A presentational React component that renders an agent session timeline: collapsed to the latest event by default, expandable to the full run.

Props in, JSX out. No Redux, no router, no fetch, and no knowledge of where entries came from — every domain label comes from the consumer.

## Design rules

Three properties are load-bearing and easy to break silently:

- **Every relative import carries its file extension.** The package must be importable by bare Node ESM, not only by a bundler.
- **Every `.styl` imports the package's own tokens at its top.** Stylus emits nothing for an unknown variable rather than erroring, so a consumer that injects only its own variables would otherwise render these rules as blank.
- **No `styled()`, no `@emotion` import.** MUI is used through deep default imports only. This is what lets one component run under two different style engines.

## Consuming

Both consumers import source from `src/` and compile the JSX themselves; there is no build step and no `dist/`. A consumer's babel-loader must be told not to exclude this package.
