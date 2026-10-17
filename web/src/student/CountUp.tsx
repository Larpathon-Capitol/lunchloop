import { animate, useReducedMotion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { dur } from '../shared/motion'

/** The last value each counter showed, so coming back to a screen doesn't recount from 0. */
const lastShown = new Map<string, number>()

/**
 * A number that counts up once when it first appears, then only animates when it changes.
 * `id` names the counter (for example "xp") so the remembered value survives remounts.
 */
export function CountUp({ id, value, format = (n: number) => String(Math.round(n)) }: { id: string; value: number; format?: (n: number) => string }) {
  const reduce = useReducedMotion()
  const start = reduce ? value : (lastShown.get(id) ?? 0)
  const [shown, setShown] = useState(start)
  // Where the number is right now, so a stopped animation resumes from there.
  const from = useRef(start)

  useEffect(() => {
    lastShown.set(id, value)
    if (reduce || from.current === value) {
      setShown(value)
      from.current = value
      return
    }
    const controls = animate(from.current, value, {
      duration: dur.slow,
      ease: [0.2, 0, 0, 1],
      onUpdate: (n) => {
        from.current = n
        setShown(n)
      },
    })
    return () => controls.stop()
  }, [id, value, reduce])

  return <span className="num">{format(shown)}</span>
}
