import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import './celebrate.css'

export interface NumberRollProps {
  value: number
  /** Start from this number and roll up on mount. Without it, the first render is already at value. */
  from?: number
  className?: string
}

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]

function digitsOf(n: number): number[] {
  return String(Math.max(0, Math.round(n)))
    .split('')
    .map(Number)
}

function Column({ digit, place, reduce }: { digit: number; place: number; reduce: boolean }) {
  return (
    <span className="roll-col">
      <motion.span
        className="roll-strip"
        initial={{ y: `${-digit * 1.2}em` }}
        animate={{ y: `${-digit * 1.2}em` }}
        transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 170, damping: 19, mass: 0.9, delay: place * 0.05 }}
      >
        {DIGITS.map((d) => (
          <span key={d} className="roll-digit">
            {d}
          </span>
        ))}
      </motion.span>
    </span>
  )
}

/**
 * Odometer digits. Each column slides on a spring. Screen readers hear only the final number,
 * politely, once per change.
 */
export function NumberRoll({ value, from, className }: NumberRollProps) {
  const reduce = useReducedMotion() ?? false
  // With `from`, the first paint shows it, then one frame later the value arrives and the columns roll.
  const [armed, setArmed] = useState(from === undefined)
  useEffect(() => {
    if (armed) return
    const id = requestAnimationFrame(() => setArmed(true))
    return () => cancelAnimationFrame(id)
  }, [armed])
  const shown = armed ? value : (from ?? value)

  const digits = digitsOf(shown)
  const len = digits.length
  return (
    <span className={`roll${className ? ` ${className}` : ''}`}>
      <span className="cel-sr" aria-live="polite" aria-atomic="true">
        {value}
      </span>
      <span aria-hidden="true" style={{ display: 'inline-flex' }}>
        {digits.map((d, i) => {
          const place = len - 1 - i // 0 is the ones column; columns keep their key as the number grows
          return <Column key={place} digit={d} place={place} reduce={reduce} />
        })}
      </span>
    </span>
  )
}
