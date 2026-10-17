import { CartesianGrid, Label, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Savings as SavingsData } from '../shared/api'
import { copy } from '../shared/copy'
import { fmtDay, fmtInt, fmtMoney, fmtPct } from '../shared/format'
import { CountUp } from './CountUp'

const t = copy.kitchen.savings
const tc = copy.kitchen.chart

interface Day {
  date: string
  taken: number
  lunchloop: number
  usual: number
}

/** Adds up every menu item for each school day. */
function byDay(series: SavingsData['series']): Day[] {
  const m = new Map<string, Day>()
  for (const r of series) {
    const d = m.get(r.date) ?? { date: r.date, taken: 0, lunchloop: 0, usual: 0 }
    d.taken += r.taken
    d.lunchloop += r.prep_lunchloop
    d.usual += r.prep_usual
    m.set(r.date, d)
  }
  return [...m.values()].sort((a, b) => a.date.localeCompare(b.date))
}

const short = (iso: string) => fmtDay(iso, { month: 'short', day: 'numeric' })

function Swatch({ kind }: { kind: 'taken' | 'lunchloop' | 'usual' }) {
  return (
    <svg className="k-legend__swatch" width="28" height="10" viewBox="0 0 28 10" aria-hidden="true">
      <line x1="1" y1="5" x2="27" y2="5" className={`k-swatch k-swatch--${kind}`} />
    </svg>
  )
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { dataKey: string; value: number }[]; label?: string }) {
  if (!active || !payload?.length || !label) return null
  const get = (k: string) => payload.find((p) => p.dataKey === k)?.value ?? 0
  return (
    <div className="k-tip">
      <p className="k-tip__date">{fmtDay(label)}</p>
      <dl className="k-tip__rows">
        <div><dt>{tc.taken}</dt><dd className="num">{fmtInt(get('taken'))}</dd></div>
        <div><dt>{tc.lunchloop}</dt><dd className="num">{fmtInt(get('lunchloop'))}</dd></div>
        <div><dt>{tc.usual}</dt><dd className="num">{fmtInt(get('usual'))}</dd></div>
      </dl>
    </div>
  )
}

export function Savings({ data }: { data: SavingsData }) {
  const days = byDay(data.series)
  const from = days.length ? short(days[0].date) : ''
  const to = days.length ? short(days[days.length - 1].date) : ''
  const ll = data.lunchloop
  const us = data.usual

  if (days.length === 0) {
    return (
      <section className="k-panel" aria-labelledby="sav-title">
        <h2 id="sav-title" className="k-panel__title">{t.heading}</h2>
        <p className="k-panel__empty">{t.empty}</p>
      </section>
    )
  }

  return (
    <section className="k-panel k-savings" aria-labelledby="sav-title">
      <h2 id="sav-title" className="k-panel__title">{t.heading}</h2>

      <p className="k-savings__headline">
        <span className="k-savings__big"><CountUp value={data.leftover_cut_pct} format={fmtPct} /></span>{' '}
        <span className="k-savings__rest">
          {t.headline(data.weeks, from, to)}
        </span>
      </p>

      <table className="k-cmp">
        <caption className="visually-hidden">{t.tableCaption}</caption>
        <thead>
          <tr>
            <th scope="col"><span className="visually-hidden">{t.colMetric}</span></th>
            <th scope="col" className="k-cmp__num">{t.colLunchloop}</th>
            <th scope="col" className="k-cmp__num">{t.colUsual}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">{t.leftovers}</th>
            <td className="k-cmp__num">{fmtInt(ll.leftover_servings)}</td>
            <td className="k-cmp__num">{fmtInt(us.leftover_servings)}</td>
          </tr>
          <tr>
            <th scope="row">{t.wasted}</th>
            <td className="k-cmp__num">{fmtMoney(ll.dollars_wasted)}</td>
            <td className="k-cmp__num">{fmtMoney(us.dollars_wasted)}</td>
          </tr>
          <tr>
            <th scope="row">{t.short}</th>
            <td className="k-cmp__num">{fmtInt(ll.servings_short)}</td>
            <td className="k-cmp__num">{fmtInt(us.servings_short)}</td>
          </tr>
        </tbody>
      </table>
      <p className="k-savings__note">{t.shortNote(fmtInt(ll.servings_short), fmtInt(us.servings_short))}</p>

      <figure className="k-chart">
        <h3 className="k-chart__title">{tc.heading}</h3>
        <p className="k-chart__sub">{tc.summary(days.length, from, to)}</p>
        <ul className="k-legend">
          <li><Swatch kind="taken" />{tc.taken}</li>
          <li><Swatch kind="lunchloop" />{tc.lunchloop}</li>
          <li><Swatch kind="usual" />{tc.usual}</li>
        </ul>
        <div className="k-chart__frame">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={days} aria-label={tc.ariaLabel} margin={{ top: 8, right: 28, bottom: 28, left: 4 }}>
              <CartesianGrid stroke="var(--line)" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={short}
                tick={{ fill: 'var(--slate)', fontSize: 14 }}
                tickLine={false}
                axisLine={{ stroke: 'var(--line)' }}
                minTickGap={24}
                interval="preserveStartEnd"
              >
                <Label value={tc.xLabel} position="bottom" offset={4} fill="var(--slate)" fontSize={14} />
              </XAxis>
              <YAxis
                tick={{ fill: 'var(--slate)', fontSize: 14 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={fmtInt}
                domain={[0, (max: number) => Math.ceil(max / 1000) * 1000]}
                tickCount={5}
                width={76}
              >
                <Label value={tc.yLabel} angle={-90} position="insideLeft" offset={4} fill="var(--slate)" fontSize={14} style={{ textAnchor: 'middle' }} />
              </YAxis>
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--line)' }} />
              <Line dataKey="usual" name={tc.usual} stroke="var(--slate)" strokeWidth={1.5} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
              <Line dataKey="lunchloop" name={tc.lunchloop} stroke="var(--slate)" strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line dataKey="taken" name={tc.taken} stroke="var(--ink)" strokeWidth={3} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="visually-hidden">
        <table>
          <caption>{tc.tableCaption}</caption>
          <thead>
            <tr>
              <th scope="col">{tc.colDay}</th>
              <th scope="col">{tc.taken}</th>
              <th scope="col">{tc.lunchloop}</th>
              <th scope="col">{tc.usual}</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => (
              <tr key={d.date}>
                <th scope="row">{fmtDay(d.date)}</th>
                <td>{fmtInt(d.taken)}</td>
                <td>{fmtInt(d.lunchloop)}</td>
                <td>{fmtInt(d.usual)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </figure>
    </section>
  )
}
