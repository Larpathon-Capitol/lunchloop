import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { sound } from '../shared/sound'
import { burstPetals } from './burst'
import { celebrateCopy } from './copy'
import { driftPetals } from './drift'
import { NumberRoll } from './NumberRoll'
import './celebrate.css'

export interface StreakMilestoneProps {
  streak: number
  onClose: () => void
  /** Skip the chime, for tests and labs. */
  silent?: boolean
}

const BRUSH = [0.7, 0, 0.2, 1] as const

// A plum branch entering from the top right corner. Twig starts sit on the trunk.
const TRUNK = 'M410 -10 C350 18 300 48 252 92 C215 126 150 148 96 186 C66 207 44 232 30 262'
const TWIGS = [
  { d: 'M326 35 C336 80 330 122 304 156', delay: 0.45 },
  { d: 'M252 92 C238 66 205 52 170 56', delay: 0.6 },
  { d: 'M180 137 C178 175 160 215 126 245', delay: 0.8 },
  { d: 'M129 165 C112 150 84 142 56 148', delay: 0.9 },
]
// x, y, radius, rest rotation. Listed in the order the branch reaches them.
const BLOSSOMS = [
  { x: 362, y: 14, r: 15, rot: 8 },
  { x: 304, y: 156, r: 17, rot: -12 },
  { x: 252, y: 92, r: 13, rot: 20 },
  { x: 170, y: 56, r: 19, rot: -6 },
  { x: 128, y: 168, r: 12, rot: 14 },
  { x: 126, y: 245, r: 18, rot: -18 },
  { x: 56, y: 148, r: 15, rot: 6 },
  { x: 30, y: 262, r: 16, rot: -10 },
]
const BUDS = [
  { x: 332, y: 100, r: 5 },
  { x: 214, y: 66, r: 4.5 },
  { x: 160, y: 205, r: 5 },
  { x: 74, y: 214, r: 4.5 },
]

function Blossom({ r, rot, delay, reduce }: { r: number; rot: number; delay: number; reduce: boolean }) {
  return (
    <motion.g
      style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
      initial={reduce ? false : { scale: 0, rotate: rot - 50 }}
      animate={{ scale: 1, rotate: rot }}
      transition={{ type: 'spring', duration: 0.7, bounce: 0.5, delay }}
    >
      {[0, 72, 144, 216, 288].map((a) => (
        <ellipse
          key={a}
          cx="0"
          cy={-r * 0.58}
          rx={r * 0.44}
          ry={r * 0.56}
          transform={`rotate(${a})`}
          strokeWidth="1.1"
          style={{ fill: 'var(--sakura)', stroke: 'var(--ume)' }}
        />
      ))}
      <circle r={r * 0.2} style={{ fill: 'var(--kin-light)' }} />
    </motion.g>
  )
}

function useFocusTrap(ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = ref.current
    if (!root) return
    const prev = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const focusables = () => Array.from(root.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
    focusables()[0]?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const list = focusables()
      if (list.length === 0) {
        e.preventDefault()
        return
      }
      const first = list[0]
      const last = list[list.length - 1]
      const active = document.activeElement
      if (!root.contains(active)) {
        e.preventDefault()
        first.focus()
      } else if (e.shiftKey && active === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }
    // Keep focus inside even if something else grabs it.
    const onFocusIn = (e: FocusEvent) => {
      if (e.target instanceof Node && !root.contains(e.target)) focusables()[0]?.focus({ preventScroll: true })
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('focusin', onFocusIn)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('focusin', onFocusIn)
      prev?.focus({ preventScroll: true })
    }
  }, [ref])
}

/**
 * Full-screen streak milestone. A plum branch grows in, blossoms open, the number rolls up in gold.
 * Tap anywhere or press Escape to skip. Focus stays inside and returns to where it was.
 */
export function StreakMilestone({ streak, onClose, silent = false }: StreakMilestoneProps) {
  const reduce = useReducedMotion() ?? false
  const root = useRef<HTMLDivElement>(null)
  const numberRef = useRef<HTMLDivElement>(null)
  const [closing, setClosing] = useState(false)
  const [rolling, setRolling] = useState(reduce)
  const openedAt = useRef(0)
  const closed = useRef(false)

  useFocusTrap(root)

  const close = useCallback(
    (skipped: boolean) => {
      if (closed.current) return
      closed.current = true
      if (skipped && !silent) sound.skip()
      setClosing(true)
    },
    [silent],
  )

  useEffect(() => {
    openedAt.current = performance.now()
  }, [])

  // Lock page scroll while the overlay is up.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        close(true)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [close])

  // The big beat: number rolls, chime, petals.
  useEffect(() => {
    if (reduce) {
      if (!silent) sound.chime()
      return
    }
    const stops: Array<() => void> = []
    const t1 = window.setTimeout(() => {
      setRolling(true)
      if (!silent) sound.chime()
    }, 1000)
    const t2 = window.setTimeout(() => {
      const el = numberRef.current
      if (el) stops.push(burstPetals(el, { count: 36, power: 1.1 }).stop)
    }, 1150)
    const t3 = window.setTimeout(() => {
      if (root.current) stops.push(driftPetals(root.current, { count: 8, opacity: 0.95 }))
    }, 1900)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      window.clearTimeout(t3)
      stops.forEach((s) => s())
    }
  }, [reduce, silent])

  const delay = (s: number) => (reduce ? 0 : s)

  return createPortal(
    <motion.div
      ref={root}
      className="milestone"
      role="dialog"
      aria-modal="true"
      aria-label={celebrateCopy.milestoneDialog(streak)}
      initial={{ opacity: 0 }}
      animate={{ opacity: closing ? 0 : 1 }}
      transition={{ duration: reduce ? 0.15 : closing ? 0.2 : 0.25 }}
      onAnimationComplete={() => {
        if (closing) onClose()
      }}
      onClick={() => {
        // Ignore the tap that opened it, which often lands as the overlay appears.
        if (performance.now() - openedAt.current > 500) close(true)
      }}
    >
      <svg className="milestone-branch" viewBox="0 0 390 430" aria-hidden="true">
        <motion.path
          d={TRUNK}
          fill="none"
          strokeWidth="7"
          strokeLinecap="round"
          style={{ stroke: 'var(--on-ai-soft)' }}
          opacity="0.55"
          initial={reduce ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.1, ease: BRUSH }}
        />
        {TWIGS.map((t) => (
          <motion.path
            key={t.d}
            d={t.d}
            fill="none"
            strokeWidth="3.6"
            strokeLinecap="round"
            style={{ stroke: 'var(--on-ai-soft)' }}
            opacity="0.55"
            initial={reduce ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.7, ease: BRUSH, delay: t.delay }}
          />
        ))}
        {BUDS.map((b, i) => (
          <motion.circle
            key={`${b.x}-${b.y}`}
            cx={b.x}
            cy={b.y}
            r={b.r}
            style={{ fill: 'var(--ume)', transformBox: 'fill-box', transformOrigin: 'center' }}
            initial={reduce ? false : { scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', duration: 0.5, bounce: 0.4, delay: delay(0.9 + i * 0.15) }}
          />
        ))}
        {BLOSSOMS.map((b, i) => (
          <g key={`${b.x}-${b.y}`} transform={`translate(${b.x} ${b.y})`}>
            <Blossom r={b.r} rot={b.rot} delay={delay(0.55 + i * 0.17)} reduce={reduce} />
          </g>
        ))}
      </svg>

      <div className="milestone-body">
        <div ref={numberRef} className="milestone-number">
          {rolling ? <NumberRoll value={streak} from={reduce ? undefined : 0} /> : <span aria-hidden="true">&nbsp;</span>}
        </div>
        <motion.p
          className="milestone-label"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: delay(1.5) }}
        >
          {celebrateCopy.streakLabel}
        </motion.p>
        <motion.p
          className="milestone-line"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: delay(1.65) }}
        >
          {celebrateCopy.milestoneLine(streak)}
        </motion.p>
        <motion.button
          type="button"
          className="milestone-btn"
          initial={reduce ? false : { opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          whileTap={reduce ? undefined : { scale: 0.94 }}
          transition={{ type: 'spring', duration: 0.4, bounce: 0.3, delay: delay(1.85) }}
          onClick={(e) => {
            e.stopPropagation()
            if (!silent) sound.tok()
            close(false)
          }}
        >
          {celebrateCopy.keepGoing}
        </motion.button>
      </div>
      <p className="milestone-hint">{celebrateCopy.dismissHint}</p>
    </motion.div>,
    document.body,
  )
}
