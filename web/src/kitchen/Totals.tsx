import type { Totals as TotalsData } from '../shared/api'
import { copy } from '../shared/copy'
import { fmtInt, fmtMoney } from '../shared/format'

const t = copy.kitchen.totals

type Key = keyof TotalsData

const TILES: { key: Key; label: string; fmt: (n: number) => string }[] = [
  { key: 'prep_servings', label: t.prepServings, fmt: fmtInt },
  { key: 'expected_leftover_servings', label: t.leftovers, fmt: fmtInt },
  { key: 'food_cost', label: t.foodCost, fmt: fmtMoney },
  { key: 'expected_waste_cost', label: t.wasteCost, fmt: fmtMoney },
]

/** Change against the starting plan, in whole percent. */
function delta(now: number, start: number): number | null {
  if (!(start > 0)) return null
  return Math.round((100 * (now - start)) / start)
}

/**
 * The day's totals as four tiles. Each tile has a tiny two-bar chart: this plan against the
 * starting plan (all sliders at usual), so a slider move shows up as a bar growing or shrinking.
 */
export function Totals({ totals, start, busy }: { totals: TotalsData; start: TotalsData | null; busy: boolean }) {
  return (
    <section className="k-tiles" aria-labelledby="k-tiles-title" aria-busy={busy}>
      <div className="k-tiles__head">
        <h3 id="k-tiles-title" className="k-tiles__title">{t.heading}</h3>
        {start && (
          <ul className="k-key" aria-hidden="true">
            <li><span className="k-key__sw k-key__sw--now" />{t.now}</li>
            <li><span className="k-key__sw k-key__sw--start" />{t.start}</li>
          </ul>
        )}
      </div>
      <dl className="k-tiles__grid" aria-live="polite">
        {TILES.map(({ key, label, fmt }) => {
          const now = totals[key]
          const base = start?.[key]
          const d = base === undefined ? null : delta(now, base)
          const max = Math.max(now, base ?? 0)
          const w = (n: number) => `${max > 0 ? (n / max) * 100 : 0}%`
          const tone = d === null || d === 0 ? 'same' : d > 0 ? 'up' : 'down'
          return (
            <div key={key} className="k-tile">
              <dt className="k-tile__label">{label}</dt>
              <dd className="k-tile__value num">{fmt(now)}</dd>
              {base !== undefined && (
                <dd className="k-tile__viz">
                  <span className="k-tile__bars" aria-hidden="true">
                    <span className="k-tile__bar k-tile__bar--now" style={{ width: w(now) }} />
                    <span className="k-tile__bar k-tile__bar--start" style={{ width: w(base) }} />
                  </span>
                  <span className={`k-tile__delta k-tile__delta--${tone}`}>
                    {d === null || d === 0 ? t.same : t.delta(d > 0 ? '+' : '−', Math.abs(d))}
                  </span>
                </dd>
              )}
            </div>
          )
        })}
      </dl>
    </section>
  )
}
