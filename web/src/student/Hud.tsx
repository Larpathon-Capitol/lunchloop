// The game's heads-up strip: streak, XP, and the last five school days as small circles.
// Active days get a vermilion blossom; today pulses gently until it's played. Other days stay
// plain paper, never red, never "missed".
import { motion, useReducedMotion } from 'framer-motion'
import { NumberRoll } from '../celebrate'
import { copy } from '../shared/copy'
import { fmtDay, lastSchoolDays, previousSchoolDay } from '../shared/format'
import { Blossom, Coin } from '../shared/icons'
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
  const days = today ? lastSchoolDays(today, 5) : []
  const active = today && streak !== null ? activeDays(today, streak, doneToday) : new Set<string>()
  return (
    <section className="hud" aria-label={t.label}>
      <div className="hud__stat hud__stat--streak">
        <motion.span
          key={bump}
          className="hud__icon hud__icon--streak"
          initial={reduce || !bump ? false : { scale: 0.4, rotate: -40 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={popSpring}
        >
          <Blossom />
        </motion.span>
        <span className="hud__value">{streak === null ? <span className="hud__blank" /> : <NumberRoll value={streak} />}</span>
        <span className="hud__label">{t.streak}</span>
      </div>
      <div className="hud__stat">
        <span className="hud__icon hud__icon--xp">
          <Coin />
        </span>
        <span className="hud__value">{xp === null ? <span className="hud__blank" /> : <NumberRoll value={xp} />}</span>
        <span className="hud__label">{t.xp}</span>
      </div>
      <ol className="week" aria-label={t.week}>
        {days.map((day) => {
          const isToday = day === today
          const on = active.has(day)
          const name = fmtDay(day, { weekday: 'long', month: 'short', day: 'numeric' })
          const label = isToday ? (doneToday ? t.dayTodayDone(name) : t.dayToday(name)) : on ? t.dayActive(name) : t.dayQuiet(name)
          return (
            <li key={day} className="week__day" aria-label={label}>
              <span className={`week__dot${on ? ' week__dot--on' : ''}${isToday && !doneToday ? ' week__dot--today' : ''}`}>
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
              <span className="week__name" aria-hidden="true">
                {fmtDay(day, { weekday: 'narrow' })}
              </span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
