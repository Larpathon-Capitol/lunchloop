// The school waste meter: leftovers avoided versus cooking the usual amount, in the
// simulated school's latest week, told as one sentence. The number gets a brush underline
// that paints once, the first time the meter scrolls into view for that week.
import { useInView, useReducedMotion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { BrushProgress } from '../celebrate'
import type { Meter } from '../shared/api'
import { copy } from '../shared/copy'
import { fmtDay, fmtInt, fmtMoney } from '../shared/format'
import { CountUp } from './CountUp'
import './stampbook.css'

const t = copy.student.meter
/** Weeks whose underline already painted, so coming back to Today doesn't replay it. */
const painted = new Set<string>()

export function WasteMeter({ meter }: { meter: Meter }) {
  const reduce = useReducedMotion()
  const [still] = useState(() => reduce || painted.has(meter.week_start))
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.6 })
  const show = still || inView
  useEffect(() => {
    if (show) painted.add(meter.week_start)
  }, [show, meter.week_start])

  const servings = Math.round(meter.servings_saved)
  // Show dollars only when LunchLoop still comes out ahead after counting shortages.
  const showDollars = meter.net_dollars_saved >= 0.5
  const week = fmtDay(meter.week_start, { month: 'short', day: 'numeric' })

  return (
    <section className="leftovers" aria-labelledby="meter-title">
      <div className="leftovers__head">
        <h2 id="meter-title" className="leftovers__title">
          {t.heading}
        </h2>
        <p className="leftovers__week">{t.week(week)}</p>
      </div>
      {servings > 0 ? (
        // A div, not a p: the brush underline is a div, which can't sit inside a paragraph.
        <div className="leftovers__sentence" ref={ref}>
          {t.lead}{' '}
          <span className="leftovers__figure">
            <span className="leftovers__big">
              <CountUp id="meter-servings" value={servings} format={fmtInt} />
            </span>
            <span className="leftovers__underline" aria-hidden="true">
              <BrushProgress value={show ? 1 : 0} height={14} color="var(--pink-4, #FF8FAB)" />
            </span>
          </span>{' '}
          {t.servings(servings)}
          {showDollars ? (
            <>
              {t.dollarsLead}
              <span className="leftovers__money num">{fmtMoney(meter.net_dollars_saved)}</span>
              {t.dollarsTail}
            </>
          ) : (
            t.end
          )}
        </div>
      ) : (
        <p className="leftovers__sentence">{t.none}</p>
      )}
    </section>
  )
}
