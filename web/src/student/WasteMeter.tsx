// The school waste meter: leftovers avoided versus cooking the usual amount, in the simulated
// school's latest week. Drawn as a ticket stub: a big number that counts up the first time it
// scrolls into view, and a stack of saved plates on the torn-off side, in the world's colors.
import { animate, motion, useInView, useReducedMotion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { BrushProgress } from '../celebrate'
import type { Meter } from '../shared/api'
import { waste as t } from '../shared/copy/waste'
import { fmtDay, fmtInt, fmtMoney } from '../shared/format'
import { useThemeId } from '../theme/store'
import type { ThemeId } from '../theme/types'
import './waste.css'

/** Weeks whose count already ran, so coming back to the Tray tab doesn't replay it. */
const counted = new Set<string>()

const PLATES = 5

/** The world's mark on the top plate, in the world's real colors. */
function PlateMark({ world }: { world: ThemeId }) {
  if (world === 'asia') {
    return (
      <g className="plates__mark">
        {[0, 72, 144, 216, 288].map((r) => (
          <path key={r} d="M0 -1C-5 -4 -6 -10 -2.4 -13L0 -11L2.4 -13C6 -10 5 -4 0 -1Z" transform={`rotate(${r})`} fill="#FF8FAB" />
        ))}
        <circle r="2.2" fill="#BE2B1A" />
      </g>
    )
  }
  if (world === 'medi') {
    return (
      <g className="plates__mark">
        <rect x="-8" y="-8" width="16" height="16" fill="#0A6C70" />
        <rect x="-8" y="-8" width="16" height="16" fill="#0A6C70" transform="rotate(45)" />
        <circle r="3.4" fill="#FFE5EC" />
      </g>
    )
  }
  return (
    <g className="plates__mark">
      {[45, 135, 225, 315].map((r) => (
        <ellipse key={r} cy="-5.5" rx="3" ry="5.5" fill="#1D3FAE" transform={`rotate(${r})`} />
      ))}
      <circle r="2.6" fill="#FFC72C" />
    </g>
  )
}

/** A stack of clean plates, seen from a little above. They settle in one by one. */
function Plates({ show, still }: { show: boolean; still: boolean }) {
  const world = useThemeId()
  return (
    <svg className="plates" viewBox="0 0 120 120" aria-hidden="true" focusable="false">
      <ellipse className="plates__shadow" cx="60" cy="104" rx="46" ry="9" />
      {Array.from({ length: PLATES }, (_, i) => {
        const y = 92 - i * 11
        const top = i === PLATES - 1
        return (
          <motion.g
            key={i}
            initial={still ? false : { y: -26, opacity: 0 }}
            animate={show ? { y: 0, opacity: 1 } : undefined}
            transition={{
              delay: 0.15 + i * 0.09,
              type: 'spring',
              stiffness: 520,
              damping: 26,
            }}
          >
            <g transform={`translate(60 ${y})`}>
              <ellipse className="plates__side" cx="0" cy="3" rx="44" ry="12" />
              <ellipse className="plates__rim" cx="0" cy="0" rx="44" ry="12" />
              <ellipse className="plates__band" cx="0" cy="0" rx="35" ry="9" />
              <ellipse className="plates__well" cx="0" cy="0.5" rx="28" ry="7" />
              {top && (
                <g transform="scale(1 0.3)">
                  <PlateMark world={world} />
                </g>
              )}
            </g>
          </motion.g>
        )
      })}
      <motion.path
        className="plates__spark"
        d="M98 18C99 26 99 26 107 27C99 28 99 28 98 36C97 28 97 28 89 27C97 26 97 26 98 18Z"
        initial={still ? false : { scale: 0, opacity: 0 }}
        animate={show ? { scale: 1, opacity: 1 } : undefined}
        transition={{
          delay: 0.15 + PLATES * 0.09 + 0.1,
          type: 'spring',
          stiffness: 400,
          damping: 14,
        }}
        style={{ transformOrigin: '98px 27px' }}
      />
    </svg>
  )
}

/** Counts from 0 to `value` once `run` turns true. Starts at the end if `still`. */
function useCount(value: number, run: boolean, still: boolean) {
  const [shown, setShown] = useState(0)
  useEffect(() => {
    if (still || !run) return
    const controls = animate(0, value, {
      duration: 1.1,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (n) => setShown(Math.round(n)),
    })
    return () => controls.stop()
  }, [value, run, still])
  return still ? value : shown
}

export function WasteMeter({ meter }: { meter: Meter }) {
  const reduce = useReducedMotion()
  const [still] = useState(() => !!reduce || counted.has(meter.week_start))
  const ref = useRef<HTMLElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.5 })
  const show = still || inView
  useEffect(() => {
    if (show) counted.add(meter.week_start)
  }, [show, meter.week_start])

  const servings = Math.round(meter.servings_saved)
  const shown = useCount(servings, inView, still)
  // Show dollars only when LunchLoop still comes out ahead after counting shortages.
  const showDollars = meter.net_dollars_saved >= 0.5
  const week = fmtDay(meter.week_start, { month: 'short', day: 'numeric' })
  const unit = t.unit(servings)

  return (
    <section className="leftovers" aria-labelledby="meter-title" ref={ref}>
      <div className="leftovers__main">
        <div className="leftovers__head">
          <h2 id="meter-title" className="leftovers__title">
            {t.heading}
          </h2>
          <p className="leftovers__week">{t.week(week)}</p>
        </div>
        {servings > 0 ? (
          // A div, not a p: the brush underline is a div, which can't sit inside a paragraph.
          <div className="leftovers__stat">
            <span className="visually-hidden">{t.spoken(fmtInt(servings), unit)}</span>
            <span className="leftovers__figure" aria-hidden="true">
              <span className="leftovers__big num">{fmtInt(shown)}</span>
              <span className="leftovers__underline">
                <BrushProgress value={show ? 1 : 0} height={16} color="var(--pink-4, #FF8FAB)" />
              </span>
            </span>
            <div className="leftovers__words">
              <p className="leftovers__unit" aria-hidden="true">
                {unit}
              </p>
              <p className="leftovers__note">
                {t.note}
                {showDollars && <> {t.dollars(fmtMoney(meter.net_dollars_saved))}</>}
              </p>
            </div>
          </div>
        ) : (
          <p className="leftovers__note">{t.none}</p>
        )}
      </div>
      <div className="leftovers__stub" aria-hidden="true">
        <Plates show={show} still={still} />
      </div>
    </section>
  )
}
