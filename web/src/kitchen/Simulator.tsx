import { useEffect, useId, useRef } from 'react'
import type { CSSProperties, MouseEvent as ReactMouseEvent, TouchEvent as ReactTouchEvent } from 'react'
import type { Totals } from '../shared/api'
import { copy } from '../shared/copy'
import { fmtInt, fmtMoney } from '../shared/format'

import { DEFAULT_CONTROLS } from './controls'
import type { Controls } from './controls'

const t = copy.kitchen.sim


function Slider({ label, value, text, min, max, step, low, high, onChange }: {
  label: string
  value: number
  text: string
  min: number
  max: number
  step: number
  low: string
  high: string
  onChange: (v: number) => void
}) {
  const id = useId()
  const fill = `${((value - min) / (max - min)) * 100}%`
  return (
    <div className="k-slider">
      <div className="k-slider__head">
        <label htmlFor={id} className="k-slider__label">{label}</label>
        <output htmlFor={id} className="k-slider__value num">{text}</output>
      </div>
      <input
        id={id}
        className="k-slider__input"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={text}
        style={{ '--fill': fill } as CSSProperties}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <div className="k-slider__ends" aria-hidden="true">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </div>
  )
}

/**
 * The plan sliders. Desktop: a sticky side panel. Phone (`drawer`): a bar pinned to the bottom of
 * the screen that opens into a sheet, so the sliders are one tap away from anywhere on the page.
 */
export function Simulator({ controls, onChange, totals, busy, failed, drawer, open, onOpenChange }: {
  controls: Controls
  onChange: (c: Controls) => void
  totals: Totals
  busy: boolean
  failed: boolean
  drawer: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const pct = (m: number) => Math.round(m * 100)
  const isDefault =
    controls.attendance === DEFAULT_CONTROLS.attendance &&
    controls.price === DEFAULT_CONTROLS.price &&
    controls.ratio === DEFAULT_CONTROLS.ratio
  const showBody = !drawer || open
  // Phone sheet: tap anywhere on the bar, or swipe it up or down. The button is the keyboard way in.
  const touchY = useRef<number | null>(null)
  const barHandlers = drawer
    ? {
        onClick: (e: ReactMouseEvent) => {
          if (!(e.target as HTMLElement).closest('button')) onOpenChange(!open)
        },
        onTouchStart: (e: ReactTouchEvent) => {
          touchY.current = e.touches[0].clientY
        },
        onTouchEnd: (e: ReactTouchEvent) => {
          const start = touchY.current
          touchY.current = null
          if (start === null) return
          const dy = e.changedTouches[0].clientY - start
          if (dy < -30 && !open) onOpenChange(true)
          if (dy > 30 && open) onOpenChange(false)
        },
      }
    : {}

  useEffect(() => {
    if (!drawer || !open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drawer, open, onOpenChange])

  return (
    <section
      className={`k-sim ${drawer ? 'k-sim--drawer' : ''} ${drawer && open ? 'is-open' : ''}`}
      aria-labelledby="sim-title"
      aria-busy={busy}
    >
      <div className="k-sim__bar" {...barHandlers}>
        <div className="k-sim__titles">
          <h2 id="sim-title" className="k-sim__title">{t.heading}</h2>
          {drawer ? (
            <p className="k-sim__summary num">{t.summary(pct(controls.attendance), pct(controls.price), controls.ratio)}</p>
          ) : (
            <p className="k-sim__sub">{t.sub}</p>
          )}
        </div>
        {drawer && (
          <button
            type="button"
            className="k-sim__toggle"
            aria-expanded={open}
            aria-controls="k-sim-body"
            onClick={() => onOpenChange(!open)}
          >
            {open ? t.close : t.open}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d={open ? 'm6 9 6 6 6-6' : 'm6 15 6-6 6 6'} />
            </svg>
          </button>
        )}
      </div>

      {showBody && (
        <div id="k-sim-body" className="k-sim__body">
          <Slider
            label={t.attendance}
            value={controls.attendance}
            text={t.attendanceValue(pct(controls.attendance))}
            min={0.7} max={1.3} step={0.05}
            low={t.attendanceLow} high={t.attendanceHigh}
            onChange={(v) => onChange({ ...controls, attendance: v })}
          />
          <Slider
            label={t.price}
            value={controls.price}
            text={t.priceValue(pct(controls.price))}
            min={0.7} max={1.3} step={0.05}
            low={t.priceLow} high={t.priceHigh}
            onChange={(v) => onChange({ ...controls, price: v })}
          />
          <Slider
            label={t.ratio}
            value={controls.ratio}
            text={t.ratioValue(controls.ratio)}
            min={1} max={9} step={1}
            low={t.ratioLow} high={t.ratioHigh}
            onChange={(v) => onChange({ ...controls, ratio: v })}
          />

          {failed && <p className="k-sim__status" role="alert">{t.updateFailed}</p>}
          <div className="k-sim__foot">
            {drawer && (
              <p className="k-sim__readout num" aria-live="polite">
                {t.readout(fmtInt(totals.prep_servings), fmtInt(totals.expected_leftover_servings), fmtMoney(totals.expected_waste_cost))}
              </p>
            )}
            <button className="btn btn--quiet k-sim__reset" disabled={isDefault} onClick={() => onChange(DEFAULT_CONTROLS)}>
              {drawer ? t.resetShort : t.reset}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
