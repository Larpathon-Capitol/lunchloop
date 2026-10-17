// "Tray locks in 04:12:09": a small flip board counting down to the end of today, when
// tomorrow's picks close. Only the digits that change flip, one tile at a time.
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { heroCopy } from './copy'

function untilMidnight(now = new Date()) {
  const end = new Date(now)
  end.setHours(24, 0, 0, 0)
  return Math.max(0, Math.floor((end.getTime() - now.getTime()) / 1000))
}

const pad = (n: number) => String(n).padStart(2, '0')

const flip = { type: 'spring', stiffness: 380, damping: 22, mass: 0.8 } as const

function Digit({ d, reduce }: { d: string; reduce: boolean }) {
  return (
    <span className="flip__tile">
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={d}
          className="flip__digit"
          initial={reduce ? { opacity: 0 } : { y: '-100%', rotateX: 70, opacity: 0 }}
          animate={{ y: '0%', rotateX: 0, opacity: 1 }}
          exit={reduce ? { opacity: 0 } : { y: '100%', rotateX: -70, opacity: 0 }}
          transition={reduce ? { duration: 0.12 } : flip}
        >
          {d}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}

/** Props for the lock-in countdown. */
export interface CountdownProps {
  reduce: boolean
  className?: string
}

export function Countdown({ reduce, className }: CountdownProps) {
  const [left, setLeft] = useState(untilMidnight)
  useEffect(() => {
    let timer = 0
    // Tick on the second boundary, and skip work while the tab is hidden.
    const tick = () => {
      if (!document.hidden) setLeft(untilMidnight())
      timer = window.setTimeout(tick, 1000 - (Date.now() % 1000) + 5)
    }
    tick()
    return () => window.clearTimeout(timer)
  }, [])
  const h = Math.floor(left / 3600)
  const m = Math.floor((left % 3600) / 60)
  const s = left % 60
  const groups = [pad(h), pad(m), pad(s)]
  return (
    <p className={`flip ${className ?? ''}`} aria-label={heroCopy.locksLabel(h, m)} role="timer" aria-live="off">
      <span className="flip__label" aria-hidden="true">
        {heroCopy.locksIn}
      </span>
      <span className="flip__board" aria-hidden="true">
        {groups.map((g, i) => (
          <span className="flip__group" key={i}>
            {i > 0 && <span className="flip__colon" />}
            <Digit d={g[0]} reduce={reduce} />
            <Digit d={g[1]} reduce={reduce} />
          </span>
        ))}
      </span>
    </p>
  )
}
