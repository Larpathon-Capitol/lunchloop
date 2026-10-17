// The one place the 3D tray and the screens around it agree on state.
// Screens write what the student has picked and where the tray should sit; the stage
// (the persistent canvas in the app shell) reads it and draws. Taps on the tray come back
// as events. Nothing here imports three.js, so screens can use it without the 3D bundle.
import { createElement, useEffect, useRef, useSyncExternalStore, type CSSProperties } from 'react'

/** The five school lunch components, in tray order. Same ids as the API. */
export const COMPONENTS = ['meat_alternate', 'grain', 'vegetable', 'fruit', 'milk'] as const
export type Component = (typeof COMPONENTS)[number]

/**
 * hero: floating on the home page, follows the pointer, tap to enter.
 * entering: flying from the hero to the game (set by the home page on tap).
 * pick: in the game, compartments are tappable.
 * packed: tray is packed and stamped; compartments show the picks but don't open.
 * away: on a screen that doesn't show the tray (vote, call it, stamps); the stage tucks it away.
 */
export type TrayPhase = 'hero' | 'entering' | 'pick' | 'packed' | 'away'

/** item_id = picked, null = skipped on purpose, missing = not decided yet. */
export type Picks = Partial<Record<Component, string | null>>

export interface TrayState {
  phase: TrayPhase
  /** Components on the next school day's menu. Compartments not listed show empty and don't open. */
  available: readonly Component[]
  picks: Picks
  /** Compartment highlighted because its picker sheet is open. */
  focus: Component | null
  /** Where on screen the tray should be framed, in viewport pixels. Set by <TraySlot>. */
  slot: { x: number; y: number; width: number; height: number } | null
  /**
   * True while the tray sits still and visible in the current slot. Goes false the moment it
   * starts flying to a new slot (the hero to game glide) and true again once it has landed.
   * Written by the stage only. Screens read it with useTrayLanded() to hold their UI back
   * until the tray is in place.
   */
  landed: boolean
}

let state: TrayState = {
  phase: 'hero',
  available: COMPONENTS,
  picks: {},
  focus: null,
  slot: null,
  landed: false,
}
const listeners = new Set<() => void>()

export const trayStore = {
  get: () => state,
  set(patch: Partial<TrayState>) {
    state = { ...state, ...patch }
    listeners.forEach((l) => l())
  },
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
}

export function useTray<T>(select: (s: TrayState) => T): T {
  return useSyncExternalStore(trayStore.subscribe, () => select(state))
}

/** True once the tray has come to rest in the current screen's slot. See TrayState.landed. */
export function useTrayLanded(): boolean {
  return useSyncExternalStore(trayStore.subscribe, () => state.landed, () => false)
}

// Events from the stage back to the screens.
type TrayEvent = { type: 'enter' } | { type: 'compartment'; component: Component }
const eventListeners = new Set<(e: TrayEvent) => void>()

export const trayEvents = {
  /** The stage calls this when the student taps the tray or a compartment. */
  emit(e: TrayEvent) {
    eventListeners.forEach((l) => l(e))
  },
  on(listener: (e: TrayEvent) => void) {
    eventListeners.add(listener)
    return () => {
      eventListeners.delete(listener)
    }
  },
}

// Screen positions, so DOM things (Ume, the stamp, labels) can line up with the 3D tray.
type Projector = {
  tray: () => DOMRect | null
  compartment: (c: Component) => DOMRect | null
}
let projector: Projector | null = null

export const trayProjector = {
  /** The stage registers how to turn 3D positions into viewport rects. */
  register(p: Projector | null) {
    projector = p
  },
  tray: () => projector?.tray() ?? null,
  compartment: (c: Component) => projector?.compartment(c) ?? null,
}

/**
 * Put this where the tray should appear on a screen. It measures itself and tells the stage,
 * which frames the 3D tray inside it. Keep one mounted per screen.
 */
export function TraySlot({ className, style }: { className?: string; style?: CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const r = el.getBoundingClientRect()
      trayStore.set({ slot: { x: r.left, y: r.top, width: r.width, height: r.height } })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    window.addEventListener('scroll', measure, { passive: true })
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('scroll', measure)
      window.removeEventListener('resize', measure)
      trayStore.set({ slot: null })
    }
  }, [])
  return createElement('div', { ref, className, style, 'aria-hidden': true })
}
