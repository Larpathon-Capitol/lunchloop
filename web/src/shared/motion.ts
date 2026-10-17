import { useReducedMotion } from 'framer-motion'
export { useReducedMotion }

// Durations in seconds for Framer Motion, matching tokens.css.
export const dur = { fast: 0.12, med: 0.22, slow: 0.32 }

/** The brush ease: slow start, fast sweep, soft stop. For ink reveals, 450 to 700ms. */
export const brushEase = [0.7, 0, 0.2, 1] as const

/** Press: dip to 0.94 and spring back. */
export const press = { scale: 0.94, transition: { type: 'spring' as const, stiffness: 600, damping: 26 } }
