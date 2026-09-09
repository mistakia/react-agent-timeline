import React from 'react'
import PropTypes from 'prop-types'

import MessageRow from '../message-row.js'
import { labels_prop_type } from '../../labels.mjs'

import './system-message.styl'

export default function SystemMessage({ entry, labels, is_expandable }) {
  return (
    <MessageRow
      entry={entry}
      labels={labels}
      is_expandable={is_expandable}
      modifier="system-message"
      label={labels.system}
      is_muted
    />
  )
}

SystemMessage.propTypes = {
  entry: PropTypes.object.isRequired,
  labels: labels_prop_type.isRequired,
  is_expandable: PropTypes.bool
}
