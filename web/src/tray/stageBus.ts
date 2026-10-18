// Small extras the stage shares with the screens around it, kept out of store.ts so the
// contract with the game screens stays exactly as agreed. No three.js here either.
import { useSyncExternalStore } from 'react'

type Point = { x: number; y: number }

let hovered = false
const listeners = new Set<() => void>()
let rim: ((u: number, v: number) => Point | null) | null = null
let presence: (() => number) | null = null
let idleTimer = 0
let idleWake: (() => void) | null = null
const frameListeners = new Set<() => void>()

/**
 * Frame interval for slow idle motion on the stage (the hero tray's drift, breathing foods).
 * Moves that slow shift a fraction of a pixel per frame, so 30 fps looks the same as 60 and
 * costs the GPU half as much. Slightly under 1/30 s so the timer lands on every second vsync.
 */
const IDLE_FRAME_MS = 1000 / 30 - 5
/**
 * Phones and tablets: 20 fps. The hero drift there peaks near 12 px a second, so a frame still
 * moves it well under a pixel, and a phone's GPU and battery get a third of the work back.
 */
const IDLE_FRAME_MS_TOUCH = 1000 / 20 - 5
const coarse = typeof window !== 'undefined' ? window.matchMedia('(pointer: coarse)') : null
const idleFrameMs = () => (coarse?.matches ? IDLE_FRAME_MS_TOUCH : IDLE_FRAME_MS)

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
  /** The stage registers how visible the tray is right now (0 hidden to 1 shown). */
  registerPresence(fn: (() => number) | null) {
    presence = fn
  },
  /** How visible the tray is this frame, 0 to 1, so things riding on it can fade with it. */
  presence: () => presence?.() ?? 0,
  /**
   * Things riding on the tray (the hero mascot) follow it here instead of running their own
   * animation loop: the stage calls frame() once per drawn frame, after the pose and camera are
   * set, so the rim point read inside a listener matches the picture about to be drawn.
   */
  onFrame(l: () => void) {
    frameListeners.add(l)
    return () => {
      frameListeners.delete(l)
    }
  },
  frame() {
    frameListeners.forEach((l) => l())
  },
  /**
   * Book the next frame for idle-only motion at about 30 fps. Call it from useFrame instead of
   * state.invalidate() when nothing but a slow drift is moving; anything quicker should keep
   * calling state.invalidate() for full rate. Everyone on the stage shares one timer.
   */
  idleFrame(invalidate: () => void) {
    idleWake = invalidate
    if (idleTimer) return
    idleTimer = window.setTimeout(() => {
      idleTimer = 0
      idleWake?.()
    }, idleFrameMs())
  },
}

export function useTrayHovered() {
  return useSyncExternalStore(stageBus.subscribe, () => hovered, () => false)
}
