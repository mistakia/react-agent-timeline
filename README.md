# react-agent-timeline

A presentational React component that renders an agent session timeline: collapsed to the latest event by default, expandable to the full run.

Props in, JSX out. No Redux, no router, no fetch, and no knowledge of where entries came from — every domain label comes from the consumer.

## Behaviour worth knowing before you use it

- **Collapsed is one line, and it streams.** The row is derived from `entries`, so it advances on its own as they arrive; it is clamped to a single line because the newest entry is unbounded text and a wrapping row makes the host panel jump on every tick.
- **Expanded reads bottom-up, like a message chat.** It opens at the newest entry and follows new ones, unless the reader scrolls away — then nothing moves under them and a jump-to-latest control appears until they return to the bottom.
- **`duration_ms` is rendered, never computed.** The consumer knows what started and finished the run; the package formats the number it is handed and shows nothing when handed none.

## Design rules

Three properties are load-bearing and easy to break silently:

- **Every relative import carries its file extension.** The package must be importable by bare Node ESM, not only by a bundler.
- **Every `.styl` imports the package's own tokens at its top.** Stylus emits nothing for an unknown variable rather than erroring, so a consumer that injects only its own variables would otherwise render these rules as blank.
- **No `styled()`, no `@emotion` import.** MUI is used through deep default imports only. This is what lets one component run under two different style engines.

## Consuming

Both consumers import source from `src/` and compile the JSX themselves; there is no build step and no `dist/`. A consumer's babel-loader must be told not to exclude this package.
