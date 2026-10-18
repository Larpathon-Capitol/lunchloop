// Staff day control for the live school: step the live day to the previous or next school day, or
// go back to today. Unlike the simulated presenter bar (DemoBar), the day lives on the server, so a
// change reaches everyone playing the live game. It wears DemoBar's look (demoBar.css).
import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { api, ApiError } from '../api'
import type { AdminClock } from '../api'
import { liveDay as copy } from '../copy/liveDay'
import { fmtDay } from '../format'
import { Back } from '../icons'
import { useReducedMotion } from '../motion'
import './demoBar.css'
import './liveDayBar.css'

const t = copy.bar
const settle = { type: 'spring', stiffness: 260, damping: 30, mass: 1 } as const

type Note = { kind: 'ok' | 'error'; text: string } | null

const short = (iso: string) => fmtDay(iso, { weekday: 'short', month: 'short', day: 'numeric' })

/** Server messages are lowercase fragments; show them as a sentence. */
const sentence = (msg: string) => `${msg.charAt(0).toUpperCase()}${msg.slice(1)}${/[.!?]$/.test(msg) ? '' : '.'}`

export interface LiveDayBarProps {
  /** The staff sign-in token for the live school. */
  token: string
  /** The token ran out: send staff back to the sign-in. */
  onExpired: () => void
  /** The live day changed (from here or another staff tab), so the panel can reload its numbers. */
  onDay?: (today: string) => void
  className?: string
}

/** "Live day: Mon, Oct 19", previous and next school day, and back to today. */
export function LiveDayBar({ token, onExpired, onDay, className }: LiveDayBarProps) {
  const reduce = !!useReducedMotion()
  const [clock, setClock] = useState<AdminClock | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<Note>(null)
  // +1 when stepping forward, -1 back, so the day label slides the right way.
  const [dir, setDir] = useState(0)
  const alive = useRef(true)
  const onDayRef = useRef(onDay)
  const onExpiredRef = useRef(onExpired)
  useEffect(() => {
    onDayRef.current = onDay
    onExpiredRef.current = onExpired
  }, [onDay, onExpired])

  // The day last shown, so a change from anywhere (here or another staff tab) is reported once.
  const shown = useRef<string | null>(null)
  const take = useCallback((c: AdminClock) => {
    const before = shown.current
    shown.current = c.today
    setClock(c)
    if (before !== null && before !== c.today) onDayRef.current?.(c.today)
  }, [])

  const failed = useCallback((e: unknown, onLoad: boolean) => {
    const err = e instanceof ApiError ? e : new ApiError(0, String(e))
    if (err.status === 401) {
      onExpiredRef.current()
      return
    }
    if (onLoad) setLoadError(true)
    else setNote({ kind: 'error', text: err.status === 0 ? t.offline : err.status === 400 ? sentence(err.message) : t.failed })
  }, [])

  // Load the clock, and look again whenever staff come back to this tab, in case someone else
  // moved the day meanwhile.
  useEffect(() => {
    alive.current = true
    const load = () => {
      if (document.hidden) return
      api
        .adminClock(token)
        .then((c) => {
          if (!alive.current) return
          setLoadError(false)
          take(c)
        })
        .catch((e) => alive.current && failed(e, true))
    }
    load()
    document.addEventListener('visibilitychange', load)
    window.addEventListener('focus', load)
    return () => {
      alive.current = false
      document.removeEventListener('visibilitychange', load)
      window.removeEventListener('focus', load)
    }
  }, [token, take, failed])

  const today = clock?.today ?? null
  const days = clock?.school_days ?? []
  const prev = today ? days.filter((d) => d < today).at(-1) : undefined
  // Stops one school day before the end of the menu: on the last day there is no tomorrow to pack for.
  const next = today ? days.slice(0, -1).find((d) => d > today) : undefined
  const onDefault = !clock || today === clock.default_today

  async function move(day: string | null, step: number) {
    if (!clock || busy) return
    setDir(step)
    setBusy(true)
    setNote(null)
    try {
      const c = await api.setAdminClock(token, day === clock.default_today ? null : day)
      if (!alive.current) return
      take(c)
      setNote({ kind: 'ok', text: day === null ? t.reset(short(c.today)) : t.moved(short(c.today)) })
    } catch (e) {
      if (alive.current) failed(e, false)
    } finally {
      if (alive.current) setBusy(false)
    }
  }

  const label = today ? short(today) : null

  return (
    <section className={`demo-bar demo-bar--live${className ? ` ${className}` : ''}`} aria-label={t.label} aria-busy={busy}>
      <div className="demo-bar__head">
        <p className="demo-bar__label">
          <span className="demo-bar__dot" aria-hidden="true" />
          {t.label}
        </p>
        <p className="demo-bar__note demo-bar__note--keep">
          <span className="live-bar__note-long">{t.note}</span>
          <span className="live-bar__note-short">{t.noteShort}</span>
        </p>
      </div>

      <div className="demo-bar__row">
        <div className="demo-bar__day">
          <button
            type="button"
            className="demo-bar__step"
            onClick={() => prev && void move(prev, -1)}
            disabled={!prev || busy}
            aria-label={t.prev}
            title={t.prev}
          >
            <Back width={20} height={20} />
          </button>
          <p className="demo-bar__date" aria-live="polite">
            <span className="demo-bar__date-label">{t.day}:</span>{' '}
            {loadError && !clock ? (
              <span className="demo-bar__date-value">{t.calendarFailed}</span>
            ) : (
              <AnimatePresence mode="popLayout" initial={false} custom={dir}>
                <motion.span
                  key={label ?? 'loading'}
                  className="demo-bar__date-value num"
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: dir * 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, y: dir * -10 }}
                  transition={reduce ? { duration: 0.12 } : settle}
                >
                  {label ?? t.loadingDay}
                </motion.span>
              </AnimatePresence>
            )}
            {clock && onDefault && <span className="demo-bar__today">{t.today}</span>}
          </p>
          <button
            type="button"
            className="demo-bar__step demo-bar__step--next"
            onClick={() => next && void move(next, 1)}
            disabled={!next || busy}
            aria-label={t.next}
            title={t.next}
          >
            <Back width={20} height={20} />
          </button>
        </div>

        <button
          type="button"
          className="btn btn--quiet demo-bar__today-btn live-bar__today-btn"
          onClick={() => void move(null, -1)}
          disabled={onDefault || busy}
        >
          {t.backToToday}
        </button>
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
              {busy ? t.moving : note?.text}
            </motion.span>
          )}
        </AnimatePresence>
      </p>
    </section>
  )
}
