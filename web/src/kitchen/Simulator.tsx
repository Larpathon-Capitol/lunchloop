import { useId } from 'react'
import type { Totals } from '../shared/api'
import { copy } from '../shared/copy'
import { fmtInt, fmtMoney } from '../shared/format'

const t = copy.kitchen.sim

export interface Controls {
  attendance: number // multiplier
  price: number // multiplier
  ratio: number
}
export const DEFAULT_CONTROLS: Controls = { attendance: 1, price: 1, ratio: 3 }

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
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <div className="k-slider__ends" aria-hidden="true">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </div>
  )
}

export function Simulator({ controls, onChange, totals, busy, failed }: {
  controls: Controls
  onChange: (c: Controls) => void
  totals: Totals
  busy: boolean
  failed: boolean
}) {
  const pct = (m: number) => Math.round(m * 100)
  const isDefault =
    controls.attendance === DEFAULT_CONTROLS.attendance &&
    controls.price === DEFAULT_CONTROLS.price &&
    controls.ratio === DEFAULT_CONTROLS.ratio

  return (
    <section className="k-panel k-sim" aria-labelledby="sim-title">
      <h2 id="sim-title" className="k-panel__title">{t.heading}</h2>

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

      <div className="k-sim__totals" aria-busy={busy}>
        <h3 className="k-sim__totals-title">{t.totalsHeading}</h3>
        <dl className="k-sim-stats" aria-live="polite">
          <div className="k-sim-stat">
            <dt>{t.prepServings}</dt>
            <dd><span className="num">{fmtInt(totals.prep_servings)}</span></dd>
          </div>
          <div className="k-sim-stat">
            <dt>{t.leftovers}</dt>
            <dd><span className="num">{fmtInt(totals.expected_leftover_servings)}</span></dd>
          </div>
          <div className="k-sim-stat">
            <dt>{t.foodCost}</dt>
            <dd><span className="num">{fmtMoney(totals.food_cost)}</span></dd>
          </div>
          <div className="k-sim-stat">
            <dt>{t.wasteCost}</dt>
            <dd><span className="num">{fmtMoney(totals.expected_waste_cost)}</span></dd>
          </div>
        </dl>
        {failed && <p className="k-sim__status" role="alert">{t.updateFailed}</p>}
      </div>

      <button className="btn btn--quiet k-sim__reset" disabled={isDefault} onClick={() => onChange(DEFAULT_CONTROLS)}>
        {t.reset}
      </button>
    </section>
  )
}
