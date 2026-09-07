import React from 'react'
import PropTypes from 'prop-types'

import TimelineEvent from '../timeline-event/index.js'
import RunStatus from './run-status.js'
import { latest_entry, order_entries } from './order-entries.mjs'
import { pair_tool_entries } from './pair-tool-entries.mjs'
import { format_duration } from './format-duration.mjs'
import { use_stick_to_bottom } from './use-stick-to-bottom.js'
import {
  ENTRY_KIND,
  entry_kind,
  is_noise_system_entry
} from '../entry-shape.mjs'
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
  started_at_ms,
  is_running = false,
  hide_noise = true,
  resolve_tool_name,
  labels,
  className
}) {
  const resolved_labels = resolve_labels(labels)

  const ordered = React.useMemo(() => {
    const in_order = order_entries(entries)
    if (!hide_noise) return in_order
    return in_order.filter((entry) => !is_noise_system_entry(entry))
  }, [entries, hide_noise])

  // Pairing runs over the FILTERED, ORDERED list, which is what makes the
  // positional half of the join sound: it walks the same sequence the reader
  // sees. Filtering afterwards could drop a call and leave its result behind as
  // an orphan row.
  const rows = React.useMemo(() => pair_tool_entries(ordered), [ordered])

  const latest = React.useMemo(() => latest_entry(ordered), [ordered])

  const tool_call_count = React.useMemo(
    () =>
      ordered.filter((entry) => entry_kind(entry) === ENTRY_KIND.TOOL_CALL)
        .length,
    [ordered]
  )

  // Expanded reads bottom-up like a message thread: the newest entry is at the
  // bottom and stays in view as the run proceeds, unless the reader scrolled up
  // to read something, in which case nothing moves under them.
  const { scroll_ref, is_pinned, scroll_to_bottom } = use_stick_to_bottom({
    is_active: is_expanded,
    content_key: rows.length
  })

  const duration_text = format_duration(duration_ms)

  const class_names = ['rat-timeline']
  if (is_expanded) class_names.push('rat-timeline-expanded')
  if (className) class_names.push(className)

  // Collapsed shows the newest entry as an unpaired row: it is a status line,
  // and a disclosure on a one-line status is a control the reader cannot use
  // without the panel growing.
  const visible = is_expanded
    ? rows
    : latest
      ? [{ entry: latest, tool_result: null }]
      : []

  const can_toggle = Boolean(on_toggle_expanded) && ordered.length > 1
  const has_footer =
    can_toggle || Boolean(duration_text) || is_running || tool_call_count > 0

  return (
    <div className={class_names.join(' ')}>
      <div className="rat-timeline-entries" ref={scroll_ref}>
        {visible.length === 0 ? (
          <div className="rat-timeline-empty">{resolved_labels.empty}</div>
        ) : (
          visible.map((row, index) => (
            <TimelineEvent
              key={row.entry.id ?? `rat-entry-${index}`}
              entry={row.entry}
              tool_result={row.tool_result}
              is_expandable={is_expanded}
              resolve_tool_name={resolve_tool_name}
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

          {tool_call_count > 0 ? (
            <span className="rat-timeline-count">
              {tool_call_count}{' '}
              {tool_call_count === 1
                ? resolved_labels.tool_call_one
                : resolved_labels.tool_call_many}
            </span>
          ) : null}

          {/* A run is either going or it is over, so the live counter and the
              final duration are the same slot rather than two. Rendering both
              would put a frozen number beside a moving one. */}
          {is_running ? (
            <RunStatus started_at_ms={started_at_ms} labels={resolved_labels} />
          ) : duration_text ? (
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
  // When the run started, as epoch milliseconds. Read only while `is_running`,
  // to drive the live elapsed counter.
  started_at_ms: PropTypes.number,
  is_running: PropTypes.bool,
  // Whether to drop harness bookkeeping entries. Defaulted ON because they are
  // just under half of a real timeline and none of them is something the agent
  // did; a consumer wanting the raw record turns it off.
  hide_noise: PropTypes.bool,
  // `(entry) => string | null`, letting the consumer name a tool the entry
  // reports generically. See ToolEvent for why the package cannot do this.
  resolve_tool_name: PropTypes.func,
  labels: labels_prop_type,
  className: PropTypes.string
}
