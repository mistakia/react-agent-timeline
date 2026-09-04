import React from 'react'
import PropTypes from 'prop-types'

import TimelineEventRow from '../timeline-event-row.js'
import EntryBody from '../entry-body.js'
import { stringify_content } from '../../entry-shape.mjs'
import { labels_prop_type } from '../../labels.mjs'

import './system-message.styl'

export default function SystemMessage({ entry, labels }) {
  const text = stringify_content(entry?.content)

  return (
    <TimelineEventRow
      modifier="system-message"
      label={labels.system}
      is_muted
      body={<EntryBody entry={entry} text={text} labels={labels} />}
    />
  )
}

SystemMessage.propTypes = {
  entry: PropTypes.object.isRequired,
  labels: labels_prop_type.isRequired
}
