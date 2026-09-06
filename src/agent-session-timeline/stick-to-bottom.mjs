// The geometry behind "pinned to the bottom unless the reader scrolled away",
// kept pure and JSX-free so the rule can be tested without a DOM.
//
// The rule is one predicate, and the naive version of this surface is the one
// that has no predicate at all: scrolling to the bottom on every new entry
// yanks a reader who deliberately scrolled up back down mid-sentence, on every
// tick of a live run. What makes it correct is deciding whether to scroll from
// where the viewport ALREADY is, re-asked on every scroll event.
//
// Base's ThreadTimelineView solves a strictly larger problem — it also pages in
// older history and has to hold the viewport still across prepends, which needs
// node anchoring and a user-intent flag to stop programmatic scrolls reading as
// gestures. This surface has no pagination: the consumer holds the whole run in
// memory and nothing is ever inserted above the viewport. So the anchoring half
// is deliberately not reproduced, and the near-bottom half is.

// How close to the bottom still counts as "at the bottom".
//
// Not zero. A fractional scrollHeight (any non-integral row height, a browser
// zoom other than 100%) leaves distance_from_bottom at a sub-pixel value the
// reader cannot see and cannot correct, and an exact test reads that as "the
// reader scrolled away" and unpins on its own. The threshold is also what makes
// the pin survive a partial wheel notch.
export const NEAR_BOTTOM_THRESHOLD_PX = 48

/**
 * Whether the viewport is at (or within a threshold of) the bottom.
 *
 * Content that does not overflow counts as at the bottom: there is nothing to
 * scroll, so there is nothing the reader could have scrolled away from, and
 * treating it as unpinned would show a jump-to-latest affordance pointing at
 * content already fully visible.
 */
export function is_near_bottom({
  scroll_top,
  scroll_height,
  client_height,
  threshold = NEAR_BOTTOM_THRESHOLD_PX
}) {
  if (!Number.isFinite(scroll_top)) return true
  if (!Number.isFinite(scroll_height)) return true
  if (!Number.isFinite(client_height)) return true
  if (scroll_height <= client_height) return true
  return scroll_height - scroll_top - client_height <= threshold
}

/**
 * Read the scroll geometry of an element, defaulted so a null ref reads as
 * pinned rather than throwing. A component whose container has not mounted yet
 * has no way to be scrolled away from the bottom.
 */
export function scroll_metrics(element) {
  if (!element) return { scroll_top: 0, scroll_height: 0, client_height: 0 }
  return {
    scroll_top: element.scrollTop,
    scroll_height: element.scrollHeight,
    client_height: element.clientHeight
  }
}
