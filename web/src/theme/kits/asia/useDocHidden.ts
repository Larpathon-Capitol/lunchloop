// Visibility of the tab, for pausing CSS loops in the background.
import { useEffect, useState } from 'react'

/** Tracks document.hidden so CSS loops can pause while the tab is in the background. */
export function useDocHidden(): boolean {
  const [hidden, setHidden] = useState(() => typeof document !== 'undefined' && document.hidden)
  useEffect(() => {
    const on = () => setHidden(document.hidden)
    document.addEventListener('visibilitychange', on)
    return () => document.removeEventListener('visibilitychange', on)
  }, [])
  return hidden
}
