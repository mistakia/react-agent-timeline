import React from 'react'
import PropTypes from 'prop-types'

import TimelineEventRow from '../timeline-event-row.jsx'
import EntryBody from '../entry-body.jsx'
import { stringify_content } from '../../entry-shape.mjs'
import { labels_prop_type } from '../../labels.mjs'

import './generic-event.styl'

/**
 * The fallback for an entry type this package has never heard of.
 *
 * Base's timeline schema gains types over time and this package is pinned by
 * SHA in each consumer, so a consumer will at some point receive a type newer
 * than its pin. Degrading to the entry's own type name and serialized content
 * keeps the run legible; throwing would blank the whole panel over one row.
 */
export default function GenericEvent({ entry, labels }) {
  const type = typeof entry?.type === 'string' && entry.type ? entry.type : null

  return (
    <TimelineEventRow
      modifier="generic"
      label={type || labels.unknown}
      body={
        <EntryBody
          entry={entry}
          text={stringify_content(entry?.content)}
          labels={labels}
        />
      }
    />
  )
}

GenericEvent.propTypes = {
  entry: PropTypes.object.isRequired,
  labels: labels_prop_type.isRequired
}
