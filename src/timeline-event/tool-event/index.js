import React from 'react'
import PropTypes from 'prop-types'

import TimelineEventRow from '../timeline-event-row.js'
import EntryBody from '../entry-body.js'
import {
  ENTRY_KIND,
  entry_kind,
  stringify_content,
  to_single_line,
  tool_argument_of,
  tool_error_of,
  tool_name_of,
  tool_result_of
} from '../../entry-shape.mjs'
import { labels_prop_type } from '../../labels.mjs'

import './tool-event.styl'

// How much of a tool argument the chip shows before the row offers to open.
//
// The chip is clamped to ONE LINE, so anything past roughly this many
// characters is not merely small, it is not rendered at all. Matching base's
// own tool header, which clamps at the same width, so the two surfaces truncate
// at the same place rather than at two arbitrary ones.
const CHIP_MAX_CHARACTERS = 100

/**
 * A tool exchange as one row: what was called, with what, and -- on demand --
 * what came back.
 *
 * `tool_call` carries `{tool_name, tool_parameters, tool_call_id,
 * execution_status}` and `tool_result` carries `{tool_call_id, result, error}`.
 * The two are paired upstream, so this renders the call and keeps the result
 * folded behind the row's disclosure.
 *
 * THE RESULT IS HIDDEN BY DEFAULT AND THE ERROR IS NOT. A failed call renders
 * through the error branch, labelled and coloured as one, with its text open --
 * a run that spent minutes retrying a broken tool looked like progress
 * precisely because nothing distinguished the two, and folding the failure away
 * behind a click would restore exactly that. Hiding output is a fix for volume;
 * it must not become a way to lose the one row that explains the run.
 *
 * THE ARGUMENT IS IN THE DISCLOSURE TOO, not only the result. The chip is one
 * line and these arguments are routinely a kilobyte of JSON on one line, so a
 * chip alone would truncate the thing the reader opened the row to read.
 */
export default function ToolEvent({
  entry,
  tool_result,
  labels,
  is_expandable,
  resolve_tool_name
}) {
  const [is_open, set_is_open] = React.useState(false)

  const kind = entry_kind(entry)

  // An orphan result -- one whose call never arrived. Rendered on its own so
  // the output is not lost, rather than folded into a row that does not exist.
  if (kind === ENTRY_KIND.TOOL_RESULT) {
    const orphan_error = tool_error_of(entry)
    return (
      <TimelineEventRow
        modifier={orphan_error ? 'tool-error' : 'tool-result'}
        label={orphan_error ? labels.tool_error : labels.tool_result}
        body={
          <EntryBody
            entry={entry}
            text={orphan_error || tool_result_of(entry)}
            labels={labels}
          />
        }
      />
    )
  }

  // The consumer gets first refusal on the name. It is the only side that can
  // improve on it: these agents reach their real tools THROUGH a generic one,
  // so two thirds of a run's rows are called `Bash` and the tool that actually
  // ran is a detail of the command. Resolving that here would put the
  // consumer's vocabulary in a package that must not carry any, so the package
  // asks and falls back to the honest generic name.
  const resolved_name =
    typeof resolve_tool_name === 'function' ? resolve_tool_name(entry) : null
  const name =
    (typeof resolved_name === 'string' && resolved_name) || tool_name_of(entry)
  const argument = tool_argument_of(entry) || stringify_content(entry?.content)
  const error = tool_error_of(tool_result)
  const result_text = tool_result ? tool_result_of(tool_result) : ''

  // An error is rendered inline instead of folded, so it is deliberately not
  // one of the reasons a row can open.
  const has_hidden_result = Boolean(!error && result_text)
  const is_argument_clipped =
    argument.length > CHIP_MAX_CHARACTERS || argument.includes('\n')
  const can_toggle = is_expandable && (has_hidden_result || is_argument_clipped)

  const detail =
    has_hidden_result || is_argument_clipped ? (
      <>
        {is_argument_clipped ? (
          <div className="rat-tool-section">
            <span className="rat-tool-caption">{labels.tool_call}</span>
            <div className="rat-tool-text">{argument}</div>
          </div>
        ) : null}
        {has_hidden_result ? (
          <div className="rat-tool-section">
            <span className="rat-tool-caption">{labels.tool_result}</span>
            <div className="rat-tool-text">{result_text}</div>
          </div>
        ) : null}
      </>
    ) : null

  return (
    <TimelineEventRow
      modifier={error ? 'tool-error' : 'tool-call'}
      label={<span className="rat-tool-name">{name || labels.tool_call}</span>}
      body={
        <EntryBody
          entry={entry}
          // Collapsed to one line HERE rather than by CSS alone, because the
          // chip's own ellipsis cannot help with an embedded newline: the row
          // would grow to the height of a here-doc while showing one line of
          // it, which is the row-overlap failure the row stylesheet exists to
          // prevent.
          text={to_single_line(argument)}
          labels={labels}
        />
      }
      is_expanded={is_open}
      on_toggle={can_toggle ? () => set_is_open((open) => !open) : undefined}
      toggle_title={is_open ? labels.hide_result : labels.show_result}
      detail={detail}
    />
  )
}

ToolEvent.propTypes = {
  entry: PropTypes.object.isRequired,
  // The `tool_result` entry this call produced, when one has arrived. Absent
  // for a call still in flight, which is every call's first seconds.
  tool_result: PropTypes.object,
  labels: labels_prop_type.isRequired,
  // Whether this row may open. False in the collapsed timeline, whose single
  // row is a status line rather than a control -- opening a result there would
  // break the one-line clamp that keeps the host panel from jumping.
  is_expandable: PropTypes.bool,
  // `(entry) => string | null`. Returning null or a non-string defers to the
  // entry's own `tool_name`, so a consumer only has to recognize the calls it
  // knows about.
  resolve_tool_name: PropTypes.func
}
