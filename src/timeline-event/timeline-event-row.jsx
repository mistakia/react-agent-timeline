import React from 'react'
import PropTypes from 'prop-types'

import './timeline-event-row.styl'

/**
 * The shared frame every per-type renderer draws inside: a label and a body.
 *
 * Each renderer decides its own label and body content; the row owns nothing
 * type-specific. Keeping the frame here is what makes an unknown type degrade
 * to something that still looks like a timeline row rather than to nothing.
 */
export default function TimelineEventRow({ label, body, modifier, is_muted }) {
  const class_names = ['rat-event-row']
  if (modifier) class_names.push(`rat-event-row-${modifier}`)
  if (is_muted) class_names.push('rat-event-row-muted')

  return (
    <div className={class_names.join(' ')}>
      <span className="rat-event-label">{label}</span>
      <span className="rat-event-body">{body}</span>
    </div>
  )
}

TimelineEventRow.propTypes = {
  label: PropTypes.node,
  body: PropTypes.node,
  modifier: PropTypes.string,
  is_muted: PropTypes.bool
}
