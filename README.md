# react-agent-timeline

A presentational React component that renders an agent session timeline: collapsed to the latest event by default, expandable to the full run.

Props in, JSX out. No Redux, no router, no fetch, and no knowledge of where entries came from — every domain label comes from the consumer.

## Behaviour worth knowing before you use it

- **Collapsed is one line, and it streams.** The row is derived from `entries`, so it advances on its own as they arrive; it is clamped to a single line because the newest entry is unbounded text and a wrapping row makes the host panel jump on every tick.
- **Expanded reads bottom-up, like a message chat.** It opens at the newest entry and follows new ones, unless the reader scrolls away — then nothing moves under them and a jump-to-latest control appears until they return to the bottom.
- **`duration_ms` is rendered, never computed.** The consumer knows what started and finished the run; the package formats the number it is handed and shows nothing when handed none. The one exception is the LIVE counter: pass `is_running` and `started_at_ms` and the package ticks, because nothing has finished the run yet for the consumer to measure. It is an absolute epoch rather than an offset so a reload does not restart the clock at zero.
- **A tool call and its result are ONE row.** The call shows the tool's name and its argument as a one-line chip; the result sits behind a disclosure on that row and is not rendered until the reader opens it. A FAILED call is the exception and shows its error inline — folding a failure away is how a run that spent minutes retrying a broken tool comes to look like progress.
- **The two halves are joined by `tool_call_id` when present and by position otherwise.** Both are needed: live timelines carry the id, and share payloads that predate the projection carrying it do not.
- **Harness bookkeeping is hidden by default.** `system` entries like `Deferred tools updated` and `Permission mode: …` were 45% of a measured real timeline and none of them is something the agent did. Pass `hide_noise={false}` for the raw record. This hides rows; it does not remove anything from the payload, so it is not a fix for a share carrying something it should not.
- **`resolve_tool_name` is how a consumer names its own tools.** These agents typically reach their real tools through a generic one, so most rows report `Bash` and the tool that actually ran is a detail of the command. The package will not parse that — it asks, and falls back to the entry's own `tool_name`.

## Look

Flat and ruled by default: no shadows, no card, no radius above 3px, and no iconography — the disclosure marker is a monospace `+`/`−` rather than a chevron. That is a decision, not a placeholder. The consuming application's design system states "rules, not boxes" and "no shadows for depth", so defaults that drew cards would be overridden on the first render, leaving one look defined in two places. Everything is a `--rat-*` custom property, so a consumer that does want depth adds it without rebuilding.

## Design rules

Three properties are load-bearing and easy to break silently:

- **Every relative import carries its file extension.** The package must be importable by bare Node ESM, not only by a bundler.
- **Every `.styl` imports the package's own tokens at its top.** Stylus emits nothing for an unknown variable rather than erroring, so a consumer that injects only its own variables would otherwise render these rules as blank.
- **No `styled()`, no `@emotion` import.** This is what lets one component run under two different style engines. The component goes further than the rule requires and uses no MUI at all — plain elements and Stylus — so `@mui/material` is not a peer dependency.

## Consuming

The consumer imports source from `src/` and compiles the JSX itself; there is no build step and no `dist/`. A consumer's babel-loader must be told not to exclude this package.

League is the consuming application. Base is deliberately not migrated onto this package — it keeps its own virtualized list and per-tool renderer registry, which this package does not carry — so league's consumption is the whole surface this component serves.
