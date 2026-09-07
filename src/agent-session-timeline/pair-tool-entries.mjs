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

export default pair_tool_entries
