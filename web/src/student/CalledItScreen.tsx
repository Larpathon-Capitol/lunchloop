// Called It: guess which entree will be most popular on the next school day.
// The API only accepts entrees (meat_alternate) on that day's menu, so those are the choices.
import { motion, useReducedMotion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { api, ApiError, type PrepItem } from '../shared/api'
import { copy } from '../shared/copy'
import { fmtDay } from '../shared/format'
import { sound } from '../shared/sound'
import { ErrorNotice, Loading } from '../shared/ui/Notice'
import { SimulatedTag } from '../shared/ui/SimulatedTag'
import { FoodGlyph } from './FoodGlyph'
import { ChoiceRow } from './ChoiceRow'
import { useStudent } from './state'
import { instant, popSpring } from './springs'

const t = copy.student.calledIt

export function CalledItScreen() {
  const { device, me, meError, refreshMe, calendar, calendarError, reloadCalendar, catalog, showFood } = useStudent()
  const reduce = useReducedMotion()
  const [selected, setSelected] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [locked, setLocked] = useState<{ item_id: string; target_date: string } | null>(null)
  const alive = useRef(true)
  const lockedTitle = useRef<HTMLHeadingElement>(null)

  // After locking in, move focus to the confirmation so it is read out.
  useEffect(() => {
    if (locked) lockedTitle.current?.focus({ preventScroll: true })
  }, [locked])

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const header = (
    <header className="screen__head">
      <h1 className="screen__title">{t.title}</h1>
      <SimulatedTag />
    </header>
  )

  if (calendarError) return <div className="screen">{header}<ErrorNotice error={calendarError} onRetry={reloadCalendar} /></div>
  if (meError) return <div className="screen">{header}<ErrorNotice error={meError} onRetry={refreshMe} /></div>
  if (!calendar || !me) return <div className="screen">{header}<Loading label={copy.student.loading.calledIt} /></div>

  const next = calendar.next
  const nameOf = (id: string) => catalog[id]?.name ?? id
  const last = me.last_guess
  // A guess made today points at the next menu day; anything older is a past result.
  const todays = locked ?? (last && next && last.target_date === next.date ? last : null)
  const past = last && (!todays || last.target_date !== todays.target_date) ? last : null
  const choices: PrepItem[] = next ? next.items.filter((i) => i.component === 'meat_alternate') : []
  const chosen = choices.find((c) => c.item_id === selected)

  const lock = async () => {
    if (!selected) return
    setBusy(true)
    setError(null)
    try {
      const r = await api.guess(device, selected)
      void refreshMe()
      if (!alive.current) return
      sound.land()
      setLocked({ item_id: selected, target_date: r.target_date })
    } catch (e) {
      const status = e instanceof ApiError ? e.status : 0
      if (status === 409) void refreshMe()
      if (!alive.current) return
      setError(status === 409 ? t.already : copy.student.errors.guessFailed)
    } finally {
      if (alive.current) setBusy(false)
    }
  }

  return (
    <div className="screen">
      {header}

      {past && (
        <section className="panel panel--quiet" aria-labelledby="last-title">
          <h2 id="last-title" className="section-title">
            {t.lastHeading}
          </h2>
          <div className="result">
            <FoodGlyph id={past.item_id} />
            <p className="result__text">
              {past.correct === true
                ? t.lastRight(nameOf(past.item_id), fmtDay(past.target_date))
                : past.correct === false
                  ? t.lastWrong(nameOf(past.item_id), fmtDay(past.target_date))
                  : t.lastPending(nameOf(past.item_id), fmtDay(past.target_date))}
            </p>
            {past.correct === true && <span className="result__xp num">{t.rightXp}</span>}
          </div>
        </section>
      )}

      {!next ? (
        <section className="panel">
          <p className="panel__lead">{t.noDay}</p>
        </section>
      ) : todays ? (
        <motion.section
          className="panel"
          aria-labelledby="locked-title"
          initial={reduce || !locked ? false : { opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={reduce ? instant : popSpring}
        >
          <div className="result">
            <FoodGlyph id={todays.item_id} large />
            <div className="result__body">
              <h2 id="locked-title" className="section-title" tabIndex={-1} ref={lockedTitle}>
                {t.lockedHeading}
              </h2>
              <p className="panel__lead">{t.lockedBody(nameOf(todays.item_id), fmtDay(todays.target_date))}</p>
            </div>
          </div>
        </motion.section>
      ) : (
        <section className="panel" aria-labelledby="guess-title">
          <h2 id="guess-title" className="section-title">
            {t.question(fmtDay(next.date))}
          </h2>
          <p className="panel__lead">{t.lead}</p>
          {choices.length === 0 ? (
            <p className="panel__note">{t.empty}</p>
          ) : (
            <div className="reel reel--list" role="group" aria-labelledby="guess-title">
              {choices.map((c) => (
                <ChoiceRow
                  key={c.item_id}
                  item_id={c.item_id}
                  name={c.name}
                  on={selected === c.item_id}
                  disabled={busy}
                  onPick={() => {
                    sound.tap()
                    setSelected(c.item_id)
                    setError(null)
                  }}
                  onInfo={() => showFood(c)}
                />
              ))}
            </div>
          )}
          {error && (
            <p className="panel__error" role="alert">
              {error}
            </p>
          )}
          <button
            type="button"
            className="btn btn--primary btn--big"
            disabled={!chosen || busy}
            onClick={lock}
          >
            {busy ? t.locking : chosen ? t.lock : t.pickFirst}
          </button>
        </section>
      )}
    </div>
  )
}
