import React from 'react'

import { is_near_bottom, scroll_metrics } from './stick-to-bottom.mjs'

// A layout effect so the scroll write lands in the same frame as the entry that
// caused it. Under `useEffect` the browser paints the taller list once before
// the correction, which is a visible upward flick on every live entry. Falls
// back to `useEffect` where there is no DOM, because React warns about
// `useLayoutEffect` during server rendering and the warning is the only thing
// that would happen there.
const use_isomorphic_layout_effect =
  typeof window === 'undefined' ? React.useEffect : React.useLayoutEffect

/**
 * Keep a scroll container pinned to its bottom as content arrives, unless the
 * reader has scrolled away from it.
 *
 * Returns the ref to put on the scroll container, whether the pin is currently
 * engaged, and a function to re-engage it.
 *
 * `is_active` is what tells the hook the container is on screen — a collapsed
 * timeline has no scroll container at all, and re-expanding it mounts a fresh
 * one that must start at the bottom rather than wherever the last one was.
 * `content_key` is any value that changes when the rendered content does; it is
 * the trigger for re-pinning, and it is a value rather than the entries array
 * so a consumer re-rendering with an equal-but-new array does not scroll.
 */
export function use_stick_to_bottom({ is_active, content_key }) {
  const scroll_ref = React.useRef(null)
  const [is_pinned, set_is_pinned] = React.useState(true)

  // The pin state is also read inside listeners that must not be re-subscribed
  // on every change of it. A ref alongside the state is what lets the effects
  // below depend on `is_active` alone.
  const is_pinned_ref = React.useRef(true)
  const set_pinned = React.useCallback((next) => {
    is_pinned_ref.current = next
    set_is_pinned((previous) => (previous === next ? previous : next))
  }, [])

  const scroll_to_bottom = React.useCallback(() => {
    const element = scroll_ref.current
    if (!element) return
    element.scrollTop = element.scrollHeight
    set_pinned(true)
  }, [set_pinned])

  // Re-ask "is the reader at the bottom?" on every scroll, which is the whole
  // of the rule. A programmatic scroll to the bottom fires this too and answers
  // yes, so the pin survives its own writes without needing to distinguish them
  // from a gesture.
  use_isomorphic_layout_effect(() => {
    const element = scroll_ref.current
    if (!is_active || !element) return undefined

    const on_scroll = () => set_pinned(is_near_bottom(scroll_metrics(element)))
    element.addEventListener('scroll', on_scroll, { passive: true })
    return () => element.removeEventListener('scroll', on_scroll)
  }, [is_active, set_pinned])

  // Opening the expanded view starts at the newest entry, the way a chat does.
  // Without this the container mounts at scrollTop 0 — the OLDEST entry — which
  // for a run already hundreds of entries long shows the reader the setup and
  // hides the answer.
  use_isomorphic_layout_effect(() => {
    if (!is_active) return
    set_pinned(true)
    scroll_to_bottom()
  }, [is_active, scroll_to_bottom, set_pinned])

  // New content, and the reader has not scrolled away: follow it.
  use_isomorphic_layout_effect(() => {
    if (!is_active) return
    if (!is_pinned_ref.current) return
    scroll_to_bottom()
  }, [is_active, content_key, scroll_to_bottom])

  // Content that grows AFTER it committed — a wrapping line reflowing, a font
  // swapping in — moves the bottom without changing `content_key`, so the pin
  // would silently drift off the newest entry by a few pixels per entry. The
  // observer is what makes "pinned" mean pinned rather than "scrolled to where
  // the bottom was at commit time".
  use_isomorphic_layout_effect(() => {
    const element = scroll_ref.current
    if (!is_active || !element) return undefined
    if (typeof ResizeObserver === 'undefined') return undefined

    const observer = new ResizeObserver(() => {
      if (!is_pinned_ref.current) return
      element.scrollTop = element.scrollHeight
    })
    observer.observe(element)
    for (const child of element.children) observer.observe(child)
    return () => observer.disconnect()
  }, [is_active, content_key])

  return { scroll_ref, is_pinned, scroll_to_bottom }
}
