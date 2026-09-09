import React from 'react'
import PropTypes from 'prop-types'

import { format_duration } from '../format-duration.mjs'
import { labels_prop_type } from '../labels.mjs'

import './run-status.styl'

// How often the elapsed reading is recomputed.
//
// 100ms because `format_duration` keeps one decimal below ten seconds, and a
// tenths place that advances in whole-second jumps reads as a broken clock
// rather than as a coarse one. Above ten seconds the formatter rounds to whole
// seconds and most of these ticks change nothing, which costs a re-render of
// this component alone -- it holds its own state precisely so a ticking clock
// never re-renders the entry list behind it.
const TICK_MS = 100

/**
 * A run that is still going: a shimmering label and how long it has been going
 * for.
 *
 * THIS IS THE ONE PLACE THE PACKAGE COMPUTES A DURATION, and the rule it bends
 * is worth stating rather than quietly breaking. `duration_ms` is rendered and
 * never computed, because only the consumer knows what started and finished a
 * run. A LIVE counter cannot work that way -- nothing finished it yet -- so the
 * consumer hands over `started_at_ms`, an absolute epoch, and the package
 * subtracts. The absolute epoch is what keeps this honest across a reload: a
 * component that counted from its own mount would restart at zero on every
 * refresh and report a fifteen-minute run as four seconds old.
 *
 * There is deliberately no progress bar. A run has a deadline but no measurable
 * progress toward it, and a bar that advances on a timer claims otherwise.
 */
export default function RunStatus({ started_at_ms, labels }) {
  const [now_ms, set_now_ms] = React.useState(() => Date.now())

  React.useEffect(() => {
    if (!Number.isFinite(started_at_ms)) return undefined

    const tick = setInterval(() => set_now_ms(Date.now()), TICK_MS)
    return () => clearInterval(tick)
  }, [started_at_ms])

  const elapsed_text = Number.isFinite(started_at_ms)
    ? format_duration(now_ms - started_at_ms)
    : null

  return (
    <span className="rat-run-status" role="status">
      <span className="rat-run-status-label">{labels.running}</span>
      {elapsed_text ? (
        <span className="rat-run-status-elapsed">{elapsed_text}</span>
      ) : null}
    </span>
  )
}

RunStatus.propTypes = {
  // When the run started, as epoch milliseconds. Absent renders the label
  // alone -- a run whose start the server never recorded is still running, and
  // a counter from an unknown origin would be a made-up number.
  started_at_ms: PropTypes.number,
  labels: labels_prop_type.isRequired
}
