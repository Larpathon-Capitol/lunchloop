// Where Ume lives. Ume floats in the corner only when the page leaves a gutter wide enough
// for it and its bubble (content is var(--max-width) wide). Everywhere else Ume sits inside
// the layout (UmeInline), so it never covers a button, a row or the tab bar.
import { useSyncExternalStore } from 'react'

/** Keep in step with the @media rule in ume.css. */
export const DOCK_QUERY = '(min-width: 1400px)'

export function useDocked(): boolean {
  return useSyncExternalStore(
    (l) => {
      const mq = window.matchMedia(DOCK_QUERY)
      mq.addEventListener('change', l)
      return () => mq.removeEventListener('change', l)
    },
    () => window.matchMedia(DOCK_QUERY).matches,
    () => true,
  )
}
