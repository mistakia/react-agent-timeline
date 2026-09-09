// Joining a tool call to the result it produced.
//
// The two arrive as SEPARATE timeline entries, and rendering them as two rows
// is what made the panel unreadable: a run is mostly tool traffic, so half the
// rows were unbounded output that nobody asked to see, sitting between the
// calls that a reader was actually scanning for. Paired, a call is one row and
// its output is behind a disclosure on that row.
//
// TWO JOIN KEYS, AND THE SECOND IS NOT A FALLBACK FOR TIDINESS. `tool_call_id`
// is the real key and is present on a live timeline, which reads base's raw
// entries. It is NOT present on an already-published share: league's share
// projection is an allowlist and left the id out on the stated grounds that no
// renderer read it, which was true when it was written. Shares minted before
// that allowlist widens therefore carry calls and results with no key between
// them, and an id-only join would render every one of those runs as unpaired
// rows -- correct on the surface it was tested against, broken on the one a
// reader is most likely to be handed.
//
// So the positional join is load-bearing for real stored data, not a defensive
// branch. It is sound for these timelines because the agent runs its tools one
// at a time: a result belongs to the nearest preceding call that has not been
// claimed. It would be wrong under parallel tool use, which is exactly when the
// id IS present, so the two halves cover each other.

import { ENTRY_KIND, entry_kind, tool_call_id_of } from '../entry-shape.mjs'
import {
  has_display_content,
  is_latest_event_advance
} from './order-entries.mjs'

/**
 * Group an ordered entry list into rows, attaching each tool result to the call
 * it answered.
 *
 * @param {Array<object>} ordered - entries already in render order
 * @returns {Array<{entry: object, tool_result: object|null}>}
 */
export function pair_tool_entries(ordered) {
  if (!Array.isArray(ordered)) return []

  const rows = []
  // Index of each unclaimed call's ROW, so a match can attach in place rather
  // than having to find it again.
  const unclaimed = []

  for (const entry of ordered) {
    const kind = entry_kind(entry)

    if (kind === ENTRY_KIND.TOOL_CALL) {
      rows.push({ entry, tool_result: null })
      unclaimed.push(rows.length - 1)
      continue
    }

    if (kind !== ENTRY_KIND.TOOL_RESULT) {
      rows.push({ entry, tool_result: null })
      continue
    }

    const result_id = tool_call_id_of(entry)

    let claimed = -1
    if (result_id) {
      claimed = unclaimed.findIndex(
        (row_index) => tool_call_id_of(rows[row_index].entry) === result_id
      )
    }

    // No id on one side or the other, so fall back to the nearest preceding
    // unclaimed call -- the last one pushed.
    if (claimed === -1 && unclaimed.length > 0) {
      claimed = unclaimed.length - 1
    }

    if (claimed === -1) {
      // An orphan result, with no call before it to belong to. Emitted as its
      // own row rather than dropped: it is real output, and a timeline that
      // silently discards it reads as a run that produced nothing.
      rows.push({ entry, tool_result: null })
      continue
    }

    rows[unclaimed[claimed]].tool_result = entry
    unclaimed.splice(claimed, 1)
  }

  return rows
}

/**
 * The newest entry a row stands for. A paired row advances when its RESULT
 * lands, not only when its call did, so a finished call still reads as the most
 * recent thing that happened.
 */
function row_head(row) {
  if (!row?.tool_result) return row?.entry ?? null
  return is_latest_event_advance(row.tool_result, row.entry)
    ? row.tool_result
    : row.entry
}

/**
 * Whether a row has anything to say — on the collapsed line, and now on the
 * expanded list, which renders only rows that pass.
 *
 * A tool call always does, even with an empty argument: the tool's NAME is the
 * content of that row. Deferring to `has_display_content` on the call entry
 * alone would skip a no-argument call and show something older instead.
 */
export function row_has_content(row) {
  if (!row?.entry) return false
  if (entry_kind(row.entry) === ENTRY_KIND.TOOL_CALL) return true
  if (has_display_content(row.entry)) return true
  return Boolean(row.tool_result && has_display_content(row.tool_result))
}

/**
 * The row the collapsed timeline shows.
 *
 * This is `latest_entry` lifted to rows, and the lift is the whole point: a
 * tool result is no longer an event in its own right, so it must not be able to
 * become the collapsed line. Selecting over entries, a run spends every moment
 * between a call returning and the next entry arriving with "Result" and a wall
 * of output as its status line -- measured at 6 of 51 instants on a real
 * generation run. Selecting over rows, the same moments read as the CALL, with
 * its output folded away exactly as it is in the expanded list.
 *
 * @param {Array<{entry: object, tool_result: object|null}>} rows
 * @returns {{entry: object, tool_result: object|null}|null}
 */
export function latest_row(rows) {
  if (!Array.isArray(rows)) return null

  let latest = null
  let latest_with_content = null

  for (const row of rows) {
    if (!row?.entry) continue
    const head = row_head(row)
    if (is_latest_event_advance(head, row_head(latest))) latest = row
    if (
      row_has_content(row) &&
      is_latest_event_advance(head, row_head(latest_with_content))
    ) {
      latest_with_content = row
    }
  }

  return latest_with_content || latest
}

export default pair_tool_entries
