import React from 'react'
import PropTypes from 'prop-types'

import TimelineEventRow from '../timeline-event-row.js'
import EntryBody from '../entry-body.js'
import { stringify_content } from '../../entry-shape.mjs'
import { labels_prop_type } from '../../labels.mjs'

import './assistant-message.styl'

/**
 * What the agent SAID, rendered as a message rather than as a labelled row.
 *
 * NO LABEL, and the absence is the treatment. Every other row on this surface
 * is a small uppercase word in a fixed column with one clamped line beside it,
 * so a message that starts at the row's own left edge and runs to its natural
 * length in full ink is already unmistakably a different kind of thing — the
 * word ASSISTANT over it only said again what the shape says, and cost the
 * message the first 62px of every line it wraps onto.
 */
export default function AssistantMessage({ entry, labels }) {
  const text = stringify_content(entry?.content)

  return (
    <TimelineEventRow
      modifier="assistant-message"
      body={<EntryBody entry={entry} text={text} labels={labels} />}
    />
  )
}

AssistantMessage.propTypes = {
  entry: PropTypes.object.isRequired,
  labels: labels_prop_type.isRequired
}
