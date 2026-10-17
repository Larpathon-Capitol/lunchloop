import { animate, useInView } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from '../shared/motion'

const DURATION_S = 0.3

/**
 * The real value is on screen from the first paint. When the number first scrolls into
 * view it counts up from zero in 300ms, once. Screen readers get the final number only.
 */
export function CountUp({ value, format }: { value: number; format: (n: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const reduce = useReducedMotion()
  const inView = useInView(ref, { once: true })
  const [shown, setShown] = useState(value)
  const played = useRef(false)

  useEffect(() => {
    if (reduce || !inView || played.current) {
      setShown(value)
      return
    }
    const controls = animate(0, value, {
      duration: DURATION_S,
      ease: [0.2, 0, 0, 1],
      onUpdate: setShown,
      onComplete: () => {
        played.current = true
        setShown(value)
      },
    })
    return () => controls.stop()
  }, [value, inView, reduce])

  return (
    <span ref={ref} className="num">
      <span className="visually-hidden">{format(value)}</span>
      <span aria-hidden="true">{format(shown)}</span>
    </span>
  )
}
