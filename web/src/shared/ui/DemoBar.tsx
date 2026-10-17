// Presenter controls for the simulated school: step the simulated calendar and add a crowd of
// simulated students. The day lives in this browser (shared/demo.ts) and rides along on every
// request, so any page that listens to useDemoDate refreshes when it changes. Never on live pages.
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { api, ApiError } from '../api'
import type { DemoCalendar } from '../api'
import { demo as t } from '../copy/demo'
import { setDemoDate, useDemoDate } from '../demo'
import { fmtDay } from '../format'
import { Back } from '../icons'
import { useReducedMotion } from '../motion'
import './demoBar.css'

const settle = { type: 'spring', stiffness: 260, damping: 30, mass: 1 } as const
const SIZES = [1, 10, 40] as const

/** A result line, tied to the simulated day it was about. */
type Note = { kind: 'ok' | 'error'; text: string; day: string | null } | null

/** Props for the presenter bar. */
export interface DemoBarProps {
  /** The simulated school to drive. Defaults to the demo school. */
  school?: string
  /** Called after simulated students were added, so the page can refresh right away. */
  onCrowd?: () => void
  className?: string
}

/** "Simulated day: Mon, Oct 19", previous and next school day, back to today, and add students. */
export function DemoBar({ school = 'demo', onCrowd, className }: DemoBarProps) {
  const reduce = !!useReducedMotion()
  const picked = useDemoDate()
  const [cal, setCal] = useState<DemoCalendar | null>(null)
  const [calError, setCalError] = useState(false)
  const [busy, setBusy] = useState(false)
  const [rawNote, setNote] = useState<Note>(null)
  // +1 when stepping forward, -1 back, so the day label slides the right way.
  const [dir, setDir] = useState(0)
  const live = useRef(true)

  useEffect(() => {
    live.current = true
    api
      .demoCalendar(school)
      .then((c) => live.current && setCal(c))
      .catch(() => live.current && setCalError(true))
    return () => {
      live.current = false
    }
  }, [school])

  // A note about one day goes stale once the day changes.
  const note = rawNote && rawNote.day === picked ? rawNote : null

  const today = cal ? (picked ?? cal.default_today) : null
  const days = cal?.school_days ?? []
  const prev = today ? days.filter((d) => d < today).at(-1) : undefined
  const next = today ? days.find((d) => d > today) : undefined
  const onDefault = !cal || today === cal.default_today

  function go(day: string | undefined, step: number) {
    if (!day || !cal) return
    setDir(step)
    setDemoDate(day === cal.default_today ? null : day)
  }

  async function addCrowd(count: number) {
    setBusy(true)
    setNote(null)
    try {
      const r = await api.demoCrowd(count, school)
      if (!live.current) return
      setNote({ kind: 'ok', text: t.added(r.added, r.totals.trays), day: picked })
      onCrowd?.()
    } catch (e) {
      if (!live.current) return
      const noVoting = e instanceof ApiError && e.status === 404
      setNote({ kind: 'error', text: noVoting ? t.noVoting : t.failed, day: picked })
    } finally {
      if (live.current) setBusy(false)
    }
  }

  const dayLabel = today ? fmtDay(today, { weekday: 'short', month: 'short', day: 'numeric' }) : null

  return (
    <section className={`demo-bar${className ? ` ${className}` : ''}`} aria-label={t.label}>
      <div className="demo-bar__head">
        <p className="demo-bar__label">
          <span className="demo-bar__dot" aria-hidden="true" />
          {t.label}
        </p>
        <p className="demo-bar__note">{t.note}</p>
      </div>

      <div className="demo-bar__row">
        <div className="demo-bar__day">
          <button
            type="button"
            className="demo-bar__step"
            onClick={() => go(prev, -1)}
            disabled={!prev}
            aria-label={t.prev}
            title={t.prev}
          >
            <Back width={20} height={20} />
          </button>
          <p className="demo-bar__date" aria-live="polite">
            <span className="demo-bar__date-label">{t.day}:</span>{' '}
            {calError ? (
              <span className="demo-bar__date-value">{t.calendarFailed}</span>
            ) : (
              <AnimatePresence mode="popLayout" initial={false} custom={dir}>
                <motion.span
                  key={dayLabel ?? 'loading'}
                  className="demo-bar__date-value num"
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: dir * 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, y: dir * -10 }}
                  transition={reduce ? { duration: 0.12 } : settle}
                >
                  {dayLabel ?? t.loadingDay}
                </motion.span>
              </AnimatePresence>
            )}
            {cal && onDefault && <span className="demo-bar__today">{t.today}</span>}
          </p>
          <button
            type="button"
            className="demo-bar__step demo-bar__step--next"
            onClick={() => go(next, 1)}
            disabled={!next}
            aria-label={t.next}
            title={t.next}
          >
            <Back width={20} height={20} />
          </button>
        </div>

        <button
          type="button"
          className="btn btn--quiet demo-bar__today-btn"
          onClick={() => {
            setDir(-1)
            setDemoDate(null)
          }}
          disabled={onDefault}
        >
          {t.backToToday}
        </button>

        <div className="demo-bar__crowd" role="group" aria-label={t.addLabel}>
          {SIZES.map((n) => (
            <button
              key={n}
              type="button"
              className={`btn demo-bar__add${n === 10 ? ' btn--primary demo-bar__add--main' : ' btn--quiet'}`}
              onClick={() => void addCrowd(n)}
              disabled={busy || !cal}
            >
              {n === 10 ? t.add(n) : t.addShort(n)}
            </button>
          ))}
        </div>
      </div>

      <p className={`demo-bar__status${note?.kind === 'error' ? ' demo-bar__status--error' : ''}`} role="status">
        <AnimatePresence mode="wait" initial={false}>
          {(busy || note) && (
            <motion.span
              key={busy ? 'busy' : note?.text}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
            >
              {busy ? t.adding : note?.text}
            </motion.span>
          )}
        </AnimatePresence>
      </p>
    </section>
  )
}
