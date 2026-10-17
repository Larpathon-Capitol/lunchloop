// Small extras the stage shares with the screens around it, kept out of store.ts so the
// contract with the game screens stays exactly as agreed. No three.js here either.
import { useSyncExternalStore } from 'react'

type Point = { x: number; y: number }

let hovered = false
const listeners = new Set<() => void>()
let rim: ((u: number, v: number) => Point | null) | null = null

export const stageBus = {
  /** The stage calls this when the pointer (or keyboard focus) is on the tray in the hero. */
  setHovered(next: boolean) {
    if (next === hovered) return
    hovered = next
    listeners.forEach((l) => l())
  },
  isHovered: () => hovered,
  subscribe(l: () => void) {
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  },
  /** The stage registers how to find a spot on the tray's top rim on screen. */
  registerRim(fn: ((u: number, v: number) => Point | null) | null) {
    rim = fn
  },
  /**
   * Viewport point on the top of the tray rim. u runs left to right (-1 to 1), v runs front to
   * back (-1 is the edge nearest the viewer). Null while the tray is hidden.
   */
  rimPoint: (u: number, v: number) => rim?.(u, v) ?? null,
}

export function useTrayHovered() {
  return useSyncExternalStore(stageBus.subscribe, () => hovered, () => false)
}
