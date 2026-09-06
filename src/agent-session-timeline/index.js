import React from 'react'
import PropTypes from 'prop-types'

import TimelineEvent from '../timeline-event/index.js'
import { latest_entry, order_entries } from './order-entries.mjs'
import { format_duration } from './format-duration.mjs'
import { use_stick_to_bottom } from './use-stick-to-bottom.js'
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
  duration_ms,
  labels,
  className
}) {
  const resolved_labels = resolve_labels(labels)
  const ordered = React.useMemo(() => order_entries(entries), [entries])
  const latest = React.useMemo(() => latest_entry(ordered), [ordered])

  // Expanded reads bottom-up like a message thread: the newest entry is at the
  // bottom and stays in view as the run proceeds, unless the reader scrolled up
  // to read something, in which case nothing moves under them.
  const { scroll_ref, is_pinned, scroll_to_bottom } = use_stick_to_bottom({
    is_active: is_expanded,
    content_key: ordered.length
  })

  const duration_text = format_duration(duration_ms)

  const class_names = ['rat-timeline']
  if (is_expanded) class_names.push('rat-timeline-expanded')
  if (className) class_names.push(className)

  const visible = is_expanded ? ordered : latest ? [latest] : []
  const can_toggle = Boolean(on_toggle_expanded) && ordered.length > 1
  const has_footer = can_toggle || Boolean(duration_text)

  return (
    <div className={class_names.join(' ')}>
      <div className="rat-timeline-entries" ref={scroll_ref}>
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

      {/* Offered only where it does something: the reader has scrolled away
          from the bottom and the newest entry is off screen. A permanently
          visible jump control over an already-pinned view says the view is not
          following when it is. */}
      {is_expanded && !is_pinned ? (
        <button
          type="button"
          className="rat-timeline-jump"
          onClick={scroll_to_bottom}
        >
          {resolved_labels.jump_to_latest}
        </button>
      ) : null}

      {has_footer ? (
        <div className="rat-timeline-footer">
          {can_toggle ? (
            <button
              type="button"
              className="rat-timeline-toggle"
              onClick={on_toggle_expanded}
            >
              {is_expanded ? resolved_labels.collapse : resolved_labels.expand}
            </button>
          ) : null}

          {duration_text ? (
            <span className="rat-timeline-duration">
              {resolved_labels.duration} {duration_text}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

AgentSessionTimeline.propTypes = {
  entries: PropTypes.array,
  is_expanded: PropTypes.bool,
  on_toggle_expanded: PropTypes.func,
  // How long the run took, in milliseconds. Computed by the consumer, which is
  // the only side that knows what started and finished the run; the package
  // renders what it is handed and nothing when it is handed nothing.
  duration_ms: PropTypes.number,
  labels: labels_prop_type,
  className: PropTypes.string
}
