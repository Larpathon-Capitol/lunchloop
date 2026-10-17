// After lunch: "did you get what you packed?" The answer tells the kitchen what ran out, and
// can be changed later the same day.
import { createElement, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { api, ApiError } from '../shared/api'
import type { TodayLunch } from '../shared/api'
import { free as freeCopy } from '../shared/copy/free'
import { deviceId } from '../shared/device'
import { Check, foodGroupIcon } from '../shared/icons'
import { useReducedMotion } from '../shared/motion'
import { sound } from '../shared/sound'
import './free.css'

const t = freeCopy.checkIn
const pop = { type: 'spring', stiffness: 380, damping: 22, mass: 0.8 } as const
const settle = { type: 'spring', stiffness: 380, damping: 30 } as const

export interface LunchCheckInProps {
  /** `today_lunch` from GET /api/me or /api/tray. Nothing renders when it is null. */
  lunch: TodayLunch | null
  /** Called after the answer is saved: true = got their picks, false = something ran out. */
  onAnswered?: (got: boolean) => void
}

export function LunchCheckIn({ lunch, onAnswered }: LunchCheckInProps) {
  if (!lunch) return null
  // A new day's lunch starts fresh.
  return <CheckInCard key={lunch.date} lunch={lunch} onAnswered={onAnswered} />
}

function CheckInCard({ lunch, onAnswered }: { lunch: TodayLunch; onAnswered?: (got: boolean) => void }) {
  const reduce = !!useReducedMotion()
  const [answer, setAnswer] = useState<boolean | null>(lunch.checked_in)
  const [editing, setEditing] = useState(lunch.checked_in === null)
  const [justSaved, setJustSaved] = useState(false)
  const [sending, setSending] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function send(got: boolean) {
    if (sending !== null) return
    sound.tap()
    setSending(got)
    setError(null)
    try {
      await api.served(deviceId(), got)
      setAnswer(got)
      setEditing(false)
      setJustSaved(true)
      if (got) sound.correct()
      onAnswered?.(got)
    } catch (e) {
      const err = e instanceof ApiError ? e : new ApiError(0, String(e))
      setError(err.status === 0 ? t.offline : /no tray/i.test(err.message) ? t.noTray : t.failed)
    } finally {
      setSending(null)
    }
  }

  const swap = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.15 } }
    : {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -6, transition: { duration: 0.12 } },
        transition: settle,
      }

  return (
    <section className="lci" aria-labelledby="lci-h">
      <h2 id="lci-h" className="lci__title">
        {t.heading}
      </h2>
      <p className="lci__sub" id="lci-packed">
        {t.packedLabel}
      </p>
      <ul className="lci__foods" aria-labelledby="lci-packed">
        {lunch.items.map((i) => (
          <li key={i.item_id} className="lci__food" data-group={i.component}>
            {createElement(foodGroupIcon(i.component), { width: 18, height: 18, className: 'lci__icon' })}
            {i.name}
          </li>
        ))}
      </ul>

      <AnimatePresence mode="wait" initial={false}>
        {editing || answer === null ? (
          <motion.div key="ask" className="lci__ask" role="group" aria-label={t.groupLabel} {...swap}>
            <motion.button
              type="button"
              className="btn-press lci__btn"
              disabled={sending !== null}
              data-busy={sending === true || undefined}
              aria-pressed={answer === true}
              onClick={() => void send(true)}
              whileTap={reduce ? undefined : { scale: 0.95 }}
            >
              {sending === true ? t.saving : t.got}
            </motion.button>
            <motion.button
              type="button"
              className="btn btn--quiet lci__btn lci__btn--quiet"
              disabled={sending !== null}
              aria-pressed={answer === false}
              onClick={() => void send(false)}
              whileTap={reduce ? undefined : { scale: 0.95 }}
            >
              {sending === false ? t.saving : t.missed}
            </motion.button>
            {answer !== null && (
              <button type="button" className="lci__link" onClick={() => setEditing(false)}>
                {t.keep}
              </button>
            )}
          </motion.div>
        ) : (
          <motion.div key="done" className="lci__done" data-got={answer || undefined} {...swap}>
            <motion.span
              className="lci__mark"
              aria-hidden="true"
              initial={reduce ? false : { scale: 0.4, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={pop}
            >
              <Check width={20} height={20} />
            </motion.span>
            <p className="lci__said">
              {justSaved ? (answer ? t.thanksGot : t.thanksMissed) : answer ? t.savedGot : t.savedMissed}
            </p>
            <button
              type="button"
              className="lci__link"
              onClick={() => {
                setJustSaved(false)
                setEditing(true)
              }}
            >
              {t.change}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <p className="lci__error" role="alert">
        {error ?? ''}
      </p>
      <p className="visually-hidden" role="status">
        {justSaved && answer !== null ? (answer ? t.thanksGot : t.thanksMissed) : ''}
      </p>
    </section>
  )
}
