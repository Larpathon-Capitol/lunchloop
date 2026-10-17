// A tiny event bus for the docked Ume. Any screen can call ume.hop(), ume.react()
// or ume.moveTo() without prop drilling; <UmeDock /> listens with useSyncExternalStore.
import { useSyncExternalStore } from 'react'
import { storeGet, storeSet } from '../shared/device'
import type { RectLike, UmeMood } from './types'

export type UmeMove = { rect: RectLike; id: number; holdMs: number }

export type UmeState = {
  mood: UmeMood
  line: string | null
  lineId: number
  hopId: number
  move: UmeMove | null
}

let state: UmeState = { mood: 'idle', line: null, lineId: 0, hopId: 0, move: null }
const listeners = new Set<() => void>()
let moodTimer: ReturnType<typeof setTimeout> | undefined

function set(patch: Partial<UmeState>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

export function useUmeState(): UmeState {
  return useSyncExternalStore(subscribe, () => state, () => state)
}

function toRect(target: Element | RectLike): RectLike {
  if (target instanceof Element) {
    const r = target.getBoundingClientRect()
    return { left: r.left, top: r.top, width: r.width, height: r.height }
  }
  return target
}

/** Moods that are moments, not states. They fall back to idle on their own. */
const MOMENT_MS: Partial<Record<UmeMood, number>> = {
  happy: 2600,
  excited: 3200,
  surprised: 1800,
  proud: 3200,
  petted: 2400,
}

export const ume = {
  /** A small hop in place. */
  hop() {
    set({ hopId: state.hopId + 1 })
  },
  /** Switch mood, optionally say a line. Moment moods return to idle by themselves. */
  react(mood: UmeMood, line?: string, holdMs?: number) {
    clearTimeout(moodTimer)
    const patch: Partial<UmeState> = { mood }
    if (line) Object.assign(patch, { line, lineId: state.lineId + 1 })
    set(patch)
    const ms = holdMs ?? MOMENT_MS[mood]
    if (ms) moodTimer = setTimeout(() => set({ mood: 'idle' }), ms)
  },
  /** Show a speech bubble without changing mood. */
  say(line: string) {
    set({ line, lineId: state.lineId + 1 })
  },
  /** Spring Ume onto the top edge of an element (say, the tray rim), then back to the dock. */
  moveTo(target: Element | RectLike, holdMs = 2600) {
    set({ move: { rect: toRect(target), id: (state.move?.id ?? 0) + 1, holdMs } })
  },
  /** Send Ume home right away. */
  back() {
    set({ move: null })
  },
}

// Pets, counted per browser. Two milestones get a one-time spin.
const PETS_KEY = 'lunchloop.ume.pets'
const SPUN_KEY = 'lunchloop.ume.spun'
export const PET_MILESTONES = [10, 50] as const

const petListeners = new Set<() => void>()

export function getPetCount(): number {
  const n = Number.parseInt(storeGet(PETS_KEY) ?? '0', 10)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/** Count one pet. Returns the new total and the milestone it just reached, if any (once ever). */
export function registerPet(): { count: number; milestone: number | null } {
  const count = getPetCount() + 1
  storeSet(PETS_KEY, String(count))
  let milestone: number | null = null
  const spun = (storeGet(SPUN_KEY) ?? '').split(',').filter(Boolean)
  for (const m of PET_MILESTONES) {
    if (count >= m && !spun.includes(String(m))) {
      milestone = m
      spun.push(String(m))
      storeSet(SPUN_KEY, spun.join(','))
      break
    }
  }
  petListeners.forEach((l) => l())
  return { count, milestone }
}

export function usePetCount(): number {
  return useSyncExternalStore(
    (l) => {
      petListeners.add(l)
      return () => {
        petListeners.delete(l)
      }
    },
    getPetCount,
    () => 0,
  )
}

// One shared polite live region, so speech reaches screen readers once, not per instance.
let region: HTMLElement | null = null

export function announce(text: string) {
  if (typeof document === 'undefined') return
  if (!region) {
    region = document.createElement('div')
    region.setAttribute('role', 'status')
    region.setAttribute('aria-live', 'polite')
    Object.assign(region.style, {
      position: 'absolute',
      width: '1px',
      height: '1px',
      margin: '-1px',
      overflow: 'hidden',
      clip: 'rect(0 0 0 0)',
      whiteSpace: 'nowrap',
      border: '0',
      padding: '0',
    })
    document.body.appendChild(region)
  }
  const el = region
  el.textContent = ''
  // A short gap lets screen readers announce the same line twice in a row.
  window.setTimeout(() => {
    el.textContent = `Ume says: ${text}`
  }, 60)
}
