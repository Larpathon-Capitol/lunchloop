import { animate, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { api, ApiError } from '../shared/api'
import type { ForecastTrace, PrepItem } from '../shared/api'
import { backstage } from '../shared/copy/backstage'
import { componentName, fmtDay, fmtInt } from '../shared/format'
import { dur, useReducedMotion } from '../shared/motion'
import { useDemoDate } from '../shared/demo'
import { useApi } from '../shared/useApi'
import { ErrorNotice, Loading } from '../shared/ui/Notice'
import { stepSpring } from './springs'

const t = backstage.forecast

const MINUS = '−'
const dec = (n: number, d: number) =>
  new Intl.NumberFormat('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }).format(n)
const fmtRate = (n: number) => dec(n, 4)
const fmtSigned = (n: number) => {
  const r = Math.round(n)
  return r > 0 ? `+${fmtInt(r)}` : r < 0 ? `${MINUS}${fmtInt(-r)}` : '0'
}
const fmtPctExact = (p: number) => `${dec(p * 100, Number.isInteger(Math.round(p * 1000) / 10) ? 0 : 1)}%`
const shortDay = (iso: string) => fmtDay(iso, { weekday: 'short', month: 'short', day: 'numeric' })

/** Counts from zero once each time `k` changes. Screen readers get the final value only. */
function CountUp({ value, format, k }: { value: number; format: (n: number) => string; k: string }) {
  const reduce = useReducedMotion()
  const [shown, setShown] = useState(value)
  useEffect(() => {
    if (reduce) {
      setShown(value)
      return
    }
    const c = animate(0, value, { duration: dur.slow, ease: [0.2, 0, 0, 1], onUpdate: setShown })
    return () => c.stop()
  }, [k, value, reduce])
  return (
    <>
      <span className="visually-hidden">{format(value)}</span>
      <span aria-hidden="true">{format(shown)}</span>
    </>
  )
}

interface Term {
  value: ReactNode
  label: string
  result?: boolean
}

/** A worked line of math: each number sits over a plain label saying what it is. */
function Equation({ terms, ops }: { terms: Term[]; ops: string[] }) {
  return (
    <div className="b-eq">
      {terms.map((term, i) => (
        <span className="b-eq__group" key={i}>
          <span className="b-eq__op">{i > 0 ? ops[i - 1] : ''}</span>
          <span className="b-eq__term" data-result={term.result || undefined}>
            <span className="b-eq__value num">{term.value}</span>
            <span className="b-eq__label">{term.label}</span>
          </span>
        </span>
      ))}
    </div>
  )
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <li className="b-step">
      <span className="b-step__n num" aria-hidden="true">
        {n}
      </span>
      <div className="b-step__body">
        <h3 className="b-step__title">{title}</h3>
        {children}
      </div>
    </li>
  )
}

/** Past misses as dots around zero, with the spread shaded on either side. */
function MissStrip({ misses, sigma }: { misses: number[]; sigma: number }) {
  const reach = Math.max(sigma * 2, ...misses.map(Math.abs), 1)
  const pos = (v: number) => `${50 + (v / reach) * 48}%`
  return (
    <div className="b-strip" aria-hidden="true">
      <span className="b-strip__band" style={{ left: pos(-sigma), right: `calc(100% - ${pos(sigma)})` }} />
      <span className="b-strip__axis" />
      <span className="b-strip__zero" />
      {misses.map((m, i) => (
        <span key={i} className="b-strip__dot" style={{ left: pos(m) }} />
      ))}
    </div>
  )
}

function Trace({ tr, listPrep }: { tr: ForecastTrace; listPrep: number | undefined }) {
  const k = `${tr.item_id}-${tr.date}`
  const missServings = tr.misses.map((m) => m * tr.attendance)
  const raw = tr.z * tr.sigma
  const sum = tr.predicted + tr.buffer
  const weekday = tr.weekday
  return (
    <ol className="b-steps">
      <Step n={1} title={t.step1(tr.history.length, weekday)}>
        <p className="b-note">{t.step1Note}</p>
        <table className="b-table">
          <thead>
            <tr>
              <th scope="col">{t.step1Date}</th>
              <th scope="col">{t.step1Took}</th>
              <th scope="col">{t.step1Present}</th>
              <th scope="col">{t.step1Rate}</th>
            </tr>
          </thead>
          <tbody>
            {tr.history.map((h) => (
              <tr key={h.date}>
                <th scope="row">{shortDay(h.date)}</th>
                <td className="num">{fmtInt(h.taken)}</td>
                <td className="num">
                  <span className="b-table__op" aria-hidden="true">
                    /{' '}
                  </span>
                  {fmtInt(h.attendance)}
                </td>
                <td className="num">
                  <span className="b-table__op" aria-hidden="true">
                    ={' '}
                  </span>
                  {fmtRate(h.rate)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" colSpan={3}>
                {t.meanRate}
              </th>
              <td className="num">
                <CountUp k={k} value={tr.mean_rate} format={fmtRate} />
              </td>
            </tr>
          </tfoot>
        </table>
      </Step>

      <Step n={2} title={t.step2}>
        <p className="b-note">
          {t.step2Note(tr.attendance_history.length, weekday)}
          <span className="num">
            {tr.attendance_history.map((a) => `${fmtDay(a.date, { month: 'short', day: 'numeric' })}: ${fmtInt(a.attendance)}`).join(', ')}
          </span>
          .
        </p>
        <Equation
          ops={['×', '=']}
          terms={[
            { value: fmtRate(tr.mean_rate), label: t.meanRate.toLowerCase() },
            { value: fmtInt(tr.attendance), label: t.attendanceLabel },
            { value: <CountUp k={k} value={tr.predicted} format={fmtInt} />, label: t.predicted, result: true },
          ]}
        />
      </Step>

      <Step n={3} title={t.step3}>
        <p className="b-note">{t.step3Note}</p>
        {missServings.length > 0 && (
          <>
            <MissStrip misses={missServings} sigma={tr.sigma} />
            <p className="b-misses num">{missServings.map(fmtSigned).join('  ')}</p>
          </>
        )}
        {tr.sigma_fallback && <p className="b-note">{t.spreadFallback(dec(tr.predicted * 0.1, 1))}</p>}
        <Equation
          ops={[]}
          terms={[{ value: <CountUp k={k} value={tr.sigma} format={(n) => dec(n, 1)} />, label: `${t.spread}, ${t.servings}`, result: true }]}
        />
      </Step>

      <Step n={4} title={t.step4}>
        <p className="b-note">{t.step4Note(dec(tr.ratio, Number.isInteger(tr.ratio) ? 0 : 1))}</p>
        <Equation
          ops={['÷', '=']}
          terms={[
            { value: dec(tr.ratio, Number.isInteger(tr.ratio) ? 0 : 1), label: t.ratioLabel },
            { value: dec(tr.ratio + 1, Number.isInteger(tr.ratio) ? 0 : 1), label: t.ratioPlusOne },
            { value: fmtPctExact(tr.service_level), label: t.serviceLevel.toLowerCase() },
          ]}
        />
        <p className="b-note">
          {t.z} = <span className="num">{dec(tr.z, 3)}</span>. {t.zNote}
        </p>
        <Equation
          ops={['×', '=']}
          terms={[
            { value: dec(tr.z, 3), label: t.zLabel },
            { value: dec(tr.sigma, 1), label: t.spread.toLowerCase() },
            {
              value: <CountUp k={k} value={tr.buffer} format={(n) => `+${fmtInt(n)}`} />,
              label: t.bufferLabel(dec(raw, 2)),
              result: true,
            },
          ]}
        />
      </Step>

      <Step n={5} title={t.step5}>
        <Equation
          ops={['+', '=']}
          terms={[
            { value: fmtInt(tr.predicted), label: t.predicted },
            { value: fmtInt(tr.buffer), label: t.buffer.toLowerCase() },
            { value: <CountUp k={k} value={tr.prep} format={fmtInt} />, label: t.prep, result: true },
          ]}
        />
        {tr.floor > 0 && (
          <p className="b-note">{sum < tr.floor ? t.raisedToFloor(fmtInt(tr.floor)) : t.aboveFloor(fmtInt(tr.floor))}</p>
        )}
        <figure className="b-reason">
          <figcaption className="b-reason__label">{t.reason}</figcaption>
          <blockquote className="b-reason__text">{tr.reason}</blockquote>
        </figure>
        {listPrep !== undefined && (
          <p className="b-check" data-ok={listPrep === tr.prep || undefined}>
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              {listPrep === tr.prep ? (
                <path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
              ) : (
                <path d="M8 4v5M8 11.5v.5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
              )}
            </svg>
            {listPrep === tr.prep ? t.matches : t.differs(fmtInt(listPrep))}
          </p>
        )}
      </Step>
    </ol>
  )
}

function defaultItem(items: PrepItem[]) {
  return (items.find((i) => i.component === 'meat_alternate') ?? items[0])?.item_id ?? null
}

/** Follows the presenter's simulated day: the prep list and every trace are for that day. */
export function ForecastSteps() {
  const demoDate = useDemoDate()
  const [prep, reloadPrep] = useApi(() => api.prep(demoDate ?? undefined), [demoDate])
  const [picked, setPicked] = useState<string | null>(null)
  const [trace, setTrace] = useState<ForecastTrace | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [busy, setBusy] = useState(false)
  const [retry, setRetry] = useState(0)
  const reduce = useReducedMotion()

  const items = prep.state === 'ready' ? prep.data.items : []
  const date = prep.state === 'ready' ? prep.data.date : undefined
  // A dish picked on another day may not be on this day's menu.
  const selected = picked && items.some((i) => i.item_id === picked) ? picked : defaultItem(items)

  useEffect(() => {
    if (!selected || !date) return
    let live = true
    setBusy(true)
    api
      .traceForecast(selected, date)
      .then((r) => {
        if (!live) return
        setTrace(r)
        setError(null)
      })
      .catch((e) => live && setError(e instanceof ApiError ? e : new ApiError(0, String(e))))
      .finally(() => live && setBusy(false))
    return () => {
      live = false
    }
  }, [selected, date, retry])

  let body: ReactNode
  if (prep.state === 'loading') body = <Loading label={t.prepLoading} />
  else if (prep.state === 'error') body = <ErrorNotice error={prep.error} onRetry={reloadPrep} />
  else if (items.length === 0) body = <p className="b-note">{t.empty}</p>
  else {
    const listPrep = items.find((i) => i.item_id === trace?.item_id)?.prep
    body = (
      <div className="b-fc__grid">
        <div className="b-fc__pick">
          <label className="b-select">
            <span className="b-select__label">{t.pick}</span>
            <select value={selected ?? ''} onChange={(e) => setPicked(e.target.value)}>
              {items.map((i) => (
                <option key={i.item_id} value={i.item_id}>
                  {i.name}
                </option>
              ))}
            </select>
          </label>
          <ul className="b-items" aria-label={t.pick}>
            {items.map((i) => (
              <li key={i.item_id}>
                <button
                  type="button"
                  className="b-item"
                  aria-pressed={i.item_id === selected}
                  onClick={() => setPicked(i.item_id)}
                >
                  <span className="b-item__name">{i.name}</span>
                  <span className="b-item__meta">{componentName(i.component)}</span>
                  <span className="b-item__prep num">{fmtInt(i.prep)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="b-fc__steps" aria-busy={busy} aria-live="off">
          {error && !trace ? (
            <ErrorNotice error={error} onRetry={() => setRetry((n) => n + 1)} />
          ) : !trace ? (
            <Loading label={t.loading} />
          ) : (
            <motion.div
              key={trace.item_id}
              initial={reduce ? false : { opacity: 0.4 }}
              animate={{ opacity: busy ? 0.6 : 1 }}
              transition={reduce ? { duration: 0 } : stepSpring}
            >
              <h3 className="b-fc__item">{trace.name}</h3>
              <Trace tr={trace} listPrep={listPrep} />
              {error && <ErrorNotice error={error} onRetry={() => setRetry((n) => n + 1)} />}
            </motion.div>
          )}
        </div>
      </div>
    )
  }

  return (
    <section className="b-panel b-fc" aria-labelledby="b-fc-h">
      <h2 id="b-fc-h" className="b-panel__title">
        {t.heading}
      </h2>
      {date && <p className="b-panel__lead">{t.lead(fmtDay(date))}</p>}
      {body}
    </section>
  )
}
