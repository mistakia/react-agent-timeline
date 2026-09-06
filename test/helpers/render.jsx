import { act } from 'react'
import { createRoot } from 'react-dom/client'

/**
 * Mount an element into a detached container and return it plus an unmount.
 *
 * Assertions read `container.textContent`, which is what makes a render test
 * able to distinguish "rendered as blank" from "rendered as content" — the two
 * failure shapes this package cares about both produce a valid DOM tree.
 */
export function render(element) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)

  act(() => {
    root.render(element)
  })

  return {
    container,
    text: () => container.textContent,
    // Re-rendering into the SAME root is what makes a streaming test real: a
    // fresh mount per frame would re-run every mount effect, so the pin would
    // re-engage on its own and a broken follow-the-bottom rule would still pass.
    rerender: (next) => {
      act(() => {
        root.render(next)
      })
    },
    unmount: () => {
      act(() => root.unmount())
      container.remove()
    }
  }
}
