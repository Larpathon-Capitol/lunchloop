// Which world the student picked. Saved per browser, mirrored onto <html data-theme="...">
// so tokens.css can restyle everything without React re-rendering the page.
import { useSyncExternalStore } from 'react'
import { storeGet, storeSet } from '../shared/device'
import { THEMES, type ThemeId } from './types'

const KEY = 'lunchloop.theme'
export const DEFAULT_THEME: ThemeId = 'americas'

function read(): ThemeId {
  const saved = storeGet(KEY)
  return (THEMES as readonly string[]).includes(saved ?? '') ? (saved as ThemeId) : DEFAULT_THEME
}

let current: ThemeId = read()
/** True once the student has picked a world themselves (not just the default). */
let chosen = storeGet(KEY) !== null
const listeners = new Set<() => void>()

function apply(id: ThemeId) {
  if (typeof document !== 'undefined') document.documentElement.dataset.theme = id
}
apply(current)

export const themeStore = {
  get: () => current,
  chosen: () => chosen,
  /** Switch worlds right away. For the animated switch, use switchTheme() from ./switch. */
  set(id: ThemeId) {
    chosen = true
    storeSet(KEY, id)
    if (id === current) return
    current = id
    apply(id)
    listeners.forEach((l) => l())
  },
  subscribe(l: () => void) {
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  },
}

export function useThemeId(): ThemeId {
  return useSyncExternalStore(themeStore.subscribe, themeStore.get, () => DEFAULT_THEME)
}
