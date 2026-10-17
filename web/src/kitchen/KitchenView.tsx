import { useEffect, useRef, useState } from 'react'
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
import { DEFAULT_CONTROLS, Simulator } from './Simulator'
import type { Controls } from './Simulator'
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

  return (
    <div className="kitchen">
      <header className="kitchen__head">
        <div>
          <h1 className="kitchen__title">{t.title(fmtDay(sim.date, { weekday: 'long', month: 'short', day: 'numeric' }))}</h1>
          <p className="kitchen__sub num">{t.attendance(fmtInt(sim.attendance))}</p>
        </div>
        <SimulatedTag />
      </header>

      <div className="kitchen__grid">
        <div className="kitchen__check">
          <MealCheck check={sim.meal_check} items={sim.items} />
        </div>
        <div className="kitchen__list">
          <PrepList items={sim.items} />
        </div>
        <div className="kitchen__sim">
          <Simulator controls={controls} onChange={setControls} totals={sim.totals} busy={busy} failed={failed} />
        </div>
      </div>

      <div className="kitchen__savings">
        {savings.state === 'ready' && <Savings data={savings.data} />}
        {savings.state === 'loading' && <Loading />}
        {savings.state === 'error' && <ErrorNotice error={savings.error} onRetry={reloadSavings} />}
      </div>
    </div>
  )
}
