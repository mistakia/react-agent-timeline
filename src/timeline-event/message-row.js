import React from 'react'
import PropTypes from 'prop-types'

import TimelineEventRow from './timeline-event-row.js'
import EntryBody from './entry-body.js'
import { stringify_content, to_single_line } from '../entry-shape.mjs'
import { labels_prop_type } from '../labels.mjs'

import './message-row.styl'

// Longest a message may render on its row before it collapses behind the row's
// disclosure.
//
// EVERY PROSE ROW IS ONE LINE, and that is the property the expanded list is
// built on rather than a preference about density. A reasoning entry is
// routinely twenty lines of deliberation and there are dozens of them in a run,
// so a list that renders them whole is a wall of the agent's private thinking
// with the six things it DID buried somewhere inside — measured on a real
// generation share, where four thinking entries filled the panel end to end and
// no tool call was visible without scrolling. Clamped, the same run reads as a
// list of steps, and the deliberation is one click away on the row that holds
// it.
//
// 120 is about what fits on one line at the width the consuming panel declares,
// so a row that offers the disclosure is very nearly the same set as a row the
// reader can see is cut. The threshold and the CSS ellipsis are two clamps for
// one job, deliberately: the slice bounds the DOM and makes "hidden until
// opened" an assertion, the ellipsis handles whatever width the panel actually
// gets.
const COLLAPSE_CHARACTERS = 120

// One line, hard-truncated rather than CSS-ellipsized. The CSS clamp alone
// cannot help with an embedded newline: the row would grow to the height of the
// whole message while showing one line of it, which is the row-overlap failure
// the row stylesheet exists to prevent.
const clamp_line = (text) => {
  const line = to_single_line(text)
  if (line.length <= COLLAPSE_CHARACTERS) return line
  return `${line.slice(0, COLLAPSE_CHARACTERS - 3)}...`
}

/**
 * A prose entry as one line, with the whole of it behind the row's disclosure.
 *
 * Shared by every message-shaped renderer — the user's instruction, the agent's
 * reasoning, a system record, and the fallback for a type this package has
 * never heard of. They differ only in their label, their modifier and whether
 * they are muted, so those are props and the collapse behaviour is written
 * once. The assistant message is deliberately NOT one of them: its prose is the
 * agent's answer and renders in full.
 */
export default function MessageRow({
  entry,
  labels,
  is_expandable,
  modifier,
  label,
  is_muted
}) {
  const text = stringify_content(entry?.content)
  const line = to_single_line(text)

  // Clipped by length OR by shape: a short message carrying a newline is not
  // long, but it is still not all on the row.
  const is_clipped = line.length > COLLAPSE_CHARACTERS || line !== text
  const can_toggle = Boolean(is_expandable) && is_clipped
  const [is_open, set_is_open] = React.useState(false)

  // The full text lives in the detail block, the same place a tool's argument
  // and result go, so every disclosure on this surface reveals the same way.
  const body_text = can_toggle && is_open ? text : clamp_line(text)

  return (
    <TimelineEventRow
      modifier={modifier}
      label={label}
      is_muted={is_muted}
      body={<EntryBody entry={entry} text={body_text} labels={labels} />}
      is_expanded={is_open}
      on_toggle={can_toggle ? () => set_is_open((open) => !open) : undefined}
      toggle_title={is_open ? labels.hide_details : labels.show_details}
      detail={is_open ? <div>{text}</div> : null}
    />
  )
}

MessageRow.propTypes = {
  entry: PropTypes.object.isRequired,
  labels: labels_prop_type.isRequired,
  // Whether the row may open. False in the collapsed timeline, whose single row
  // is a status line rather than a control — opening it there would break the
  // one-line clamp that keeps the host panel from jumping.
  is_expandable: PropTypes.bool,
  modifier: PropTypes.string.isRequired,
  label: PropTypes.node.isRequired,
  is_muted: PropTypes.bool
}
