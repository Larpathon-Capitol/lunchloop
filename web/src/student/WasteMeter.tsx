// The school waste meter: leftovers avoided versus cooking the usual amount, in the
// simulated school's latest week, drawn as a short row of lunch trays that fill once.
// Each tray is a fixed number of servings (picked so there are at most 8), and the
// row is exactly as long as the number needs, so it never implies a goal.
import { motion, useReducedMotion } from 'framer-motion'
import { useEffect, useState } from 'react'
import type { Meter } from '../shared/api'
import { copy } from '../shared/copy'
import { fmtDay, fmtInt, fmtMoney } from '../shared/format'
import { dur } from '../shared/motion'
import { CountUp } from './CountUp'

const t = copy.student.meter
const MAX_TRAYS = 8
const UNITS = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000]
/** Weeks whose trays already filled, so coming back to Today doesn't replay it. */
const filled = new Set<string>()

function trayUnit(servings: number) {
  return UNITS.find((u) => Math.ceil(servings / u) <= MAX_TRAYS) ?? UNITS[UNITS.length - 1]
}

function Tray() {
  return (
    <svg viewBox="0 0 22 14" aria-hidden="true">
      <rect x="0.75" y="0.75" width="20.5" height="12.5" rx="2" />
      <path d="M8 1v12M8 7h13.2" />
    </svg>
  )
}

export function WasteMeter({ meter }: { meter: Meter }) {
  const reduce = useReducedMotion()
  const [still] = useState(() => reduce || filled.has(meter.week_start))
  useEffect(() => {
    filled.add(meter.week_start)
  }, [meter.week_start])
  const unit = trayUnit(meter.servings_saved)
  const count = Math.max(1, Math.ceil(meter.servings_saved / unit))
  const trays = Array.from({ length: count }, (_, i) => Math.min(1, Math.max(0, meter.servings_saved / unit - i)))
  const stagger = dur.med / count
  const week = fmtDay(meter.week_start, { month: 'short', day: 'numeric' })

  return (
    <section className="meter" aria-labelledby="meter-title">
      <div className="meter__head">
        <h2 id="meter-title" className="section-title">
          {t.heading}
        </h2>
        <p className="meter__week">{t.week(week)}</p>
      </div>
      <div className="meter__figures">
        <p className="meter__figure">
          <span className="meter__big">
            <CountUp id="meter-servings" value={meter.servings_saved} format={fmtInt} />
          </span>
          <span className="meter__label">{t.servings}</span>
        </p>
        <p className="meter__figure">
          <span className="meter__big">
            <CountUp id="meter-dollars" value={meter.dollars_saved} format={fmtMoney} />
          </span>
          <span className="meter__label">{t.dollars}</span>
        </p>
      </div>
      <div className="meter__trays" style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }} role="img" aria-label={t.figure(fmtInt(meter.servings_saved), fmtMoney(meter.dollars_saved), week)}>
        {trays.map((fill, i) => (
          <span className="meter__tray" key={i}>
            <span className="meter__tray-empty">
              <Tray />
            </span>
            <motion.span
              className="meter__tray-full"
              initial={still ? false : { clipPath: 'inset(0 100% 0 0)' }}
              whileInView={{ clipPath: `inset(0 ${(1 - fill) * 100}% 0 0)` }}
              viewport={{ once: true }}
              style={still ? { clipPath: `inset(0 ${(1 - fill) * 100}% 0 0)` } : undefined}
              transition={{ duration: dur.fast, delay: i * stagger, ease: [0.2, 0, 0, 1] }}
            >
              <Tray />
            </motion.span>
          </span>
        ))}
      </div>
      <p className="meter__unit">{t.unit(unit)}</p>
    </section>
  )
}
