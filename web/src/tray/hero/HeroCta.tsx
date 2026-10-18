// The hero's main button: chunky pink press button with a shine sweep, and a gentle magnetic
// pull toward the pointer on desktop.
import { motion, useMotionValue, useSpring } from 'framer-motion'
import { useEffect, useMemo, useRef, type ReactNode } from 'react'

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
