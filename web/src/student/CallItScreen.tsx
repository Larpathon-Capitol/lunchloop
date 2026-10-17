// Call it: guess which entree will be most popular on the next school day.
// The API only accepts entrees (meat_alternate) on that day's menu, so those are the choices.
import { motion, useReducedMotion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { UmeInline, lines, pickLine, ume } from '../mascot'
import { api, ApiError, type PrepItem } from '../shared/api'
import { copy } from '../shared/copy'
import { fmtDay } from '../shared/format'
import { Lock } from '../shared/icons'
import { press } from '../shared/motion'
import { sound } from '../shared/sound'
import { ErrorNotice } from '../shared/ui/Notice'
import { ChoiceRow } from './ChoiceRow'
import { FoodGlyph } from './FoodGlyph'
import { fade, popSpring } from './springs'
import { useStudent } from './state'
import { PanelSkeleton } from './VoteScreen'

const t = copy.student.calledIt

type Result = 'right' | 'wrong' | 'pending'

/** The last call's result as a seal: gold when right, a soft pencil ring otherwise. */
function ResultSeal({ result }: { result: Result }) {
  const label = result === 'right' ? t.sealRight : result === 'wrong' ? t.sealWrong : t.sealPending
  return (
    <span className={`result-seal result-seal--${result}`}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r="45" className="result-seal__ring" />
        <circle cx="50" cy="50" r="38" className="result-seal__inner" />
      </svg>
      <span className="result-seal__label">{label}</span>
    </span>
  )
}

export function CallItScreen() {
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
    <header className="tabscreen__head">
      <h1 className="tabscreen__title">{t.title}</h1>
      <UmeInline size={48} />
    </header>
  )

  if (calendarError)
    return (
      <div className="tabscreen">
        {header}
        <ErrorNotice error={calendarError} onRetry={reloadCalendar} />
      </div>
    )
  if (meError)
    return (
      <div className="tabscreen">
        {header}
        <ErrorNotice error={meError} onRetry={refreshMe} />
      </div>
    )
  if (!calendar || !me)
    return (
      <div className="tabscreen" role="status" aria-live="polite">
        {header}
        <span className="visually-hidden">{copy.student.loading.calledIt}</span>
        <PanelSkeleton />
      </div>
    )

  const next = calendar.next
  const nameOf = (id: string) => catalog[id]?.name ?? id
  const last = me.last_guess
  // A call made today points at the next menu day; anything older is a past result.
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
      sound.stamp()
      ume.react('curious', pickLine(lines.pick), 2400)
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
    <div className="tabscreen">
      {header}

      {past && (
        <section className="paper paper--result" aria-labelledby="last-title">
          <ResultSeal result={past.correct === true ? 'right' : past.correct === false ? 'wrong' : 'pending'} />
          <div className="paper__result-body">
            <h2 id="last-title" className="section-title">
              {t.lastHeading}
            </h2>
            <p className="paper__lead">
              {past.correct === true
                ? t.lastRight(nameOf(past.item_id), fmtDay(past.target_date))
                : past.correct === false
                  ? t.lastWrong(nameOf(past.item_id), fmtDay(past.target_date))
                  : t.lastPending(nameOf(past.item_id), fmtDay(past.target_date))}
            </p>
            {past.correct === true && <span className="gold-tag num">{t.rightXp}</span>}
          </div>
        </section>
      )}

      {!next ? (
        <section className="paper">
          <p className="paper__lead">{t.noDay}</p>
        </section>
      ) : todays ? (
        <motion.section
          className="paper paper--result"
          aria-labelledby="locked-title"
          initial={reduce || !locked ? false : { opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={reduce ? fade : popSpring}
        >
          <span className="glyph-disc glyph-disc--big glyph-disc--entree">
            <FoodGlyph id={todays.item_id} />
          </span>
          <div className="paper__result-body">
            <h2 id="locked-title" className="section-title" tabIndex={-1} ref={lockedTitle}>
              <Lock className="inline-icon" />
              {t.lockedHeading}
            </h2>
            <p className="paper__lead">{t.lockedBody(nameOf(todays.item_id), fmtDay(todays.target_date))}</p>
          </div>
        </motion.section>
      ) : (
        <section className="paper" aria-labelledby="guess-title">
          <h2 id="guess-title" className="section-title">
            {t.question(fmtDay(next.date))}
          </h2>
          <p className="paper__lead">{t.lead}</p>
          {choices.length === 0 ? (
            <p className="paper__note">{t.empty}</p>
          ) : (
            <div className="choices" role="group" aria-labelledby="guess-title">
              {choices.map((c) => (
                <ChoiceRow
                  key={c.item_id}
                  item_id={c.item_id}
                  name={c.name}
                  facts={c}
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
            <p className="paper__error" role="alert">
              {error}
            </p>
          )}
          <motion.button type="button" className="btn-press btn-press--big" disabled={!chosen || busy} onClick={lock} whileTap={press}>
            {busy ? t.locking : chosen ? t.lock : t.pickFirst}
          </motion.button>
        </section>
      )}
    </div>
  )
}
