import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { sound } from '../shared/sound'
import { burstPetals } from './burst'
import { celebrateCopy } from './copy'
import { driftPetals } from './drift'
import { useKit } from '../theme/registry'
import { NumberRoll } from './NumberRoll'
import './celebrate.css'

export interface StreakMilestoneProps {
  streak: number
  onClose: () => void
  /** Skip the chime, for tests and labs. */
  silent?: boolean
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
 * Full-screen streak milestone. The world's milestone art draws itself in, the number rolls up.
 * Tap anywhere or press Escape to skip. Focus stays inside and returns to where it was.
 */
export function StreakMilestone({ streak, onClose, silent = false }: StreakMilestoneProps) {
  const reduce = useReducedMotion() ?? false
  const { Milestone } = useKit()
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
      <Milestone grow={!reduce} className="milestone-branch" />

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
