import React from 'react'
import PropTypes from 'prop-types'

import './timeline-event-row.styl'

/**
 * The shared frame every per-type renderer draws inside: a label, a body, and
 * optionally a detail block behind a disclosure.
 *
 * Each renderer decides its own label and body content; the row owns nothing
 * type-specific. Keeping the frame here is what makes an unknown type degrade
 * to something that still looks like a timeline row rather than to nothing.
 *
 * THE DISCLOSURE MARKER IS A GLYPH, NOT AN ICON, and that is the house rule
 * rather than a preference -- this surface carries no iconography at all, so a
 * chevron would be the only one on the page. A monospace `+` / `−` in a
 * fixed-width slot keeps the label column aligned whether or not a given row
 * can expand, which a variable-width icon would not.
 */
export default function TimelineEventRow({
  label,
  body,
  meta,
  detail,
  modifier,
  is_muted,
  is_expanded,
  on_toggle,
  toggle_title
}) {
  const class_names = ['rat-event-row']
  if (modifier) class_names.push(`rat-event-row-${modifier}`)
  if (is_muted) class_names.push('rat-event-row-muted')
  if (on_toggle) class_names.push('rat-event-row-expandable')
  // Open versus revealable: `expandable` promises the row CAN open, `open` says
  // it HAS. The stylesheet pins `.rat-event-row-main` while its row is open so
  // a tall revealed result scrolling in the panel keeps the tool name in view.
  if (is_expanded) class_names.push('rat-event-row-open')

  const main = (
    <>
      {on_toggle ? (
        <span className="rat-event-marker" aria-hidden="true">
          {is_expanded ? '−' : '+'}
        </span>
      ) : null}
      {/* Omitted rather than rendered empty when a row has no label. The label
          is a fixed-width COLUMN, so an empty one indents the body of a row
          that has nothing to line up with — which is exactly the row that most
          wants the full width. */}
      {label ? <span className="rat-event-label">{label}</span> : null}
      <span className="rat-event-body">{body}</span>
      {/* A reading ABOUT the row, parked at its right edge. Rendered after the
          body so the body keeps every pixel the meta does not need — the meta
          is a handful of characters and the body is the thing being read. */}
      {meta ? <span className="rat-event-meta">{meta}</span> : null}
    </>
  )

  return (
    <div className={class_names.join(' ')}>
      {on_toggle ? (
        <button
          type="button"
          className="rat-event-row-main rat-event-row-toggle"
          aria-expanded={Boolean(is_expanded)}
          title={toggle_title}
          onClick={on_toggle}
        >
          {main}
        </button>
      ) : (
        <div className="rat-event-row-main">{main}</div>
      )}

      {is_expanded && detail ? (
        <div className="rat-event-detail">{detail}</div>
      ) : null}
    </div>
  )
}

TimelineEventRow.propTypes = {
  label: PropTypes.node,
  body: PropTypes.node,
  // A short reading about the row rather than part of it — a tool call's
  // elapsed time. Kept out of the body so it cannot be truncated away by the
  // one-line clamp, which is what would happen to anything appended there.
  meta: PropTypes.node,
  detail: PropTypes.node,
  modifier: PropTypes.string,
  is_muted: PropTypes.bool,
  is_expanded: PropTypes.bool,
  // Absent means the row cannot expand, which is what decides whether the
  // marker and the button wrapper exist at all. A row that rendered a disabled
  // control would promise something it cannot do.
  on_toggle: PropTypes.func,
  toggle_title: PropTypes.string
}
