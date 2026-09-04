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
