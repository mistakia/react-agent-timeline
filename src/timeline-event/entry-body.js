import React from 'react'
import PropTypes from 'prop-types'

import { is_elided_entry } from '../entry-shape.mjs'

/**
 * An entry's body text, with the elided case rendered as an explicit
 * affordance.
 *
 * Elided entries carry a self-describing placeholder in `content` naming the
 * media type and size, so that text is preferred over the generic label. The
 * failure this guards is rendering an elided entry as blank, which reads as an
 * empty message rather than as withheld content.
 */
export default function EntryBody({ entry, text, labels }) {
  if (!is_elided_entry(entry)) return <>{text}</>

  return <span className="rat-event-elided">{text || labels.elided}</span>
}

EntryBody.propTypes = {
  entry: PropTypes.object,
  text: PropTypes.string,
  labels: PropTypes.objectOf(PropTypes.string).isRequired
}
