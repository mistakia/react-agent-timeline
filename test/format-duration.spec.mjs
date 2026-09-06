import { expect } from 'chai'

import { format_duration } from '../src/agent-session-timeline/format-duration.mjs'

describe('format_duration', () => {
  it('keeps one decimal under ten seconds', () => {
    expect(format_duration(4200)).to.equal('4.2s')
  })

  it('rounds to whole seconds above ten', () => {
    expect(format_duration(42_400)).to.equal('42s')
  })

  it('renders minutes and seconds', () => {
    expect(format_duration(72_000)).to.equal('1m 12s')
  })

  it('drops a zero seconds remainder', () => {
    expect(format_duration(120_000)).to.equal('2m')
  })

  it('renders hours and minutes', () => {
    expect(format_duration(3_780_000)).to.equal('1h 3m')
  })

  // Null rather than `0s`, so the caller renders no duration at all. A run
  // whose duration the server never recorded did not take no time.
  it('returns null for a duration that was never recorded', () => {
    expect(format_duration(null)).to.equal(null)
    expect(format_duration(undefined)).to.equal(null)
    expect(format_duration(NaN)).to.equal(null)
    expect(format_duration(-1)).to.equal(null)
  })
})
