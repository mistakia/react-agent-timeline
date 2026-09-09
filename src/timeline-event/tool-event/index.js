import React from 'react'
import PropTypes from 'prop-types'

import TimelineEventRow from '../timeline-event-row.js'
import EntryBody from '../entry-body.js'
import {
  ENTRY_KIND,
  entry_kind,
  normalize_tool_fields,
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

// The shell banner underneath a genuinely-shell row. A bash prompt is `$`, and
// putting it in the text (rather than on a pseudo-element) lets the clamped
// chip and the full reveal read as one command.
const BASH_PROMPT = '$ '

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
 *
 * THE CONSUMER GETS FIRST REFUSAL ON THE ARGUMENT AS WELL AS THE NAME. Given
 * fields, the chip shows those instead of the parameter guess -- a catalog
 * search reads as its query and its grain rather than as the shell line it was
 * invoked through -- and the raw invocation moves into the disclosure.
 *
 * A BASH ROW THAT RESOLVES TO NO TOOL IS READ AS A SHELL COMMAND, NOT AS A
 * NAMED TOOL. Its label is lowercase `bash` and its prompt heads the command.
 * A bash row the consumer DOES name keeps that name and the same chip, because
 * naming it is the consumer saying "this command is a real tool".
 */
export default function ToolEvent({
  entry,
  tool_result,
  labels,
  is_expandable,
  resolve_tool_name,
  resolve_tool_argument
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

  const recorded_name = tool_name_of(entry)

  // The consumer gets first refusal on the name. It is the only side that can
  // improve on it: these agents reach their real tools THROUGH a generic one,
  // so two thirds of a run's rows are called `Bash` and the tool that actually
  // ran is a detail of the command. Resolving that here would put the
  // consumer's vocabulary in a package that must not carry any, so the package
  // asks and falls back to the honest generic name.
  const resolved_name =
    typeof resolve_tool_name === 'function' ? resolve_tool_name(entry) : null
  const name =
    (typeof resolved_name === 'string' && resolved_name) ||
    (recorded_name === 'Bash' ? 'bash' : recorded_name)
  const argument = tool_argument_of(entry) || stringify_content(entry?.content)
  const error = tool_error_of(tool_result)
  const result_text = tool_result ? tool_result_of(tool_result) : ''

  // A bash row the consumer leaves unresolved is a shell command. The label
  // already says so; the prompt heads the command in the chip and the reveal.
  const name_was_resolved =
    typeof resolved_name === 'string' && resolved_name.length > 0
  const is_shell = recorded_name === 'Bash' && !name_was_resolved
  const argument_text = is_shell ? `${BASH_PROMPT}${argument}` : argument

  // What the consumer says identifies this call, when it recognizes it. Null
  // for a tool it does not know, and the package's own guess stands.
  //
  // THE SEAM IS ASKED FOR THE SURFACE IT IS RENDERING ON, not only for the
  // entry. A tool call that produced something reads differently collapsed (a
  // one-line status, where the outcome is what happened) than it does in the
  // expanded list (where the reader can open the row and the request is what
  // it was about). The consumer decides which its tools want; the package only
  // hands it the paired result and which half of the surface it is standing on.
  const fields = normalize_tool_fields(
    typeof resolve_tool_argument === 'function'
      ? resolve_tool_argument(entry, {
          tool_result,
          is_collapsed: !is_expandable
        })
      : null
  )

  // An error is rendered inline instead of folded, so it is deliberately not
  // one of the reasons a row can open.
  const has_hidden_result = Boolean(!error && result_text)
  // WITH FIELDS THE CHIP IS A SUMMARY, so the raw argument goes in the
  // disclosure unconditionally rather than only when it is too long for a line.
  // The fields are a reading OF the invocation, and a reader who wants to check
  // that reading against what actually ran must be able to reach it.
  const is_argument_clipped =
    argument_text.length > CHIP_MAX_CHARACTERS || argument_text.includes('\n')
  const show_argument_detail = Boolean(fields) || is_argument_clipped
  const can_toggle =
    is_expandable && (has_hidden_result || show_argument_detail)

  const detail =
    has_hidden_result || show_argument_detail ? (
      <>
        {show_argument_detail ? (
          <div className="rat-tool-section">
            {/* THE CAPTION NAMES THE BLOCK, AND ONLY A NAMED TOOL EARNS ONE.
                An unresolved bash row's reveal holds a shell invocation, not a
                tool, and "Tool" above it would call the shell line what it is
                not. The row's label already says `bash`; the command needs no
                caption of its own. */}
            {name_was_resolved ? (
              <span className="rat-tool-caption">{labels.tool_call}</span>
            ) : null}
            <div className="rat-tool-text">{argument_text}</div>
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
      modifier={error ? 'tool-error' : is_shell ? 'tool-bash' : 'tool-call'}
      label={<span className="rat-tool-name">{name || labels.tool_call}</span>}
      body={
        fields ? (
          <span className="rat-tool-fields">
            {fields.map((field, index) => (
              <span className="rat-tool-field" key={field.label ?? index}>
                {field.label ? (
                  <span className="rat-tool-field-label">{field.label}</span>
                ) : null}
                <span
                  className={
                    'rat-tool-field-value' +
                    (field.tone === 'error'
                      ? ' rat-tool-field-value--error'
                      : '')
                  }
                >
                  {to_single_line(field.value)}
                </span>
              </span>
            ))}
          </span>
        ) : (
          <EntryBody
            entry={entry}
            // Collapsed to one line HERE rather than by CSS alone, because the
            // chip's own ellipsis cannot help with an embedded newline: the row
            // would grow to the height of a here-doc while showing one line of
            // it, which is the row-overlap failure the row stylesheet exists to
            // prevent.
            text={to_single_line(argument_text)}
            labels={labels}
          />
        )
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
  resolve_tool_name: PropTypes.func,
  // `(entry, context) => [{ label, value, tone }] | null`. The same contract
  // for the ARGUMENT: the fields that identify this call, in the order a reader
  // should read them. `context` is `{ tool_result, is_collapsed }` — the paired
  // result when one has arrived, and which half of the surface is rendering —
  // so a consumer can read the outcome of its own tools and pick the collapsed
  // line's message. `tone: 'error'` spends the accent on the value. Anything
  // else defers to the package's own guess.
  resolve_tool_argument: PropTypes.func
}
