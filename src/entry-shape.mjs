// Reading a timeline entry's shape, independent of React.
//
// Kept JSX-free and in .mjs so it is importable by bare Node ESM — the whole
// point of the extension rule this package is built on.

export const ENTRY_KIND = {
  ASSISTANT_MESSAGE: 'assistant_message',
  USER_MESSAGE: 'user_message',
  THINKING: 'thinking',
  SYSTEM: 'system',
  TOOL_CALL: 'tool_call',
  TOOL_RESULT: 'tool_result',
  GENERIC: 'generic'
}

/**
 * Classify an entry for rendering. Keys on the schema's `type` discriminator,
 * splitting `message` by role. An unrecognized or absent type resolves to
 * GENERIC rather than throwing, so a consumer emitting an entry type this
 * package has never heard of degrades instead of blanking the panel.
 */
export function entry_kind(entry) {
  switch (entry?.type) {
    case 'message':
      return entry.role === 'assistant'
        ? ENTRY_KIND.ASSISTANT_MESSAGE
        : ENTRY_KIND.USER_MESSAGE
    case 'thinking':
      return ENTRY_KIND.THINKING
    case 'system':
      return ENTRY_KIND.SYSTEM
    case 'tool_call':
      return ENTRY_KIND.TOOL_CALL
    case 'tool_result':
      return ENTRY_KIND.TOOL_RESULT
    default:
      return ENTRY_KIND.GENERIC
  }
}

/**
 * A caller without read permission receives a structurally valid, char-masked
 * timeline with `is_redacted` set on every entry. Structure, types, ordering
 * and counts are all identical to an authorized read, so this flag is the only
 * thing that distinguishes a permission failure from a quiet run.
 */
export const is_redacted_entry = (entry) => entry?.is_redacted === true

/**
 * Entries whose serialized content exceeds base's byte ceiling arrive with
 * `content_elided` and a self-describing placeholder string in `content`. The
 * placeholder is real text and must be rendered as an affordance, never
 * dropped — a dropped placeholder reads as an empty message.
 */
export const is_elided_entry = (entry) => entry?.content_elided === true

/** Render any content value as text. Objects serialize rather than render as
 * `[object Object]`, which is what a naive string coercion produces for the
 * structured `tool_call` and `tool_result` contents. */
export function stringify_content(value) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

/** The tool name a `tool_call` entry invoked, or null when absent. */
export function tool_name_of(entry) {
  const name = entry?.content?.tool_name
  return typeof name === 'string' && name.length ? name : null
}

/** A `tool_result` entry's error, or null when the call succeeded. */
export function tool_error_of(entry) {
  const error = entry?.content?.error
  if (error === null || error === undefined || error === '') return null
  return stringify_content(error)
}

/** A `tool_result` entry's output as text, empty string when it carried none. */
export function tool_result_of(entry) {
  return stringify_content(entry?.content?.result)
}

// Below this, a call's elapsed time is not worth a reader's attention and is
// not rendered.
//
// THE READING EXISTS TO FIND THE OUTLIER, which is why it is thresholded rather
// than always on. Nearly every call on a run returns in about a second, so a
// duration on every row is a column of near-identical numbers that a reader
// learns to stop seeing — and the one call that took forty seconds, which is
// the entire question "where did this run go", is then just another number in
// it. Shown only where it is unusual, the number IS the answer.
const MIN_REPORTED_ELAPSED_MS = 2000

/**
 * How long a tool call took, from its own timestamp to its result's, or null
 * when that is unknown or unremarkable.
 *
 * Null rather than zero for a call still in flight: a call that has not come
 * back did not take no time, and a live row must not report a duration it will
 * contradict a moment later.
 */
export function tool_elapsed_ms(entry, tool_result) {
  const started = Date.parse(entry?.timestamp)
  const finished = Date.parse(tool_result?.timestamp)
  if (!Number.isFinite(started) || !Number.isFinite(finished)) return null

  const elapsed = finished - started
  return elapsed >= MIN_REPORTED_ELAPSED_MS ? elapsed : null
}

/** The id joining a `tool_call` to its `tool_result`, or null when absent. */
export function tool_call_id_of(entry) {
  const id = entry?.content?.tool_call_id
  return typeof id === 'string' && id.length ? id : null
}

/**
 * The argument a tool call was made with, as the one line that identifies it.
 *
 * Tools disagree about which parameter is the interesting one, and the generic
 * answer -- serialize the whole object -- buries it. `Bash` is the case that
 * matters here: its `command` is what the run actually did, and a reader
 * scanning for it should not have to read past `{"description": ...}` to reach
 * it. The preference list is ordered by how identifying the field is, and the
 * fallback is still the whole object so a tool nobody anticipated shows
 * something real rather than nothing.
 */
const IDENTIFYING_PARAMETERS = [
  'command',
  'file_path',
  'pattern',
  'query',
  'url',
  'path',
  'prompt'
]

export function tool_argument_of(entry) {
  const parameters = entry?.content?.tool_parameters
  if (!parameters || typeof parameters !== 'object') return ''

  for (const key of IDENTIFYING_PARAMETERS) {
    const value = parameters[key]
    if (typeof value === 'string' && value.length) return value
  }

  return stringify_content(parameters)
}

// The parameters whose value is a filesystem path rather than prose. Both are
// already in the preference list above; this set is what says a chosen argument
// is a PATH, so the row can render it as one.
const PATH_PARAMETERS = ['file_path', 'path']

/**
 * The identifying argument as a filesystem path, when that is what it is.
 *
 * Null when the call's identifying argument came from somewhere else, INCLUDING
 * when the parameters also carry a path -- a search call is its pattern, not the
 * directory it happened to run in, and rendering the directory as the row's
 * subject would name the wrong thing.
 */
export function tool_path_of(entry) {
  const parameters = entry?.content?.tool_parameters
  if (!parameters || typeof parameters !== 'object') return null

  const argument = tool_argument_of(entry)
  if (!argument) return null

  return PATH_PARAMETERS.some((key) => parameters[key] === argument)
    ? argument
    : null
}

// How many trailing segments of a path identify a file.
//
// ONE IS NOT ENOUGH and three is the whole path again. A tree of `index.js`,
// `README.md` and `reducer.js` files gives a basename-only row nothing to
// distinguish it from four other rows, and the parent directory is what a
// reader actually says out loud to name the file -- `tool-event/index.js`.
const PATH_TAIL_SEGMENTS = 2

/**
 * A path split into the part that identifies it and the part that only locates
 * it: `{prefix, name}`, where `name` is the basename and `prefix` is the last
 * few directories ahead of it, elided at the front when anything was dropped.
 *
 * THE ROW'S SUBJECT IS THE FILE, NOT THE MACHINE IT IS ON. An agent's paths are
 * absolute and routinely 80 characters of home directory and repository root
 * before the first byte that differs between two rows, so a list of file reads
 * clamps to an identical left-hand prefix and the reader learns nothing from any
 * of them. The full path is still carried -- on the row's title, and in the
 * disclosure when it is long enough to earn one -- so nothing is lost, it is
 * just no longer the thing occupying the line.
 */
export function split_path_tail(path, segment_count = PATH_TAIL_SEGMENTS) {
  const text = String(path ?? '').trim()
  if (!text) return null

  const is_absolute = text.startsWith('/')
  const segments = text.split('/').filter(Boolean)
  if (!segments.length) return { prefix: '', name: text }

  const name = segments[segments.length - 1]
  const directories = segments.slice(0, -1)
  const kept = segment_count > 1 ? directories.slice(1 - segment_count) : []
  const dropped = kept.length < directories.length

  const lead = dropped ? '…/' : is_absolute ? '/' : ''
  const prefix = kept.length ? `${lead}${kept.join('/')}/` : lead

  return { prefix, name }
}

/**
 * Read a consumer's answer for what identifies a tool call, as fields.
 *
 * THE PACKAGE CANNOT ANSWER THIS AND MUST NOT TRY. `tool_argument_of` above is
 * a guess ordered by how identifying a parameter USUALLY is, and for an agent
 * whose tools are CLI scripts reached through a shell it is wrong every time:
 * the `command` it picks is the whole invocation, and the query the call was
 * actually about is a JSON field somewhere inside it. Only the consumer knows
 * its own tools, so `resolve_tool_argument` is the seam that lets it say —
 * exactly as `resolve_tool_name` does for the name.
 *
 * FIELDS RATHER THAN A STRING, because the identifying answer is routinely more
 * than one thing: a catalog search is a query AND the grain it was run at, and
 * joining them into one line loses which is which.
 *
 * A FIELD MAY CARRY A TONE, which the row renders as its message's register.
 * Only `error` is styled — the accent is spent on failure and nothing else —
 * so a consumer signalling a failed outcome (a validation that did not pass,
 * a preview that errored) gets the accent on the line without the package
 * needing to know which tool failed.
 *
 * Returns null for anything unusable, which is the signal to fall back to the
 * package's own guess. A consumer only has to recognize the calls it knows.
 */
export function normalize_tool_fields(value) {
  if (!Array.isArray(value)) return null

  const fields = []
  for (const field of value) {
    const text = stringify_content(field?.value).trim()
    if (!text) continue
    const label = typeof field?.label === 'string' ? field.label.trim() : ''
    const field_out = { label: label || null, value: text }
    const tone =
      typeof field?.tone === 'string' && field.tone.trim().length
        ? field.tone.trim()
        : null
    // Omitted rather than null: the field carries no register unless the
    // consumer gave it one, and a null key would be a third shape to read.
    if (tone) field_out.tone = tone
    fields.push(field_out)
  }

  return fields.length ? fields : null
}

// Harness bookkeeping that base records as `system` entries, matched on the
// content prefix.
//
// MEASURED, NOT GUESSED: across the three shared generation timelines that
// existed on 2026-09-06, `system` was 224 of 493 entries -- 45% of the whole
// surface -- and 175 of those 224 were the first four patterns below. A panel
// that renders them shows a reader forty rows of "Deferred tools updated"
// between the two tool calls they were looking for.
//
// PREFIX MATCHING IS THE POINT. Several of these carry a value that differs per
// run (`Mode: normal`, `Session cost: $11.12`), so an equality set would match
// the run it was written from and nothing else -- passing its test and doing
// nothing in production.
//
// This hides rows; it does not remove them from the payload. A `Session cost:`
// line a share link should not carry is still carried whether or not this
// filter is on, and the fix for that lives in whatever projects the share.
const NOISE_SYSTEM_PATTERNS = [
  /^Deferred tools updated/,
  /^ATIS latch/,
  /^Mode: /,
  /^Permission mode: /,
  /^File history snapshot/,
  /^Session cost: /,
  /^Session title: /
]

/**
 * Whether an entry is harness bookkeeping rather than something the agent did.
 *
 * Scoped to `system` entries deliberately. The same prefix appearing in an
 * assistant message is the agent TALKING about its session, which is content.
 */
export function is_noise_system_entry(entry) {
  if (entry?.type !== 'system') return false
  if (is_redacted_entry(entry)) return false

  const content = entry?.content
  if (typeof content !== 'string') return false
  if (content.trim() === '') return true

  return NOISE_SYSTEM_PATTERNS.some((pattern) => pattern.test(content))
}

/**
 * The single line that represents an entry when collapsed. Deliberately derived
 * from the entry itself rather than taken as a separate summary prop, so the
 * collapsed row and the expanded row can never disagree.
 */
export function entry_summary_text(entry) {
  const kind = entry_kind(entry)
  if (kind === ENTRY_KIND.TOOL_CALL) {
    return tool_name_of(entry) || stringify_content(entry?.content)
  }
  if (kind === ENTRY_KIND.TOOL_RESULT) {
    return tool_error_of(entry) || stringify_content(entry?.content?.result)
  }
  return stringify_content(entry?.content)
}

/** Collapse whitespace so a multi-line body reads as one row. */
export function to_single_line(text) {
  return String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim()
}
