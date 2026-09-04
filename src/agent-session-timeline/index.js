import React from 'react'
import PropTypes from 'prop-types'

import TimelineEvent from '../timeline-event/index.js'
import { latest_entry, order_entries } from './order-entries.mjs'
import { labels_prop_type, resolve_labels } from '../labels.mjs'

import './agent-session-timeline.styl'

/**
 * An agent session timeline: collapsed to the latest event by default,
 * expandable to the full run.
 *
 * Presentational only — props in, JSX out. The consumer owns fetching,
 * expansion state and every word rendered.
 *
 * The collapsed row is derived from `entries` rather than taken as a separate
 * summary prop, so the collapsed and expanded renderings cannot disagree, and
 * it advances by ordering-then-timestamp rather than by array position. A
 * backfill overlapping a live tail arrives out of order, and taking the last
 * element would show whichever copy landed last.
 */
export default function AgentSessionTimeline({
  entries,
  is_expanded = false,
  on_toggle_expanded,
  labels,
  className
}) {
  const resolved_labels = resolve_labels(labels)
  const ordered = React.useMemo(() => order_entries(entries), [entries])
  const latest = React.useMemo(() => latest_entry(ordered), [ordered])

  const class_names = ['rat-timeline']
  if (is_expanded) class_names.push('rat-timeline-expanded')
  if (className) class_names.push(className)

  const visible = is_expanded ? ordered : latest ? [latest] : []

  return (
    <div className={class_names.join(' ')}>
      <div className="rat-timeline-entries">
        {visible.length === 0 ? (
          <div className="rat-timeline-empty">{resolved_labels.empty}</div>
        ) : (
          visible.map((entry, index) => (
            <TimelineEvent
              key={entry.id ?? `rat-entry-${index}`}
              entry={entry}
              labels={resolved_labels}
            />
          ))
        )}
      </div>

      {on_toggle_expanded && ordered.length > 1 ? (
        <button
          type="button"
          className="rat-timeline-toggle"
          onClick={on_toggle_expanded}
        >
          {is_expanded ? resolved_labels.collapse : resolved_labels.expand}
        </button>
      ) : null}
    </div>
  )
}

AgentSessionTimeline.propTypes = {
  entries: PropTypes.array,
  is_expanded: PropTypes.bool,
  on_toggle_expanded: PropTypes.func,
  labels: labels_prop_type,
  className: PropTypes.string
}
