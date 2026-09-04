// Ordering and de-duplication for a timeline that arrives from two sources at
// once: a backfill read and a live tail. They overlap, and the overlap arrives
// out of order.
//
// The rule mirrors base's own `is_latest_event_advance`
// (client/core/threads/reconcile-timeline.js), which compares the ordering
// spine first and falls back to timestamp. Base paid for the alternative: when
// truncated entries carried neither field, every comparison fell through to a
// "nothing comparable, let it win" branch and the anti-shuffle guard was inert
// for exactly the tier that replays out of order.
//
// JSX-free and .mjs so it is importable by bare Node ESM.

import {
  entry_summary_text,
  is_elided_entry,
  is_redacted_entry,
  to_single_line
} from '../entry-shape.mjs'

// Index-less entries sort after every stamped entry, preserving their relative
// insertion order (Array.prototype.sort is stable, so equal keys never move).
const INDEX_LAST = Number.MAX_SAFE_INTEGER

export function entry_index(entry) {
  const index = entry?.ordering?.timeline_index
  return typeof index === 'number' ? index : null
}

export function entry_epoch(entry) {
  const epoch = entry?.ordering?.timeline_epoch
  return typeof epoch === 'number' ? epoch : 0
}

export function entry_timestamp_ms(entry) {
  const raw = entry?.timestamp
  if (!raw) return null
  const ms = Date.parse(raw)
  return Number.isNaN(ms) ? null : ms
}

const sort_key = (entry) => entry_index(entry) ?? INDEX_LAST

/**
 * True when `candidate` is at least as new as `current`. Prefers the ordering
 * spine (higher epoch, or equal epoch and index >= current) when both entries
 * carry it; otherwise falls back to the timestamp both the full and truncated
 * shapes always carry. A null `current` has nothing to protect.
 */
export function is_latest_event_advance(candidate, current) {
  if (!current) return true

  const candidate_index = entry_index(candidate)
  const current_index = entry_index(current)
  if (candidate_index !== null && current_index !== null) {
    const candidate_epoch = entry_epoch(candidate)
    const current_epoch = entry_epoch(current)
    if (candidate_epoch !== current_epoch)
      return candidate_epoch > current_epoch
    return candidate_index >= current_index
  }

  const candidate_ms = entry_timestamp_ms(candidate)
  const current_ms = entry_timestamp_ms(current)
  if (candidate_ms !== null && current_ms !== null)
    return candidate_ms >= current_ms

  return true
}

// An entry's identity for de-duplication. The timeline index is the dense
// primary key, but only within an epoch — a re-rank bumps the epoch and reuses
// indices, so keying on the index alone would collapse two distinct entries.
// Index-less entries fall back to their id.
function dedupe_key(entry) {
  const index = entry_index(entry)
  if (index !== null) return `i:${entry_epoch(entry)}:${index}`
  if (entry?.id) return `id:${entry.id}`
  return null
}

/**
 * Sort ascending by ordering index and drop duplicates, so a backfill
 * overlapping a live tail renders each entry exactly once. Later occurrences
 * win: a live entry supersedes the backfilled copy of itself. Entries with no
 * identity at all are kept as-is rather than silently dropped.
 */
export function order_entries(entries) {
  if (!Array.isArray(entries)) return []

  const by_key = new Map()
  const unkeyed = []

  for (const entry of entries) {
    if (!entry) continue
    const key = dedupe_key(entry)
    if (key === null) {
      unkeyed.push(entry)
      continue
    }
    by_key.set(key, entry)
  }

  return [...by_key.values(), ...unkeyed].sort(
    (a, b) => sort_key(a) - sort_key(b)
  )
}

/**
 * Whether an entry has anything for the collapsed row to say.
 *
 * Both degraded shapes count as content and must never be skipped: a redacted
 * entry renders the masking affordance, which is how a permission failure
 * becomes visible, and an elided entry renders its placeholder.
 */
export function has_display_content(entry) {
  if (!entry) return false
  if (is_redacted_entry(entry) || is_elided_entry(entry)) return true
  return to_single_line(entry_summary_text(entry)).length > 0
}

/**
 * The entry the collapsed row shows.
 *
 * Never the last array element — a backfill overlapping a live tail arrives out
 * of order, and array position would show whichever copy landed last.
 *
 * Contentless entries are skipped, which is not cosmetic. Measured against a
 * real generation run: the two highest-ordered entries were `system`/`status`
 * with empty content, so the collapsed row rendered the word "System" and
 * nothing else while the run's actual answer sat three entries earlier. The
 * whole point of this surface is that a user sees what the agent did, and a
 * blank latest row is the paraphrased progress line's failure in a new costume.
 *
 * Falls back to the plain advance-winner when NO entry has content, so a
 * timeline of nothing but empty entries still reports its latest rather than
 * disappearing.
 */
export function latest_entry(entries) {
  if (!Array.isArray(entries)) return null

  let latest = null
  let latest_with_content = null

  for (const entry of entries) {
    if (!entry) continue
    if (is_latest_event_advance(entry, latest)) latest = entry
    if (
      has_display_content(entry) &&
      is_latest_event_advance(entry, latest_with_content)
    ) {
      latest_with_content = entry
    }
  }

  return latest_with_content || latest
}
