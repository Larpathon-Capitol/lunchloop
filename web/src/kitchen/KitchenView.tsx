import { useCallback, useEffect, useRef, useState } from 'react'
import { api, ApiError } from '../shared/api'
import type { SimulateResult } from '../shared/api'
import { copy } from '../shared/copy'
import { fmtDay, fmtInt } from '../shared/format'
import { useApi } from '../shared/useApi'
import { ErrorNotice, Loading } from '../shared/ui/Notice'
import { SimulatedTag } from '../shared/ui/SimulatedTag'
import { MealCheck } from './MealCheck'
import { PrepList } from './PrepList'
import { Savings } from './Savings'
import { Totals } from './Totals'
import { PHONE_QUERY, useMedia } from './useMedia'
import { useReducedMotion } from '../shared/motion'
import { Simulator } from './Simulator'
import { DEFAULT_CONTROLS } from './controls'
import type { Controls } from './controls'
import './kitchen.css'

const t = copy.kitchen
const DEBOUNCE_MS = 250

/** The value, delayed until it has stopped changing for `ms`. */
function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms)
    return () => clearTimeout(id)
  }, [value, ms])
  return v
}

export function KitchenView() {
  const [controls, setControls] = useState<Controls>(DEFAULT_CONTROLS)
  const settled = useDebounced(controls, DEBOUNCE_MS)

  // Every control change goes to POST /api/simulate. The last good answer stays on screen meanwhile.
  const [sim, setSim] = useState<SimulateResult | null>(null)
  const [loadError, setLoadError] = useState<ApiError | null>(null)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(true)
  const [retry, setRetry] = useState(0)
  const hasData = useRef(false)

  useEffect(() => {
    let live = true
    setBusy(true)
    api
      .simulate({
        attendance_multiplier: settled.attendance,
        price_multiplier: settled.price,
        ratio: settled.ratio,
      })
      .then((r) => {
        if (!live) return
        hasData.current = true
        setSim(r)
        setFailed(false)
        setLoadError(null)
        setBusy(false)
      })
      .catch((e) => {
        if (!live) return
        if (hasData.current) setFailed(true)
        else setLoadError(e instanceof ApiError ? e : new ApiError(0, String(e)))
        setBusy(false)
      })
    return () => {
      live = false
    }
  }, [settled, retry])

  // The backtest always uses the default setting, so its headline does not move with the sliders.
  const [savings, reloadSavings] = useApi(() => api.savings(), [])
  // The starting plan (every slider at usual), so the totals can show what a slider move changed.
  const [start] = useApi(
    () => api.simulate({ attendance_multiplier: DEFAULT_CONTROLS.attendance, price_multiplier: DEFAULT_CONTROLS.price, ratio: DEFAULT_CONTROLS.ratio }),
    [],
  )

  const phone = useMedia(PHONE_QUERY)
  const reduce = useReducedMotion()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const tilesRef = useRef<HTMLDivElement>(null)
  const simRef = useRef<HTMLDivElement>(null)
  const openDrawer = useCallback(
    (open: boolean) => {
      setDrawerOpen(open)
      // Bring the totals and bars into view above the sheet, so the effect of a slider is visible.
      const el = tilesRef.current
      if (open && el) {
        const top = el.getBoundingClientRect().top
        if (top < 0 || top > window.innerHeight * 0.3) {
          el.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' })
        }
      }
    },
    [reduce],
  )

  if (loadError) {
    return (
      <div className="kitchen">
        <ErrorNotice error={loadError} onRetry={() => setRetry((n) => n + 1)} />
      </div>
    )
  }
  if (!sim) {
    return (
      <div className="kitchen">
        <Loading label={t.loading} />
      </div>
    )
  }

  const goToSliders = () => {
    const el = simRef.current
    if (!el) return
    el.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' })
    el.querySelector<HTMLInputElement>('input[type="range"]')?.focus({ preventScroll: true })
  }
  const pct = (m: number) => Math.round(m * 100)

  const day = fmtDay(sim.date, { weekday: 'long', month: 'short', day: 'numeric' })

  return (
    <div className={`kitchen ${phone ? 'kitchen--drawer' : ''}`}>
      <header className="kitchen__head">
        <h1 className="kitchen__title">{t.pageTitle}</h1>
        <SimulatedTag />
        <p className="kitchen__sub num">{t.pageSub(day, fmtInt(sim.attendance))}</p>
        {!phone && (
          <div className="k-quick">
            <span className="k-quick__title">{t.sim.heading}</span>
            <ul className="k-quick__vals num">
              <li>{t.sim.attendance} <b>{pct(controls.attendance)}%</b></li>
              <li>{t.sim.price} <b>{pct(controls.price)}%</b></li>
              <li>{t.sim.ratio} <b>{controls.ratio}×</b></li>
            </ul>
            <button type="button" className="btn btn--quiet k-quick__btn" onClick={goToSliders}>
              {t.sim.quickOpen}
            </button>
          </div>
        )}
      </header>

      <div className="kitchen__savings">
        {savings.state === 'ready' && <Savings data={savings.data} />}
        {savings.state === 'loading' && <Loading />}
        {savings.state === 'error' && <ErrorNotice error={savings.error} onRetry={reloadSavings} />}
      </div>

      <section className="kitchen__plan" aria-labelledby="plan-title">
        <div className="kitchen__plan-head">
          <h2 id="plan-title" className="kitchen__plan-title">{t.plan.heading(day)}</h2>
          <MealCheck check={sim.meal_check} items={sim.items} />
        </div>
        <div className="kitchen__grid">
          <div className="kitchen__main">
            <div ref={tilesRef} className="kitchen__tiles">
              <Totals totals={sim.totals} start={start.state === 'ready' ? start.data.totals : null} busy={busy} />
            </div>
            <PrepList items={sim.items} />
          </div>
          <div ref={simRef} className="kitchen__sim">
            <Simulator
              controls={controls}
              onChange={setControls}
              totals={sim.totals}
              busy={busy}
              failed={failed}
              drawer={phone}
              open={drawerOpen}
              onOpenChange={openDrawer}
            />
          </div>
        </div>
      </section>
    </div>
  )
}
