import React from 'react'
import PropTypes from 'prop-types'

import TimelineEventRow from '../timeline-event-row.jsx'
import EntryBody from '../entry-body.jsx'
import { stringify_content } from '../../entry-shape.mjs'
import { labels_prop_type } from '../../labels.mjs'

import './assistant-message.styl'

export default function AssistantMessage({ entry, labels }) {
  const text = stringify_content(entry?.content)

  return (
    <TimelineEventRow
      modifier="assistant-message"
      label={labels.assistant}
      body={<EntryBody entry={entry} text={text} labels={labels} />}
    />
  )
}

AssistantMessage.propTypes = {
  entry: PropTypes.object.isRequired,
  labels: labels_prop_type.isRequired
}
