import { useEffect, useState } from 'react'

/** True while the media query matches. */
export function useMedia(query: string): boolean {
  const [match, setMatch] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const on = () => setMatch(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [query])
  return match
}

/** The kitchen switches to its one-column phone layout below this width. Keep in step with kitchen.css. */
export const PHONE_QUERY = '(max-width: 899px)'
