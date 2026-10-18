// Call it: guess which entree will be most popular on the next school day.
// The API only accepts entrees (meat_alternate) on that day's menu, so those are the choices.
// The call is a card from the world (see callit/CallCard): blank, then filled as you pick, then
// stamped with the world's seal when you lock it in, with the mascot keeping watch over it.
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { burstPetals } from '../celebrate/burst'
import { UmeInline, mascotName, pickLine, ume } from '../mascot'
import { api, ApiError, type PrepItem } from '../shared/api'
import { copy } from '../shared/copy'
import { callit, stableLine } from '../shared/copy/callit'
import { fmtDay } from '../shared/format'
import { Lock } from '../shared/icons'
import { press } from '../shared/motion'
import { sound } from '../shared/sound'
import { ErrorNotice } from '../shared/ui/Notice'
import { useKit, useThemeInfo } from '../theme/registry'
import { CallCard } from './callit/CallCard'
import { CallerRecord } from './callit/CallerRecord'
import { ChoiceRow } from './ChoiceRow'
import { isTomorrow, schoolDaysBetween } from './days'
import { FoodGlyph } from './FoodGlyph'
import { fade } from './springs'
import { useStudent } from './state'
import { PanelSkeleton } from './VoteScreen'
import './callit.css'

const t = callit

type Result = 'right' | 'wrong' | 'pending'

/** A pencil ring for a call that missed or is still waiting. A right call gets the world's seal. */
function PencilSeal({ result }: { result: Exclude<Result, 'right'> }) {
  return (
    <span className={`result-seal result-seal--${result}`}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r="45" className="result-seal__ring" />
        <circle cx="50" cy="50" r="38" className="result-seal__inner" />
      </svg>
      <span className="result-seal__label">{result === 'wrong' ? t.last.sealWrong : t.last.sealPending}</span>
    </span>
  )
}

/** The previous call, scored or not: a torn-off stub of the card with the mascot's verdict. */
function LastCall({ item_id, name, date, result }: { item_id: string; name: string; date: string; result: Result }) {
  const kit = useKit()
  const info = useThemeInfo()
  const words = t.cards[info.id]
  const day = fmtDay(date)
  const line = stableLine(result === 'right' ? words.right : result === 'wrong' ? words.wrong : words.waiting, date)
  return (
    <section className={`callit-stub callit-stub--${result}`} aria-labelledby="callit-last-title">
      <span className="glyph-disc glyph-disc--big glyph-disc--entree callit-stub__disc">
        <FoodGlyph id={item_id} />
      </span>
      <div className="callit-stub__body">
        <h2 id="callit-last-title" className="callit-stub__title">
          {t.last.heading}
        </h2>
        <p className="callit-stub__lead">
          {result === 'right' ? t.last.right(name, day) : result === 'wrong' ? t.last.wrong(name, day) : t.last.pending(name, day)}
        </p>
        <p className="callit-stub__say">
          <span className="callit-stub__who">{info.mascotName}:</span> {line}
        </p>
        {result === 'right' && <span className="gold-tag num">{t.last.xp}</span>}
      </div>
      <span className="callit-stub__seal">
        {result === 'right' ? <kit.Seal visible silent size={84} label={t.last.sealRight} /> : <PencilSeal result={result} />}
      </span>
    </section>
  )
}

/** "beef_nachos" to "Beef nachos", for a past call whose food isn't in the catalog. */
const prettyId = (id: string) => {
  const words = id.replace(/_/g, ' ').trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

const WIDE = '(min-width: 720px)'

/** Room for the card beside the choices. */
function useWide(): boolean {
  return useSyncExternalStore(
    (l) => {
      const mq = window.matchMedia(WIDE)
      mq.addEventListener('change', l)
      return () => mq.removeEventListener('change', l)
    },
    () => window.matchMedia(WIDE).matches,
    () => true,
  )
}

export function CallItScreen() {
  const { device, me, meError, refreshMe, calendar, calendarError, reloadCalendar, catalog, addToCatalog, showFood } = useStudent()
  const reduce = useReducedMotion()
  const wide = useWide()
  const info = useThemeInfo()
  const [selected, setSelected] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [locked, setLocked] = useState<{ item_id: string; target_date: string } | null>(null)
  /** The seal lands a beat after the card settles, only for a call made just now. */
  const [sealed, setSealed] = useState(false)
  const alive = useRef(true)
  const lockedTitle = useRef<HTMLHeadingElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  // After locking in, move focus to the confirmation so it is read out.
  useEffect(() => {
    if (locked) lockedTitle.current?.focus({ preventScroll: true })
  }, [locked])

  // The lock-in moment: the card glides into place, then the seal lands and the world's bits fly.
  useEffect(() => {
    if (!locked) return
    const sealAt = window.setTimeout(() => setSealed(true), reduce ? 0 : 420)
    const burstAt = window.setTimeout(() => {
      if (cardRef.current) burstPetals(cardRef.current, { count: 28, power: 0.8 })
    }, 420 + 200)
    return () => {
      window.clearTimeout(sealAt)
      window.clearTimeout(burstAt)
    }
  }, [locked, reduce])

  // A past call's food may not be on any menu we loaded; fetch that day's menu once for its name.
  const lastId = me?.last_guess?.item_id
  const lastDate = me?.last_guess?.target_date
  const needName = !!lastId && !!lastDate && !catalog[lastId]
  useEffect(() => {
    if (!needName || !lastDate) return
    let live = true
    api
      .prep(lastDate)
      .then((p) => live && addToCatalog(p.items))
      .catch(() => {
        // The id still shows, tidied up.
      })
    return () => {
      live = false
    }
  }, [needName, lastDate, addToCatalog])

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const header = (
    <header className="tabscreen__head callit__head">
      <h1 className="tabscreen__title">{t.title}</h1>
      <UmeInline size={48} />
    </header>
  )

  if (calendarError)
    return (
      <div className="tabscreen callit">
        {header}
        <ErrorNotice error={calendarError} onRetry={reloadCalendar} />
      </div>
    )
  if (meError)
    return (
      <div className="tabscreen callit">
        {header}
        <ErrorNotice error={meError} onRetry={refreshMe} />
      </div>
    )
  if (!calendar || !me)
    return (
      <div className="tabscreen callit" role="status" aria-live="polite">
        {header}
        <span className="visually-hidden">{copy.student.loading.calledIt}</span>
        <PanelSkeleton />
      </div>
    )

  const next = calendar.next
  const nameOf = (id: string) => catalog[id]?.name ?? next?.items.find((i) => i.item_id === id)?.name ?? prettyId(id)
  const last = me.last_guess
  // A call made today points at the next menu day; anything older is a past result.
  const todays = locked ?? (last && next && last.target_date === next.date ? last : null)
  const past = last && (!todays || last.target_date !== todays.target_date) ? last : null
  const choices: PrepItem[] = next ? next.items.filter((i) => i.component === 'meat_alternate') : []
  const chosen = choices.find((c) => c.item_id === selected)
  const words = t.cards[info.id]

  const lock = async () => {
    if (!selected) return
    setBusy(true)
    setError(null)
    try {
      const r = await api.guess(device, selected)
      void refreshMe()
      if (!alive.current) return
      // The seal plays the world's stamp sound as it lands.
      ume.react('excited', pickLine(words.hype), 2600)
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

  const cardMotion = { layoutId: 'callit-card', transition: reduce ? fade : { type: 'spring' as const, stiffness: 260, damping: 26 } }

  let stage: ReactNode
  if (!next) {
    stage = (
      <section className="callit-empty">
        <p className="paper__lead">{t.noDay}</p>
      </section>
    )
  } else if (todays) {
    const fresh = !!locked
    const togo = schoolDaysBetween(calendar.today, todays.target_date)
    const enter = (i: number) =>
      reduce || !fresh ? {} : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { delay: 0.25 + i * 0.08, duration: 0.32, ease: [0.22, 1, 0.36, 1] as const } }
    stage = (
      <section className="callit-locked" aria-labelledby="locked-title">
        <motion.div
          className="callit-locked__card"
          ref={cardRef}
          {...cardMotion}
          initial={!fresh || reduce ? false : wide ? { rotate: 3 } : { opacity: 0, y: -28, rotate: -12, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, rotate: -3, scale: 1 }}
        >
          <CallCard item_id={todays.item_id} name={nameOf(todays.item_id)} date={todays.target_date} sealed={fresh ? sealed : true} fresh={fresh} />
        </motion.div>
        <div className="callit-locked__info">
          <motion.p className="callit-locked__kicker" {...enter(0)}>
            <Lock className="inline-icon" />
            {t.lockedHeading}
          </motion.p>
          <motion.h2 id="locked-title" className="callit-locked__title" tabIndex={-1} ref={lockedTitle} {...enter(1)}>
            {t.lockedBody(nameOf(todays.item_id))}
          </motion.h2>
          <motion.div className="callit-count" {...enter(2)}>
            <span className="callit-count__row">
              {togo > 0 ? (
                <>
                  <span className="callit-count__n num">{t.countNumber(togo)}</span>
                  <span className="callit-count__unit">{t.countUnit(togo)}</span>
                </>
              ) : (
                <span className="callit-count__unit">{t.countToday}</span>
              )}
            </span>
            <span className="callit-count__when">{t.scoredOn(fmtDay(todays.target_date))}</span>
          </motion.div>
          <motion.figure className="callit-guard" {...enter(3)}>
            <blockquote className="callit-guard__line">{stableLine(words.guard, todays.target_date)}</blockquote>
            <figcaption className="callit-guard__who">{t.says(mascotName(info.mascot))}</figcaption>
          </motion.figure>
        </div>
      </section>
    )
  } else {
    stage = (
      <section className="callit-choose" aria-labelledby="guess-title">
        <div className="callit-choose__intro">
          <p className="callit-choose__kicker">{t.kicker(fmtDay(next.date), isTomorrow(calendar.today, next.date))}</p>
          <h2 id="guess-title" className="callit-choose__q">
            {t.question}
          </h2>
          <p className="callit-choose__lead">{t.lead}</p>
        </div>
        <div className="callit-choose__pick">
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
          <motion.button type="button" className="btn-press btn-press--big callit-lock" disabled={!chosen || busy} onClick={lock} whileTap={press}>
            {busy ? t.locking : chosen ? t.lock : t.pickFirst}
          </motion.button>
        </div>
        {wide && (
          <div className="callit-choose__card">
            <motion.div className="callit-choose__cardmove" {...cardMotion} initial={false} animate={{ rotate: 3 }}>
              <CallCard item_id={chosen?.item_id ?? null} name={chosen?.name ?? null} date={next.date} sealed={false} />
            </motion.div>
            <p className="callit-choose__cardlabel">{t.yourCall}</p>
          </div>
        )}
      </section>
    )
  }

  return (
    <div className="tabscreen callit">
      {header}
      {past && (
        <LastCall
          item_id={past.item_id}
          name={nameOf(past.item_id)}
          date={past.target_date}
          result={past.correct === true ? 'right' : past.correct === false ? 'wrong' : 'pending'}
        />
      )}
      <LayoutGroup>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div key={todays ? 'locked' : 'choose'} className="callit__stage" exit={reduce ? { opacity: 0 } : { opacity: 0, y: 8, transition: { duration: 0.18 } }}>
            {stage}
          </motion.div>
        </AnimatePresence>
      </LayoutGroup>
      <CallerRecord me={me} />
    </div>
  )
}
