import React from 'react'
import PropTypes from 'prop-types'

import TimelineEvent from '../timeline-event/index.js'
import RunStatus from './run-status.js'
import {
  drop_repeated_system_entries,
  order_entries
} from './order-entries.mjs'
import {
  latest_row,
  pair_tool_entries,
  row_has_content
} from './pair-tool-entries.mjs'
import { format_duration } from '../format-duration.mjs'
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
  resolve_tool_argument,
  labels,
  className
}) {
  const resolved_labels = resolve_labels(labels)

  const ordered = React.useMemo(() => {
    const in_order = order_entries(entries)
    if (!hide_noise) return in_order
    // Both halves of the same job — a system row that says nothing, and a system
    // row that says what an earlier one already said. The repeat pass runs
    // second so it only ever sees rows that survived the noise patterns.
    return drop_repeated_system_entries(
      in_order.filter((entry) => !is_noise_system_entry(entry))
    )
  }, [entries, hide_noise])

  // Pairing runs over the FILTERED, ORDERED list, which is what makes the
  // positional half of the join sound: it walks the same sequence the reader
  // sees. Filtering afterwards could drop a call and leave its result behind as
  // an orphan row.
  //
  // A ROW WITH NOTHING IN IT IS NOT AN EVENT. An assistant entry whose text was
  // empty -- every message whose whole content was a tool use -- renders as the
  // word ASSISTANT on a blank line, which tells a reader that something
  // happened and nothing about what. The collapsed line has skipped these since
  // the day a run ended on two of them and the panel reported "System" and
  // nothing else; the expanded list kept drawing them, so the same empty entry
  // was a defect on one surface and a row on the other. `row_has_content` is
  // the predicate that decided it there, so it decides it here. A tool call
  // with no argument still passes it -- the tool's NAME is that row's content.
  const rows = React.useMemo(
    () => pair_tool_entries(ordered).filter(row_has_content),
    [ordered]
  )

  // Selected over ROWS, not entries, so the collapsed line can never be a bare
  // tool result -- a result is part of the call's row, never an event of its
  // own on either surface.
  const latest = React.useMemo(() => latest_row(rows), [rows])

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

  // Collapsed carries the row whole -- its result included, so an errored call
  // still colours the line -- but not expandable: a disclosure on a one-line
  // status is a control the reader cannot use without the panel growing.
  const visible = is_expanded ? rows : latest ? [latest] : []

  // Counted over ROWS rather than entries, so the control is offered only when
  // expanding actually shows more than the collapsed line already does. Against
  // the entry count it could promise a fuller run and open onto the same single
  // row, once results were folded into their calls and empty entries dropped.
  const can_toggle = Boolean(on_toggle_expanded) && rows.length > 1
  const has_footer =
    can_toggle || Boolean(duration_text) || is_running || tool_call_count > 0

  // The caption that says what the collapsed row IS. Without it the row is one
  // line of agent output under a panel, indistinguishable from a summary, a
  // heading or the whole run rendered short -- and a reader who takes it for any
  // of those reads a moving line as a static one. It is on the same line as the
  // row rather than above it, because the collapsed surface is a status line
  // and a second line would double the height of the thing it labels.
  const show_latest_caption = !is_expanded && visible.length > 0

  return (
    <div className={class_names.join(' ')}>
      {/* THE POSITIONING CONTEXT FOR THE JUMP CONTROL, and the only reason this
          wrapper exists. The control floats over the list, so it needs an
          ancestor that is neither the scroll container (it would scroll away
          with the content) nor the whole timeline (it would float over the
          footer). This element is exactly the list's box and does not scroll. */}
      <div className="rat-timeline-body">
        <div className="rat-timeline-entries" ref={scroll_ref}>
          {show_latest_caption ? (
            <span className="rat-timeline-latest">
              {resolved_labels.latest}
            </span>
          ) : null}
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
                resolve_tool_argument={resolve_tool_argument}
                labels={resolved_labels}
              />
            ))
          )}
        </div>

        {/* Offered only where it does something: the reader has scrolled away
            from the bottom and the newest entry is off screen. A permanently
            visible jump control over an already-pinned view says the view is not
            following when it is.

            IT FLOATS RATHER THAN SITTING IN FLOW, which is the whole of why the
            wrapper above exists. In flow it appeared and disappeared as the
            reader scrolled, and the panel it lives in grew and shrank by the
            control's own height underneath whatever they were reading — a
            control whose job is to steady the view was the thing moving it. */}
        {is_expanded && !is_pinned ? (
          <button
            type="button"
            className="rat-timeline-jump"
            onClick={scroll_to_bottom}
          >
            {resolved_labels.jump_to_latest}
          </button>
        ) : null}
      </div>

      {has_footer ? (
        <div className="rat-timeline-footer">
          {/* THE ONE CONTROL ON THE FOOTER, and it wears a button's chrome
              rather than a link's underline. It sits beside a tally and a clock
              that are both text, and as text itself the reader had to work out
              which of the three did something. The disclosure glyph is drawn by
              the stylesheet, so the button's own text stays exactly the word the
              consumer supplied. */}
          {can_toggle ? (
            <button
              type="button"
              className="rat-timeline-toggle"
              aria-expanded={Boolean(is_expanded)}
              onClick={on_toggle_expanded}
            >
              {is_expanded ? resolved_labels.collapse : resolved_labels.expand}
            </button>
          ) : null}

          {/* WHAT THE RUN COST, kept together and pushed away from the control.
              The tally and the clock are both readings ABOUT the run, and
              sitting them in the same group is what stops the footer from
              reading as three peers of which one happens to be pressable. */}
          <span className="rat-timeline-meta">
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
              <RunStatus
                started_at_ms={started_at_ms}
                labels={resolved_labels}
              />
            ) : duration_text ? (
              <span className="rat-timeline-duration">
                {resolved_labels.duration} {duration_text}
              </span>
            ) : null}
          </span>
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
  // `(entry) => [{ label, value }] | null`, the sibling seam for what the call
  // was made WITH. Same reason as the name: only the consumer knows which of
  // its tool's parameters identify a call.
  resolve_tool_argument: PropTypes.func,
  labels: labels_prop_type,
  className: PropTypes.string
}
