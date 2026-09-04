import React from 'react'
import PropTypes from 'prop-types'

import TimelineEventRow from '../timeline-event-row.js'
import EntryBody from '../entry-body.js'
import {
  ENTRY_KIND,
  entry_kind,
  stringify_content,
  tool_error_of,
  tool_name_of
} from '../../entry-shape.mjs'
import { labels_prop_type } from '../../labels.mjs'

import './tool-event.styl'

/**
 * Renders both halves of a tool exchange. `tool_call` carries
 * `{tool_name, tool_parameters, tool_call_id, execution_status}` and
 * `tool_result` carries `{tool_call_id, result, error}`, so the two share a
 * content shape family and differ only in which fields matter.
 *
 * A failed result renders through the error branch rather than as ordinary
 * output — a run that spent minutes retrying a broken tool looked like progress
 * precisely because nothing distinguished the two.
 */
export default function ToolEvent({ entry, labels }) {
  const kind = entry_kind(entry)

  if (kind === ENTRY_KIND.TOOL_CALL) {
    const name = tool_name_of(entry)
    const parameters = entry?.content?.tool_parameters

    return (
      <TimelineEventRow
        modifier="tool-call"
        label={labels.tool_call}
        body={
          <EntryBody
            entry={entry}
            text={
              name
                ? `${name}${parameters ? ` ${stringify_content(parameters)}` : ''}`
                : stringify_content(entry?.content)
            }
            labels={labels}
          />
        }
      />
    )
  }

  const error = tool_error_of(entry)

  return (
    <TimelineEventRow
      modifier={error ? 'tool-error' : 'tool-result'}
      label={error ? labels.tool_error : labels.tool_result}
      body={
        <EntryBody
          entry={entry}
          text={error || stringify_content(entry?.content?.result)}
          labels={labels}
        />
      }
    />
  )
}

ToolEvent.propTypes = {
  entry: PropTypes.object.isRequired,
  labels: labels_prop_type.isRequired
}
