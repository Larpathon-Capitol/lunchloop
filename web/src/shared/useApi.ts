import { useCallback, useEffect, useState } from 'react'
import { ApiError } from './api'

export type Loadable<T> =
  | { state: 'loading' }
  | { state: 'error'; error: ApiError }
  | { state: 'ready'; data: T }

/** Runs `load` on mount and whenever `deps` change. `reload` runs it again. */
export function useApi<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const [value, setValue] = useState<Loadable<T>>({ state: 'loading' })
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let live = true
    load()
      .then((data) => live && setValue({ state: 'ready', data }))
      .catch((e) => {
        if (!live) return
        const error = e instanceof ApiError ? e : new ApiError(0, String(e))
        setValue({ state: 'error', error })
      })
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  return [value, reload, setValue] as const
}
