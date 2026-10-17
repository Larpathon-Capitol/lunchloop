// The game's heads-up strip: streak, XP, and this school week (Monday to Friday) as small circles.
// Played days this week get a pink blossom; today is ringed and pulses gently until it's
// played; days still ahead stay quiet. Nothing is ever red or "missed".
import { motion, useReducedMotion } from 'framer-motion'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { NumberRoll } from '../celebrate'
import { copy } from '../shared/copy'
import { fmtDay, previousSchoolDay, schoolWeek } from '../shared/format'
import { Coin, Flame } from '../shared/icons'
import { popSpring } from './springs'

const t = copy.student.hud

/** The days the streak covers: `streak` weekdays ending today (if played) or the school day before. */
export function activeDays(today: string, streak: number, doneToday: boolean): Set<string> {
  const out = new Set<string>()
  let day = doneToday ? today : previousSchoolDay(today)
  for (let i = 0; i < streak; i++) {
    out.add(day)
    day = previousSchoolDay(day)
  }
  return out
}

function BlossomMark() {
  return (
    <svg viewBox="0 0 24 24" className="week__blossom" aria-hidden="true">
      {[0, 72, 144, 216, 288].map((a) => (
        <ellipse key={a} cx="12" cy="7.2" rx="3.6" ry="4.4" transform={`rotate(${a} 12 12)`} />
      ))}
      <circle cx="12" cy="12" r="2" className="week__heart" />
    </svg>
  )
}

/** A counter that gives a small scale pulse each time its number goes up. */
function Pulse({ value, reduce, children }: { value: number | null; reduce: boolean; children: ReactNode }) {
  const prev = useRef(value)
  const [beat, setBeat] = useState(0)
  useEffect(() => {
    if (value !== null && prev.current !== null && value > prev.current) setBeat((b) => b + 1)
    prev.current = value
  }, [value])
  return (
    <motion.span
      key={beat}
      className="hud__value"
      initial={false}
      animate={reduce || !beat ? { scale: 1 } : { scale: [1, 1.15, 1] }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.span>
  )
}

interface Props {
  today: string | null
  streak: number | null
  xp: number | null
  doneToday: boolean
  /** Changes when the streak should pop (after packing or voting). */
  bump: number
}

export function Hud({ today, streak, xp, doneToday, bump }: Props) {
  const reduce = useReducedMotion()
  const days = today ? schoolWeek(today) : []
  const active = today && streak !== null ? activeDays(today, streak, doneToday) : new Set<string>()
  return (
    <section className="hud" aria-label={t.label}>
      <div className="hud__stat hud__stat--streak">
        <motion.span
          key={bump}
          className="hud__icon hud__icon--streak"
          initial={reduce || !bump ? false : { scale: 1 }}
          animate={reduce || !bump ? { scale: 1 } : { scale: [1, 0.6, 1.35, 1] }}
          transition={{ duration: 0.55, times: [0, 0.2, 0.6, 1], ease: [0.22, 1, 0.36, 1] }}
        >
          <Flame />
          {!reduce && bump > 0 && (
            <motion.span
              className="hud__ring"
              aria-hidden="true"
              initial={{ scale: 0.5, opacity: 0.6 }}
              animate={{ scale: 2.2, opacity: 0 }}
              transition={{ duration: 0.6, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
            />
          )}
        </motion.span>
        <Pulse value={streak} reduce={!!reduce}>
          {streak === null ? <span className="hud__blank" /> : <NumberRoll value={streak} />}
        </Pulse>
        <span className="hud__label">{t.streak}</span>
      </div>
      <div className="hud__stat">
        <span className="hud__icon hud__icon--xp">
          <Coin />
        </span>
        <Pulse value={xp} reduce={!!reduce}>
          {xp === null ? <span className="hud__blank" /> : <NumberRoll value={xp} />}
        </Pulse>
        <span className="hud__label">{t.xp}</span>
      </div>
      <ol className="week" aria-label={t.week}>
        {days.map((day) => {
          const isToday = day === today
          const future = !!today && day > today
          const on = !future && active.has(day)
          const name = fmtDay(day, { weekday: 'long', month: 'short', day: 'numeric' })
          const label = isToday ? (doneToday ? t.dayTodayDone(name) : t.dayToday(name)) : on ? t.dayActive(name) : future ? t.dayAhead(name) : t.dayQuiet(name)
          return (
            <li key={day} className="week__day" aria-label={label}>
              <span
                className={`week__dot${on ? ' week__dot--on' : ''}${isToday ? ' week__dot--today' : ''}${isToday && !doneToday ? ' week__dot--waiting' : ''}${future ? ' week__dot--future' : ''}`}
              >
                {on && (
                  <motion.span
                    key={`${day}-${bump}`}
                    className="week__ink"
                    initial={reduce || !(isToday && bump) ? false : { scale: 0.2, rotate: -30, opacity: 0 }}
                    animate={{ scale: 1, rotate: 0, opacity: 1 }}
                    transition={popSpring}
                  >
                    <BlossomMark />
                  </motion.span>
                )}
              </span>
              <span className={`week__name${isToday ? ' week__name--today' : ''}`} aria-hidden="true">
                {fmtDay(day, { weekday: 'narrow' })}
              </span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
