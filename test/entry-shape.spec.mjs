import { expect } from 'chai'

import {
  ENTRY_KIND,
  entry_kind,
  entry_summary_text,
  is_elided_entry,
  is_redacted_entry,
  stringify_content,
  to_single_line,
  tool_error_of,
  tool_name_of
} from '../src/entry-shape.mjs'

describe('entry_kind', () => {
  it('splits message by role', () => {
    expect(entry_kind({ type: 'message', role: 'assistant' })).to.equal(
      ENTRY_KIND.ASSISTANT_MESSAGE
    )
    expect(entry_kind({ type: 'message', role: 'user' })).to.equal(
      ENTRY_KIND.USER_MESSAGE
    )
  })

  it('maps each remaining schema type', () => {
    expect(entry_kind({ type: 'thinking' })).to.equal(ENTRY_KIND.THINKING)
    expect(entry_kind({ type: 'system' })).to.equal(ENTRY_KIND.SYSTEM)
    expect(entry_kind({ type: 'tool_call' })).to.equal(ENTRY_KIND.TOOL_CALL)
    expect(entry_kind({ type: 'tool_result' })).to.equal(ENTRY_KIND.TOOL_RESULT)
  })

  it('resolves an unknown or missing type to generic rather than throwing', () => {
    expect(entry_kind({ type: 'invented' })).to.equal(ENTRY_KIND.GENERIC)
    expect(entry_kind({})).to.equal(ENTRY_KIND.GENERIC)
    expect(entry_kind(null)).to.equal(ENTRY_KIND.GENERIC)
  })
})

describe('stringify_content', () => {
  it('passes strings through', () => {
    expect(stringify_content('plain')).to.equal('plain')
  })

  it('serializes objects rather than coercing them to [object Object]', () => {
    expect(stringify_content({ a: 1 })).to.contain('"a": 1')
  })

  it('renders absent content as an empty string', () => {
    expect(stringify_content(null)).to.equal('')
    expect(stringify_content(undefined)).to.equal('')
  })
})

describe('tool accessors', () => {
  it('reads a tool name', () => {
    expect(
      tool_name_of({ type: 'tool_call', content: { tool_name: 'Read' } })
    ).to.equal('Read')
    expect(tool_name_of({ type: 'tool_call', content: {} })).to.equal(null)
  })

  it('treats an absent, null or empty error as success', () => {
    expect(tool_error_of({ content: { error: null } })).to.equal(null)
    expect(tool_error_of({ content: { error: '' } })).to.equal(null)
    expect(tool_error_of({ content: {} })).to.equal(null)
  })

  it('reads a real error', () => {
    expect(tool_error_of({ content: { error: 'boom' } })).to.equal('boom')
  })
})

describe('degraded-shape flags', () => {
  it('is strict about the flags rather than truthy', () => {
    expect(is_redacted_entry({ is_redacted: true })).to.equal(true)
    expect(is_redacted_entry({ is_redacted: 'no' })).to.equal(false)
    expect(is_redacted_entry({})).to.equal(false)
    expect(is_elided_entry({ content_elided: true })).to.equal(true)
    expect(is_elided_entry({})).to.equal(false)
  })
})

describe('entry_summary_text', () => {
  it('summarizes a tool_call by its tool name', () => {
    expect(
      entry_summary_text({ type: 'tool_call', content: { tool_name: 'Bash' } })
    ).to.equal('Bash')
  })

  it('prefers a tool_result error over its result', () => {
    expect(
      entry_summary_text({
        type: 'tool_result',
        content: { result: 'ok', error: 'failed' }
      })
    ).to.equal('failed')
  })

  it('summarizes a message by its content', () => {
    expect(
      entry_summary_text({ type: 'message', role: 'user', content: 'hello' })
    ).to.equal('hello')
  })
})

describe('to_single_line', () => {
  it('collapses whitespace so a multi-line body reads as one row', () => {
    expect(to_single_line('a\n\n  b\tc ')).to.equal('a b c')
    expect(to_single_line(null)).to.equal('')
  })
})
