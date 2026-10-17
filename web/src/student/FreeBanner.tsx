// The "free leftovers" banner: shows which foods staff made free today. Pops in with a small
// burst of the world's particles, and can be hidden until the list changes.
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { FreeItem } from '../shared/api'
import { burstPetals } from '../celebrate'
import { free as freeCopy } from '../shared/copy/free'
import { storeGet, storeSet } from '../shared/device'
import { Close, Tray } from '../shared/icons'
import { useReducedMotion } from '../shared/motion'
import { sound } from '../shared/sound'
import './free.css'

const t = freeCopy.banner
const HIDDEN_KEY = 'lunchloop.freeHidden'
const pop = { type: 'spring', stiffness: 380, damping: 22, mass: 0.8 } as const

export interface FreeBannerProps {
  /** `free_today` from GET /api/me or /api/tray, or `free` from GET /api/free. */
  free: FreeItem[]
}

// The same foods made free at the same moments count as the same list.
const listKey = (free: FreeItem[]) =>
  free
    .map((f) => `${f.item_id}@${f.since}`)
    .sort()
    .join('|')

export function FreeBanner({ free }: FreeBannerProps) {
  const reduce = !!useReducedMotion()
  const key = listKey(free)
  const [hidden, setHidden] = useState(() => storeGet(HIDDEN_KEY))
  const ref = useRef<HTMLDivElement>(null)
  const show = free.length > 0 && hidden !== key

  // Celebrate once per new list, after the banner has popped in.
  const burstFor = useRef('')
  useEffect(() => {
    if (!show || reduce || burstFor.current === key) return
    burstFor.current = key
    const timer = setTimeout(() => {
      const el = ref.current
      if (!el) return
      const r = el.getBoundingClientRect()
      burstPetals({ x: r.left + Math.min(56, r.width / 2), y: r.top + r.height / 2 }, { count: 24, power: 0.6, spread: 110 })
      sound.chime()
    }, 180)
    return () => clearTimeout(timer)
  }, [show, reduce, key])

  function dismiss() {
    storeSet(HIDDEN_KEY, key)
    setHidden(key)
  }

  // The live region stays mounted so screen readers hear the banner when it arrives.
  return (
    <div className="fb-live" role="status">
    <AnimatePresence initial={!reduce}>
      {show && (
        <motion.div
          key={key}
          ref={ref}
          className="fb"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: -14, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.96 }}
          transition={reduce ? { duration: 0.2 } : pop}
        >
          <span className="fb__badge" aria-hidden="true">
            <Tray width={26} height={26} />
          </span>
          <p className="fb__text">
            <span className="fb__main">
              <span className="fb__word">{t.word}</span>
              {t.rest(free.map((f) => f.name))}
            </span>
            <span className="fb__hint">{t.hint}</span>
          </p>
          <button type="button" className="fb__close" aria-label={t.dismiss} onClick={dismiss}>
            <Close width={20} height={20} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
    </div>
  )
}
