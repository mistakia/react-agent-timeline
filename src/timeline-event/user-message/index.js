import React from 'react'
import PropTypes from 'prop-types'

import MessageRow from '../message-row.js'
import { labels_prop_type } from '../../labels.mjs'

import './user-message.styl'

export default function UserMessage({ entry, labels, is_expandable }) {
  return (
    <MessageRow
      entry={entry}
      labels={labels}
      is_expandable={is_expandable}
      modifier="user-message"
      label={labels.user}
    />
  )
}

UserMessage.propTypes = {
  entry: PropTypes.object.isRequired,
  labels: labels_prop_type.isRequired,
  is_expandable: PropTypes.bool
}
