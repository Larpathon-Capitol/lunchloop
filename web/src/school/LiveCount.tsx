import { useEffect } from 'react'
import { animate, motion, useMotionValue, useTransform } from 'framer-motion'
import { fmtInt } from '../shared/format'
import { useReducedMotion } from '../shared/motion'

/** A number that glides to its new value when a poll changes it. */
export function LiveCount({ value, format = fmtInt }: { value: number; format?: (n: number) => string }) {
  const reduce = !!useReducedMotion()
  const mv = useMotionValue(reduce ? value : 0)
  const text = useTransform(mv, (v) => format(v))
  useEffect(() => {
    if (reduce) {
      mv.set(value)
      return
    }
    const controls = animate(mv, value, { duration: 0.3, ease: [0.2, 0, 0, 1] })
    return () => controls.stop()
  }, [value, reduce, mv])
  return (
    <span className="num">
      <span className="visually-hidden">{format(value)}</span>
      <motion.span aria-hidden="true">{text}</motion.span>
    </span>
  )
}
