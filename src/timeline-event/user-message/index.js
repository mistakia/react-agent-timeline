import React from 'react'
import PropTypes from 'prop-types'

import TimelineEventRow from '../timeline-event-row.js'
import EntryBody from '../entry-body.js'
import { stringify_content, to_single_line } from '../../entry-shape.mjs'
import { labels_prop_type } from '../../labels.mjs'

import './user-message.styl'

// Longest an instruction may render before it collapses behind the row's
// disclosure. Generation briefs are routinely several paragraphs and can
// dominate an already scrollable panel; an entry up to this length reads in
// full, one past it reads as a clamped line until opened. Same order of
// magnitude as the cap base's tool header applies to a long argument, so the
// two surfaces truncate at a comparable place rather than at two arbitrary
// ones.
const COLLAPSE_CHARACTERS = 240

// One line, hard-truncated rather than CSS-ellipsized, because the message's
// body has no overflow clamp in the expanded view (the tool chip is clamped
// by CSS below; a message is not). Slicing here is what makes "collapsed" mean
// a bounded row in every view.
const clamp_line = (text) => {
  const line = to_single_line(text)
  if (line.length <= COLLAPSE_CHARACTERS) return line
  return `${line.slice(0, COLLAPSE_CHARACTERS - 3)}...`
}

export default function UserMessage({ entry, labels, is_expandable }) {
  const text = stringify_content(entry?.content)

  const is_long = text.length > COLLAPSE_CHARACTERS
  const can_toggle = Boolean(is_expandable) && is_long
  const [is_open, set_is_open] = React.useState(false)

  // Collapsed shows a clamped line; open shows the whole instruction. The full
  // text lives in the detail block, the same place the tool argument and result
  // go, so every disclosure on this surface reveals the same way.
  const collapsed = can_toggle && !is_open
  const body_text = collapsed ? clamp_line(text) : text

  return (
    <TimelineEventRow
      modifier="user-message"
      label={labels.user}
      body={<EntryBody entry={entry} text={body_text} labels={labels} />}
      is_expanded={is_open}
      on_toggle={can_toggle ? () => set_is_open((open) => !open) : undefined}
      toggle_title={is_open ? labels.hide_details : labels.show_details}
      detail={is_open ? <div>{text}</div> : null}
    />
  )
}

UserMessage.propTypes = {
  entry: PropTypes.object.isRequired,
  labels: labels_prop_type.isRequired,
  // Whether the row may open. False in the collapsed timeline, whose single
  // row is a status line rather than a control — see AgentSessionTimeline for
  // the reason the same flag gates tool rows.
  is_expandable: PropTypes.bool
}
