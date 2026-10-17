// The simulated school's calendar, per browser. A presenter steps it to show a new day; the
// live school never sees it. null means "use the server's default day".
import { useSyncExternalStore } from 'react'
import { storeGet, storeSet } from './device'

const KEY = 'lunchloop.demoDate'
const listeners = new Set<() => void>()
let day: string | null = /^\d{4}-\d{2}-\d{2}$/.test(storeGet(KEY) ?? '') ? storeGet(KEY) : null

export function getDemoDate(): string | null {
  return day
}

/** Pick a simulated day (YYYY-MM-DD), or null to go back to the server's default. */
export function setDemoDate(next: string | null) {
  day = next
  storeSet(KEY, next ?? '')
  listeners.forEach((l) => l())
}

export function useDemoDate(): string | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => {
        listeners.delete(l)
      }
    },
    () => day,
    () => null,
  )
}
