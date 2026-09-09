import React from 'react'
import { expect } from 'chai'

import TimelineEvent from '../src/timeline-event/index.js'
import { split_path_tail, tool_path_of } from '../src/entry-shape.mjs'
import { render } from './helpers/render.jsx'

const ordering = (index) => ({ timeline_index: index, timeline_epoch: 0 })

const read_entry = (file_path) => ({
  id: 'read-1',
  type: 'tool_call',
  content: {
    tool_name: 'Read',
    tool_call_id: 'call-1',
    tool_parameters: { file_path }
  },
  ordering: ordering(1)
})

describe('split_path_tail', () => {
  it('keeps the file and the directory above it, eliding the rest', () => {
    expect(
      split_path_tail('/Users/someone/work/repo/src/timeline-event/index.js')
    ).to.deep.equal({ prefix: '…/timeline-event/', name: 'index.js' })
  })

  it('elides nothing when the path is already short', () => {
    expect(split_path_tail('src/index.js')).to.deep.equal({
      prefix: 'src/',
      name: 'index.js'
    })
  })

  // An absolute path short enough to fit keeps its leading slash rather than
  // gaining an ellipsis, so a reader can tell a whole path from a shortened one.
  it('marks a short absolute path as absolute, not as elided', () => {
    expect(split_path_tail('/etc/hosts')).to.deep.equal({
      prefix: '/etc/',
      name: 'hosts'
    })
    expect(split_path_tail('/hosts')).to.deep.equal({
      prefix: '/',
      name: 'hosts'
    })
  })

  it('renders a bare filename with no prefix at all', () => {
    expect(split_path_tail('README.md')).to.deep.equal({
      prefix: '',
      name: 'README.md'
    })
  })

  it('returns null for an empty path rather than an empty pair', () => {
    expect(split_path_tail('')).to.equal(null)
    expect(split_path_tail(null)).to.equal(null)
  })
})

describe('tool_path_of', () => {
  it('reads a file_path argument as a path', () => {
    expect(tool_path_of(read_entry('/a/b/c.js'))).to.equal('/a/b/c.js')
  })

  // THE CONTROL FOR THE RULE THAT MATTERS. A search call carries a path too,
  // and it is not what the row is about; without this the row would name the
  // directory the search ran in instead of the pattern it searched for.
  it('returns null when a more identifying parameter won', () => {
    const grep = {
      type: 'tool_call',
      content: {
        tool_name: 'Grep',
        tool_parameters: { pattern: 'row_grain', path: '/a/b' }
      }
    }
    expect(tool_path_of(grep)).to.equal(null)
  })

  it('returns null for a call carrying no path at all', () => {
    expect(
      tool_path_of({
        type: 'tool_call',
        content: { tool_name: 'Bash', tool_parameters: { command: 'ls' } }
      })
    ).to.equal(null)
  })
})

describe('a file read renders as the file, not as the machine it is on', () => {
  const long_path =
    '/Users/someone/work/repo/app/views/components/view-generation-control/index.js'

  it('puts the filename on the row and sets the directories back', () => {
    const view = render(<TimelineEvent entry={read_entry(long_path)} />)

    const name = view.container.querySelector('.rat-tool-path-name')
    const prefix = view.container.querySelector('.rat-tool-path-prefix')

    expect(name.textContent).to.equal('index.js')
    expect(prefix.textContent).to.equal('…/view-generation-control/')
    // The home directory and the repository root -- the bytes every row of a
    // run shares -- are off the line entirely.
    expect(view.text()).to.not.contain('/Users/someone')

    view.unmount()
  })

  it('carries the whole path on the row so nothing is lost', () => {
    const view = render(<TimelineEvent entry={read_entry(long_path)} />)

    expect(
      view.container.querySelector('.rat-tool-path').getAttribute('title')
    ).to.equal(long_path)

    view.unmount()
  })

  // The control. A shell row is a command, not a path, and must keep rendering
  // as the command it ran.
  it('leaves a shell command alone', () => {
    const view = render(
      <TimelineEvent
        entry={{
          type: 'tool_call',
          content: {
            tool_name: 'Bash',
            tool_parameters: { command: 'node scripts/thing.mjs --year 2026' }
          },
          ordering: ordering(1)
        }}
      />
    )

    expect(view.container.querySelector('.rat-tool-path')).to.equal(null)
    expect(view.text()).to.contain('scripts/thing.mjs')

    view.unmount()
  })

  // The other control. A consumer that answered the argument seam has already
  // said what identifies the call, and its answer wins over the path.
  it('defers to consumer fields when the consumer supplied them', () => {
    const view = render(
      <TimelineEvent
        entry={read_entry(long_path)}
        resolve_tool_argument={() => [{ label: 'query', value: 'red zone' }]}
      />
    )

    expect(view.container.querySelector('.rat-tool-path')).to.equal(null)
    expect(view.text()).to.contain('red zone')

    view.unmount()
  })
})
