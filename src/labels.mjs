// Every consumer-facing word the component can render.
//
// The package holds no domain vocabulary: a consumer overrides any subset of
// these and the rest fall back to neutral English. Defaults exist so a consumer
// can mount the component without supplying a label map, not because the
// package has an opinion about wording.

import PropTypes from 'prop-types'

export const DEFAULT_LABELS = {
  expand: 'Show full session',
  collapse: 'Show latest only',
  empty: 'No activity yet',
  jump_to_latest: 'Jump to latest',
  // Reads ahead of a formatted duration, as in `Took 1m 12s`.
  duration: 'Took',
  assistant: 'Assistant',
  user: 'You',
  thinking: 'Thinking',
  system: 'System',
  tool_call: 'Tool',
  tool_result: 'Result',
  tool_error: 'Tool error',
  unknown: 'Event',
  redacted: 'Hidden — you do not have access to this entry',
  elided: 'Content too large to display inline'
}

export const labels_prop_type = PropTypes.objectOf(PropTypes.string)

/** Merge a partial label map over the defaults. */
export function resolve_labels(labels) {
  return labels ? { ...DEFAULT_LABELS, ...labels } : DEFAULT_LABELS
}
