import { useCallback, useEffect, useRef, useState } from 'react'
import { api, ApiError } from '../shared/api'
import type { AdminSummary } from '../shared/api'

const POLL_MS = 8000

export type SummaryState =
  | { state: 'loading' }
  | { state: 'error'; error: ApiError }
  | { state: 'ready'; data: AdminSummary; stale: boolean }

/**
 * The school summary, refreshed every 8 seconds while the tab is visible. A refresh never
 * flashes a loading state: the last numbers stay up, and unchanged answers cause no re-render.
 * A 401 means the sign-in ran out.
 */
export function useSummary(token: string, onExpired: () => void) {
  const [value, setValue] = useState<SummaryState>({ state: 'loading' })
  const last = useRef('')
  const expiredRef = useRef(onExpired)
  expiredRef.current = onExpired
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let live = true
    let inFlight = false
    let timer: ReturnType<typeof setInterval> | undefined
    last.current = ''

    const load = async () => {
      if (inFlight) return
      inFlight = true
      try {
        const data = await api.adminSummary(token)
        if (!live) return
        const key = JSON.stringify(data)
        if (key !== last.current) {
          last.current = key
          setValue({ state: 'ready', data, stale: false })
        } else {
          setValue((v) => (v.state === 'ready' && v.stale ? { ...v, stale: false } : v))
        }
      } catch (e) {
        if (!live) return
        const error = e instanceof ApiError ? e : new ApiError(0, String(e))
        if (error.status === 401) {
          expiredRef.current()
          return
        }
        setValue((v) => (v.state === 'ready' ? (v.stale ? v : { ...v, stale: true }) : { state: 'error', error }))
      } finally {
        inFlight = false
      }
    }

    const start = () => {
      stop()
      timer = setInterval(() => void load(), POLL_MS)
    }
    const stop = () => {
      if (timer !== undefined) clearInterval(timer)
      timer = undefined
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void load()
        start()
      } else {
        stop()
      }
    }

    void load()
    if (document.visibilityState === 'visible') start()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      live = false
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [token, tick])

  const retry = useCallback(() => {
    setValue({ state: 'loading' })
    setTick((n) => n + 1)
  }, [])
  return [value, retry] as const
}
