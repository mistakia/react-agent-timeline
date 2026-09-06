// How long a run took, rendered the way a person would say it.
//
// The package formats a duration it is HANDED and never computes one: deriving
// it would mean knowing what a run is, when it started and what finished it,
// which is the consumer's job. Passing the number in is also what keeps the
// component honest about a resumed run, where wall-clock arithmetic in the
// browser would count the time the tab was closed.

const SECOND_MS = 1000
const MINUTE_MS = 60 * SECOND_MS
const HOUR_MS = 60 * MINUTE_MS

/**
 * A duration in milliseconds as a short human string, or null when there is
 * nothing to render.
 *
 * Null rather than a placeholder for an absent or nonsensical value, so the
 * caller renders no duration at all instead of `0s` — a run whose duration the
 * server never recorded did not take no time.
 *
 * Sub-minute durations keep one decimal below ten seconds, because most of
 * these runs are seconds long and `4s` versus `4.2s` is the whole resolution of
 * the measurement at that scale. Above a minute the seconds are dropped from
 * the hour case: nobody reads `1h 3m 12s`.
 */
export function format_duration(duration_ms) {
  if (!Number.isFinite(duration_ms) || duration_ms < 0) return null

  if (duration_ms >= HOUR_MS) {
    const hours = Math.floor(duration_ms / HOUR_MS)
    const minutes = Math.round((duration_ms % HOUR_MS) / MINUTE_MS)
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
  }

  if (duration_ms >= MINUTE_MS) {
    const minutes = Math.floor(duration_ms / MINUTE_MS)
    const seconds = Math.round((duration_ms % MINUTE_MS) / SECOND_MS)
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`
  }

  const seconds = duration_ms / SECOND_MS
  if (seconds < 10) return `${Math.round(seconds * 10) / 10}s`
  return `${Math.round(seconds)}s`
}
