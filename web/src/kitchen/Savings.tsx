import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Savings as SavingsData } from '../shared/api'
import { copy } from '../shared/copy'
import { fmtDay, fmtInt, fmtMoney, fmtPct } from '../shared/format'
import { PairBars } from './Bars'
import { CountUp } from './CountUp'
import { PHONE_QUERY, useMedia } from './useMedia'

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
const kilo = (n: number) => (n >= 1000 ? `${Math.round(n / 100) / 10}k` : fmtInt(n))
/** Percent drop from `before` to `after`, or null when there is nothing to compare. */
const cut = (after: number, before: number) => (before > 0 ? Math.round((100 * (before - after)) / before) : null)

function Swatch({ kind }: { kind: 'taken' | 'lunchloop' | 'usual' }) {
  return (
    <svg className="k-legend__swatch" width="24" height="10" viewBox="0 0 24 10" aria-hidden="true">
      <line x1="1" y1="5" x2="23" y2="5" className={`k-swatch k-swatch--${kind}`} />
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

/**
 * The money bridge: what less waste saved, minus what running short cost (at the shortage ratio),
 * leaves the net. Same formula as the backtest; the short part is taken from the rounded figures
 * so the three numbers on screen always add up.
 */
function Bridge({ data }: { data: SavingsData }) {
  const lessWaste = Math.round(data.usual.dollars_wasted - data.lunchloop.dollars_wasted)
  const net = Math.round(data.net_dollars_saved)
  const penalty = lessWaste - net
  if (lessWaste <= 0 || net <= 0 || penalty < 0) return null
  const netPct = (net / lessWaste) * 100
  return (
    <div className="k-bridge">
      <p className="k-bridge__title">{t.net.bridgeTitle}</p>
      <div className="k-bridge__bar" aria-hidden="true">
        <span className="k-bridge__net" style={{ width: `${netPct}%` }} />
        <span className="k-bridge__pen" style={{ width: `${100 - netPct}%` }} />
      </div>
      <dl className="k-bridge__rows">
        <div>
          <dt><span className="k-dot k-dot--total" aria-hidden="true" />{t.net.lessWaste}</dt>
          <dd className="num">{fmtMoney(lessWaste)}</dd>
        </div>
        <div>
          <dt><span className="k-dot k-dot--warn" aria-hidden="true" />{t.net.shortPenalty(data.shortage_ratio)}</dt>
          <dd className="num">−{fmtMoney(penalty)}</dd>
        </div>
        <div className="k-bridge__sum">
          <dt><span className="k-dot k-dot--good" aria-hidden="true" />{t.net.netLabel}</dt>
          <dd className="num">{fmtMoney(net)}</dd>
        </div>
      </dl>
    </div>
  )
}

function DailyChart({ days, closer }: { days: Day[]; closer: boolean }) {
  const phone = useMedia(PHONE_QUERY)
  const lo = Math.min(...days.map((d) => Math.min(d.taken, d.lunchloop, d.usual)))
  const hi = Math.max(...days.map((d) => Math.max(d.taken, d.lunchloop, d.usual)))
  // A line chart can start above zero; it keeps the gap between the lines readable.
  const floor = Math.max(0, Math.floor((lo - 250) / 500) * 500)
  const ceil = Math.ceil((hi + 100) / 500) * 500
  const step = (ceil - floor) / 500 > 6 ? 1000 : 500
  const ticks: number[] = []
  for (let v = Math.ceil(floor / step) * step; v <= ceil; v += step) ticks.push(v)

  return (
    <figure className="k-chart" aria-labelledby="k-chart-title">
      <h3 id="k-chart-title" className="k-chart__title">{closer ? tc.headingCloser : tc.headingNeutral}</h3>
      <p className="k-chart__sub">{tc.summary(days.length)}</p>
      <ul className="k-legend">
        <li><Swatch kind="taken" />{tc.taken}</li>
        <li><Swatch kind="lunchloop" />{tc.lunchloop}</li>
        <li><Swatch kind="usual" />{tc.usual}</li>
      </ul>
      <div className="k-chart__frame" role="img" aria-label={tc.ariaLabel}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={days} margin={{ top: 8, right: phone ? 8 : 16, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--line)" strokeOpacity={0.6} vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={short}
              tick={{ fill: 'var(--nezumi)', fontSize: phone ? 12 : 13 }}
              tickLine={false}
              axisLine={false}
              minTickGap={phone ? 28 : 40}
              interval="preserveStartEnd"
              tickMargin={8}
            />
            <YAxis
              tick={{ fill: 'var(--nezumi)', fontSize: phone ? 12 : 13 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={phone ? kilo : fmtInt}
              domain={[floor, ceil]}
              ticks={ticks}
              width={phone ? 36 : 56}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--line)' }} />
            <Line dataKey="usual" name={tc.usual} stroke="var(--nezumi)" strokeWidth={1.5} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
            <Line dataKey="lunchloop" name={tc.lunchloop} stroke="var(--shu)" strokeWidth={2.5} dot={false} isAnimationActive={false} />
            <Line dataKey="taken" name={tc.taken} stroke="var(--sumi)" strokeWidth={2.5} dot={false} isAnimationActive={false} />
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
  )
}

export function Savings({ data }: { data: SavingsData }) {
  const days = byDay(data.series)
  const ll = data.lunchloop
  const us = data.usual
  // fmtMoney rounds to whole dollars, so anything under 50 cents reads as $0.
  const net = Math.abs(data.net_dollars_saved) < 0.5 ? 'even' : data.net_dollars_saved > 0 ? 'saved' : 'cost'

  if (days.length === 0) {
    return (
      <section className="k-panel" aria-labelledby="sav-title">
        <h2 id="sav-title" className="k-panel__title">{t.heading}</h2>
        <p className="k-panel__empty">{t.empty}</p>
      </section>
    )
  }

  const from = short(days[0].date)
  const to = short(days[days.length - 1].date)
  const wastedCut = cut(ll.dollars_wasted, us.dollars_wasted)
  const fewer = us.leftover_servings - ll.leftover_servings

  return (
    <section className="k-hero" aria-labelledby="sav-title">
      <div className="k-hero__top">
        <h2 id="sav-title" className="k-hero__title">{t.heading}</h2>
        <p className="k-hero__eyebrow">{t.eyebrow(data.weeks, from, to)}</p>
      </div>

      <div className="k-hero__grid">
        <div className="k-hero__cut">
          <p className="k-hero__claim">
            <span className="k-hero__big"><CountUp value={data.leftover_cut_pct} format={fmtPct} /></span>
            <span className="k-hero__unit">{t.cutUnit}</span>
          </p>
          <p className="k-hero__sub">{t.cutSub}</p>
          <div className="k-leftbars">
            <p className="k-mini__title">{t.leftoversTitle}</p>
            <ul className="k-bars k-bars--lg">
              <li className="k-bars__row">
                <span className="k-bars__label">{t.barUsual}</span>
                <span className="k-bars__track" aria-hidden="true">
                  <span className="k-bars__fill k-bars__fill--usual" style={{ width: '100%' }} />
                </span>
                <span className="k-bars__val num">{fmtInt(us.leftover_servings)}</span>
              </li>
              <li className="k-bars__row">
                <span className="k-bars__label">{t.colLunchloop}</span>
                <span className="k-bars__track" aria-hidden="true">
                  <span
                    className="k-bars__fill k-bars__fill--main"
                    style={{ width: us.leftover_servings > 0 ? `${(ll.leftover_servings / us.leftover_servings) * 100}%` : '0%' }}
                  />
                  {fewer > 0 && (
                    <span className="k-bars__gap" style={{ width: `${(fewer / us.leftover_servings) * 100}%` }}>
                      <span className="k-bars__gap-text num">{t.fewer(fmtInt(fewer))}</span>
                    </span>
                  )}
                </span>
                <span className="k-bars__val num">{fmtInt(ll.leftover_servings)}</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="k-hero__money">
          {net === 'even' ? (
            <p className="k-hero__even">{t.net.even} {t.net.sub}</p>
          ) : (
            <>
              <p className="k-hero__claim k-hero__claim--money">
                <span className={`k-hero__mid ${net === 'saved' ? 'k-hero__mid--good' : ''}`}>
                  <CountUp value={Math.abs(data.net_dollars_saved)} format={fmtMoney} />
                </span>
                <span className="k-hero__unit">{net === 'saved' ? t.net.saved : t.net.cost}</span>
              </p>
              <p className="k-hero__sub">{net === 'saved' ? t.net.sub : t.net.costSub}</p>
            </>
          )}
          {net === 'saved' && <Bridge data={data} />}
          <details className="k-foot">
            <summary className="k-foot__toggle">{t.net.howToggle}</summary>
            <p>{t.net.how(data.shortage_ratio)}</p>
            <p>{t.shortNote(fmtInt(ll.servings_short), fmtInt(us.servings_short))}</p>
          </details>
        </div>
      </div>

      <div className="k-multi">
        <div className="k-mini">
          <p className="k-mini__title">{wastedCut !== null && wastedCut > 0 ? t.wastedTake(wastedCut) : t.wasted}</p>
          <p className="k-mini__metric">{t.wasted}</p>
          <PairBars rows={[
            { label: t.colLunchloop, value: ll.dollars_wasted, text: fmtMoney(ll.dollars_wasted), tone: 'main' },
            { label: t.barUsual, value: us.dollars_wasted, text: fmtMoney(us.dollars_wasted), tone: 'usual' },
          ]} />
        </div>
        <div className="k-mini">
          <p className="k-mini__title">{ll.servings_short > us.servings_short ? t.shortTake : t.short}</p>
          <p className="k-mini__metric">{t.short}</p>
          <PairBars rows={[
            { label: t.colLunchloop, value: ll.servings_short, text: fmtInt(ll.servings_short), tone: 'warn' },
            { label: t.barUsual, value: us.servings_short, text: fmtInt(us.servings_short), tone: 'usual' },
          ]} />
        </div>
        <div className="k-mini">
          <p className="k-mini__title">{t.shortCost}</p>
          <p className="k-mini__metric">{t.shortCostTake(data.shortage_ratio)}</p>
          <PairBars rows={[
            { label: t.colLunchloop, value: ll.dollars_short, text: fmtMoney(ll.dollars_short), tone: 'warn' },
            { label: t.barUsual, value: us.dollars_short, text: fmtMoney(us.dollars_short), tone: 'usual' },
          ]} />
        </div>
      </div>

      <div className="visually-hidden">
        <table>
          <caption>{t.tableCaption}</caption>
          <thead>
            <tr>
              <th scope="col">{t.colMetric}</th>
              <th scope="col">{t.colLunchloop}</th>
              <th scope="col">{t.colUsual}</th>
            </tr>
          </thead>
          <tbody>
            <tr><th scope="row">{t.leftovers}</th><td>{fmtInt(ll.leftover_servings)}</td><td>{fmtInt(us.leftover_servings)}</td></tr>
            <tr><th scope="row">{t.wasted}</th><td>{fmtMoney(ll.dollars_wasted)}</td><td>{fmtMoney(us.dollars_wasted)}</td></tr>
            <tr><th scope="row">{t.short}</th><td>{fmtInt(ll.servings_short)}</td><td>{fmtInt(us.servings_short)}</td></tr>
            <tr><th scope="row">{t.shortCost}</th><td>{fmtMoney(ll.dollars_short)}</td><td>{fmtMoney(us.dollars_short)}</td></tr>
          </tbody>
        </table>
      </div>

      <DailyChart days={days} closer={ll.avg_miss < us.avg_miss} />
    </section>
  )
}
