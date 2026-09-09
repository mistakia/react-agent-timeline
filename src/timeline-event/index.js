import React from 'react'
import PropTypes from 'prop-types'

import AssistantMessage from './assistant-message/index.js'
import UserMessage from './user-message/index.js'
import ThinkingMessage from './thinking-message/index.js'
import SystemMessage from './system-message/index.js'
import ToolEvent from './tool-event/index.js'
import GenericEvent from './generic-event/index.js'
import RedactedEvent from './redacted-event/index.js'
import { ENTRY_KIND, entry_kind, is_redacted_entry } from '../entry-shape.mjs'
import { labels_prop_type, resolve_labels } from '../labels.mjs'

const RENDERER_BY_KIND = {
  [ENTRY_KIND.ASSISTANT_MESSAGE]: AssistantMessage,
  [ENTRY_KIND.USER_MESSAGE]: UserMessage,
  [ENTRY_KIND.THINKING]: ThinkingMessage,
  [ENTRY_KIND.SYSTEM]: SystemMessage,
  [ENTRY_KIND.TOOL_CALL]: ToolEvent,
  [ENTRY_KIND.TOOL_RESULT]: ToolEvent,
  [ENTRY_KIND.GENERIC]: GenericEvent
}

/**
 * Per-type dispatch.
 *
 * Redaction is checked before type, and deliberately here rather than in each
 * renderer: a per-type renderer can forget the check, and the one that forgets
 * is the one that renders a permission failure as content.
 */
export default function TimelineEvent({
  entry,
  tool_result,
  is_expandable,
  resolve_tool_name,
  resolve_tool_argument,
  labels
}) {
  const resolved_labels = resolve_labels(labels)
  if (!entry) return null

  if (is_redacted_entry(entry)) {
    return <RedactedEvent entry={entry} labels={resolved_labels} />
  }

  const Renderer = RENDERER_BY_KIND[entry_kind(entry)] || GenericEvent
  return (
    <Renderer
      entry={entry}
      tool_result={tool_result}
      is_expandable={is_expandable}
      resolve_tool_name={resolve_tool_name}
      resolve_tool_argument={resolve_tool_argument}
      labels={resolved_labels}
    />
  )
}

TimelineEvent.propTypes = {
  entry: PropTypes.object,
  // Passed through to the tool renderer, which is the only one that reads it.
  // Handing it to every renderer keeps the dispatch table free of per-type
  // argument lists -- the renderers that do not read it ignore it.
  tool_result: PropTypes.object,
  is_expandable: PropTypes.bool,
  resolve_tool_name: PropTypes.func,
  resolve_tool_argument: PropTypes.func,
  labels: labels_prop_type
}
