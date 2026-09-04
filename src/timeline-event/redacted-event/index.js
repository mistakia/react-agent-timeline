import React from 'react'
import PropTypes from 'prop-types'

import TimelineEventRow from '../timeline-event-row.js'
import { labels_prop_type } from '../../labels.mjs'

import './redacted-event.styl'

/**
 * A masked entry, rendered as withheld rather than as content.
 *
 * This is the load-bearing one. A caller without read permission receives a
 * structurally valid timeline: same entry count, same types, same ordering,
 * with the content char-masked. Rendering the mask as ordinary text would make
 * a permission failure look like a quiet run — the read path fails by masking,
 * not by erroring, so the component is where that becomes visible.
 */
export default function RedactedEvent({ entry, labels }) {
  return (
    <TimelineEventRow
      modifier="redacted"
      label={entry?.type || labels.unknown}
      is_muted
      body={<span className="rat-event-redacted">{labels.redacted}</span>}
    />
  )
}

RedactedEvent.propTypes = {
  entry: PropTypes.object,
  labels: labels_prop_type.isRequired
}
