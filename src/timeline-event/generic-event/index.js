import React from 'react'
import PropTypes from 'prop-types'

import MessageRow from '../message-row.js'
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
export default function GenericEvent({ entry, labels, is_expandable }) {
  const type = typeof entry?.type === 'string' && entry.type ? entry.type : null

  return (
    <MessageRow
      entry={entry}
      labels={labels}
      is_expandable={is_expandable}
      modifier="generic"
      label={type || labels.unknown}
    />
  )
}

GenericEvent.propTypes = {
  entry: PropTypes.object.isRequired,
  labels: labels_prop_type.isRequired,
  is_expandable: PropTypes.bool
}
