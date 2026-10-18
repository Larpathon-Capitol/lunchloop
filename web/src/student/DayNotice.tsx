// The live game's day watcher and its "new lunch day" note. Staff can move the live school's day
// from /live/admin. The game checks the live day every 20 seconds while the tab is visible (and
// right away when the tab comes back). When the day moved:
// - a student with picks in progress keeps them and gets a small note with a Refresh button;
// - a student with nothing to lose starts fresh on the new day, with a short "new day" note.
// Nothing here ever reloads or navigates by itself. Mounted only in the live game.
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ume } from '../mascot'
import { api } from '../shared/api'
import { liveDay as copy } from '../shared/copy/liveDay'
import { fmtDay } from '../shared/format'
import { Calendar, Close } from '../shared/icons'
import { useReducedMotion } from '../shared/motion'
import { clearFlipped, clearStale, hideNotice, markStale, restartOn, staleKey, useLiveDay } from './liveDay'
import { useStudent } from './state'
import './dayNotice.css'

const t = copy.notice
const POLL_MS = 20_000
const FLIPPED_MS = 6_000
const pop = { type: 'spring', stiffness: 380, damping: 26, mass: 0.8 } as const

const dayLabel = (iso: string) => fmtDay(iso, { weekday: 'short', month: 'short', day: 'numeric' })

/** A picker sheet or the packing celebration is on screen: not a moment to swap the game out. */
function somethingOpen() {
  return !!document.querySelector('[role="dialog"], .celebrate-layer')
}

/** Watches the live day and decides between asking and quietly starting fresh. */
function useLiveDayWatch() {
  const { calendar, tray, draft } = useStudent()
  // The day this game's data was loaded for. The tray's open day is what a stale pack would hit.
  const loadedDay = tray.state === 'ready' ? tray.data.open_date : (calendar?.today ?? null)
  const packed = tray.state === 'ready' && !!tray.data.picks
  const hasPicks = Object.keys(draft).length > 0
  // The latest picture of the student's work, read when an answer comes back.
  const work = useRef({ packed, hasPicks, ready: tray.state === 'ready' })
  useEffect(() => {
    work.current = { packed, hasPicks, ready: tray.state === 'ready' }
  }, [packed, hasPicks, tray.state])

  // A fresh game starts with fresh data, so any old "stale" mark no longer applies.
  useEffect(() => {
    clearStale()
  }, [])

  useEffect(() => {
    if (!loadedDay) return
    let alive = true
    let asking = false
    let timer: number | undefined

    const check = () => {
      if (document.hidden || asking) return
      asking = true
      api
        .health()
        .then(({ today }) => {
          if (!alive) return
          if (today === loadedDay) {
            clearStale()
            return
          }
          const w = work.current
          const nothingToLose = w.ready && (w.packed || !w.hasPicks) && !somethingOpen()
          if (nothingToLose) restartOn(today)
          else markStale(today)
        })
        .catch(() => {
          // Offline for a moment: the next check tries again.
        })
        .finally(() => {
          asking = false
        })
    }
    const start = () => {
      if (timer === undefined && !document.hidden) timer = window.setInterval(check, POLL_MS)
    }
    const stop = () => {
      window.clearInterval(timer)
      timer = undefined
    }
    const onVisibility = () => {
      if (document.hidden) stop()
      else {
        check()
        start()
      }
    }

    start()
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', check)
    return () => {
      alive = false
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', check)
    }
  }, [loadedDay])
}

/**
 * The note itself, on <body> so it sits above the page's 3D layers. A card near the top on phones
 * (the tray's buttons and the tab bar stay free at the bottom), bottom left on laptops. Hiding it
 * leaves DayPill at the top of the game.
 */
export function DayNotice() {
  useLiveDayWatch()
  const reduce = !!useReducedMotion()
  const live = useLiveDay()
  const { stale, newDay, flipped, hidden } = live
  const key = staleKey(live)

  // The mascot notices too, once per new day.
  const told = useRef<string | null>(null)
  useEffect(() => {
    if (!stale || !newDay || told.current === newDay) return
    told.current = newDay
    ume.react('surprised', t.mascotLine)
  }, [stale, newDay])

  // The "you're on a new day" note after a quiet restart fades on its own.
  useEffect(() => {
    if (!flipped) return
    const id = window.setTimeout(clearFlipped, FLIPPED_MS)
    return () => window.clearTimeout(id)
  }, [flipped])

  const enter = reduce ? { opacity: 0 } : { opacity: 0, y: -12, scale: 0.96 }
  const shown = { opacity: 1, y: 0, scale: 1 }
  const exit = reduce ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.97 }
  const transition = reduce ? { duration: 0.16 } : pop
  const card = key && hidden !== key ? 'stale' : flipped && !key ? 'flipped' : null

  // The live region stays mounted so screen readers hear the note when it arrives. Focus stays
  // where the student left it.
  return createPortal(
    <div className="dayn" role="status" aria-live="polite">
      <AnimatePresence initial={!reduce}>
        {card === 'stale' && (
          <motion.div key="stale" className="dayn__card" initial={enter} animate={shown} exit={exit} transition={transition}>
            <span className="dayn__badge" aria-hidden="true">
              <Calendar width={24} height={24} />
            </span>
            <div className="dayn__text">
              <p className="dayn__title">{t.title}</p>
              <p className="dayn__body">{t.body(newDay ? dayLabel(newDay) : null)}</p>
              <div className="dayn__actions">
                <button type="button" className="btn btn--primary dayn__refresh" onClick={() => window.location.reload()}>
                  {t.refresh}
                </button>
                <p className="dayn__keep">{t.keep}</p>
              </div>
            </div>
            <button type="button" className="dayn__close" aria-label={t.dismiss} onClick={hideNotice}>
              <Close width={20} height={20} />
            </button>
          </motion.div>
        )}
        {card === 'flipped' && flipped && (
          <motion.div key={`flipped-${flipped}`} className="dayn__card dayn__card--flipped" initial={enter} animate={shown} exit={exit} transition={transition}>
            <span className="dayn__badge" aria-hidden="true">
              <Calendar width={24} height={24} />
            </span>
            <div className="dayn__text">
              <p className="dayn__title">{t.flippedTitle}</p>
              <p className="dayn__body">{t.flippedBody(dayLabel(flipped))}</p>
            </div>
            <button type="button" className="dayn__close" aria-label={t.dismiss} onClick={clearFlipped}>
              <Close width={20} height={20} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>,
    document.body,
  )
}

/** After the note is hidden: one small pill at the top of the game that still refreshes. */
export function DayPill() {
  const live = useLiveDay()
  const key = staleKey(live)
  if (!key || live.hidden !== key) return null
  return (
    <button type="button" className="dayn__pill" onClick={() => window.location.reload()}>
      <span className="dayn__pill-dot" aria-hidden="true" />
      <span className="dayn__pill-text">
        {live.newDay ? t.pillDay(dayLabel(live.newDay)) : t.pillTitle}
      </span>
      <span className="dayn__pill-cta">{t.refresh}</span>
    </button>
  )
}
