// The hero's main button: chunky pink press button with a shine sweep, and a gentle magnetic
// pull toward the pointer on desktop. Also the small streak chip that sits beside it.
import { motion, useMotionValue, useSpring } from 'framer-motion'
import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { heroCopy } from './copy'

const tap = { type: 'spring', stiffness: 600, damping: 18, mass: 0.6 } as const
const pop = { type: 'spring', stiffness: 380, damping: 22, mass: 0.8 } as const
const magnet = { stiffness: 200, damping: 15, mass: 0.1 }
const PULL = 0.25
const MAX_PULL = 12

/** Props for the hero CTA. */
export interface HeroCtaProps {
  children: ReactNode
  onClick: () => void
  /** Hover, focus or press: the student is about to go, so warm the game. */
  onIntent: () => void
  reduce: boolean
  delay?: number
}

export function HeroCta({ children, onClick, onIntent, reduce, delay = 0 }: HeroCtaProps) {
  const ref = useRef<HTMLButtonElement>(null)
  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const x = useSpring(mx, magnet)
  const y = useSpring(my, magnet)
  const fine = useMemo(() => window.matchMedia('(hover: hover) and (pointer: fine)').matches, [])

  useEffect(() => {
    if (!fine || reduce) return
    const el = ref.current
    if (!el) return
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      const dx = e.clientX - (r.left + r.width / 2)
      const dy = e.clientY - (r.top + r.height / 2)
      // Only pull when the pointer is near the button.
      if (Math.hypot(dx, dy) > Math.max(r.width, 160)) {
        mx.set(0)
        my.set(0)
        return
      }
      const clamp = (v: number) => Math.max(-MAX_PULL, Math.min(MAX_PULL, v * PULL))
      mx.set(clamp(dx))
      my.set(clamp(dy))
    }
    window.addEventListener('pointermove', onMove)
    return () => window.removeEventListener('pointermove', onMove)
  }, [fine, reduce, mx, my])

  return (
    <motion.div
      className="cta-wrap"
      style={{ x, y }}
      initial={reduce ? false : { opacity: 0, scale: 0.86, y: 18 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ ...pop, delay }}
    >
      <motion.button
        ref={ref}
        type="button"
        className="cta"
        onClick={onClick}
        onPointerEnter={onIntent}
        onPointerDown={onIntent}
        onFocus={onIntent}
        whileHover={fine && !reduce ? { y: -2 } : undefined}
        whileTap={reduce ? undefined : { y: 4, scaleX: 1.03, scaleY: 0.95 }}
        transition={tap}
      >
        <span className="cta__label">{children}</span>
        <span className="cta__shine" aria-hidden="true" />
      </motion.button>
    </motion.div>
  )
}

/** A small flame drawn for the streak chip. */
function Flame() {
  return (
    <svg viewBox="0 0 20 24" width="16" height="19" aria-hidden="true" focusable="false">
      <path
        d="M10 1.5c1 3.6 5.6 6.2 6.9 10.4 1.4 4.6-1.6 10.1-6.9 10.1S1.7 18 3.2 13.6c.8-2.3 2.6-3.3 3.1-5.8.9 1.4 1.1 2.7 1 3.9C9.4 9.5 10.6 5.6 10 1.5Z"
        fill="var(--pink-5, #fb6f92)"
        stroke="var(--ink, #3a1626)"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M10 13.5c1.6 1.6 2.8 3.3 2.2 5.2-.4 1.4-1.4 2-2.2 2s-2.4-.8-2.4-2.6c0-1.6 1.6-2.6 2.4-4.6Z" fill="var(--accent-1, #ffc72c)" />
    </svg>
  )
}

/** Props for the streak chip. */
export interface StreakChipProps {
  streak: number
  reduce: boolean
  delay?: number
}

export function StreakChip({ streak, reduce, delay = 0 }: StreakChipProps) {
  return (
    <motion.p
      className="streak"
      initial={reduce ? false : { opacity: 0, x: -14, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ ...pop, delay }}
    >
      <motion.span
        className="streak__flame"
        initial={reduce ? false : { scale: 1 }}
        animate={reduce ? undefined : { scale: [1, 0.6, 1.35, 1] }}
        transition={{ duration: 0.55, times: [0, 0.2, 0.6, 1], delay: delay + 0.25 }}
      >
        <Flame />
      </motion.span>
      {heroCopy.streak(streak)}
    </motion.p>
  )
}
