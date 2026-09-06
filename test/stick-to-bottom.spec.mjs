import { expect } from 'chai'

import {
  NEAR_BOTTOM_THRESHOLD_PX,
  is_near_bottom,
  scroll_metrics
} from '../src/agent-session-timeline/stick-to-bottom.mjs'

// The predicate the whole pin rests on. Tested here rather than only through a
// render, because the case that matters — a reader scrolled up while entries
// keep arriving — is a geometry question, and a DOM test that never produces
// overflow answers it vacuously.

describe('is_near_bottom', () => {
  const scrolled_to = (scroll_top) =>
    is_near_bottom({ scroll_top, scroll_height: 1000, client_height: 200 })

  it('is true at the exact bottom', () => {
    expect(scrolled_to(800)).to.equal(true)
  })

  it('is true within the threshold of the bottom', () => {
    expect(scrolled_to(800 - NEAR_BOTTOM_THRESHOLD_PX)).to.equal(true)
  })

  it('is false once past the threshold', () => {
    expect(scrolled_to(800 - NEAR_BOTTOM_THRESHOLD_PX - 1)).to.equal(false)
  })

  // The case this surface exists for: a reader who scrolled up to read
  // something must not be dragged back down by the next live entry.
  it('is false for a reader scrolled well up', () => {
    expect(scrolled_to(0)).to.equal(false)
  })

  it('is true when the content does not overflow', () => {
    expect(
      is_near_bottom({ scroll_top: 0, scroll_height: 100, client_height: 200 })
    ).to.equal(true)
  })

  it('is true when the content exactly fills the viewport', () => {
    expect(
      is_near_bottom({ scroll_top: 0, scroll_height: 200, client_height: 200 })
    ).to.equal(true)
  })

  // Sub-pixel scroll heights are ordinary at any zoom other than 100%, and an
  // exact bottom test would report those as "scrolled away" forever.
  it('is true at a fractional bottom', () => {
    expect(
      is_near_bottom({
        scroll_top: 799.6,
        scroll_height: 1000.4,
        client_height: 200.5
      })
    ).to.equal(true)
  })

  it('treats missing geometry as pinned rather than throwing', () => {
    expect(is_near_bottom({})).to.equal(true)
  })
})

describe('scroll_metrics', () => {
  it('reads an element', () => {
    expect(
      scroll_metrics({ scrollTop: 5, scrollHeight: 90, clientHeight: 40 })
    ).to.eql({ scroll_top: 5, scroll_height: 90, client_height: 40 })
  })

  it('returns zeroes for a ref that has not mounted', () => {
    expect(is_near_bottom(scroll_metrics(null))).to.equal(true)
  })
})
