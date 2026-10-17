// Small helpers shared by the Americas art: fill order, the sparkle shape and a
// hook that pauses the CSS loops while the tab is hidden.
import { useEffect, useState } from 'react'

/** Fills cycle through these classes (see americas.css), in a fixed order. */
export const FLAG_FILLS = ['amx-f-pink2', 'amx-f-pink4', 'amx-f-leaf', 'amx-f-yellow'] as const

/** A four-point sparkle centered on 0,0 with radius r. */
export function sparklePath(r: number) {
  const k = r * 0.22
  return `M0 ${-r}C${k} ${-k} ${k} ${-k} ${r} 0C${k} ${k} ${k} ${k} 0 ${r}C${-k} ${k} ${-k} ${k} ${-r} 0C${-k} ${-k} ${-k} ${-k} 0 ${-r}Z`
}

/** True while the document is hidden; the kit pauses its CSS loops then. */
export function usePageHidden() {
  const [hidden, setHidden] = useState(() => typeof document !== 'undefined' && document.hidden)
  useEffect(() => {
    const sync = () => setHidden(document.hidden)
    document.addEventListener('visibilitychange', sync)
    return () => document.removeEventListener('visibilitychange', sync)
  }, [])
  return hidden
}
