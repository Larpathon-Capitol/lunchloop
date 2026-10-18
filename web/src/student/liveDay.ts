// The live game's lunch day, as the watcher sees it. Staff can move the live school's day at any
// time; the game never reloads on its own. It either asks the student to refresh (when they have
// picks in progress) or, when nothing would be lost, starts the game fresh on the new day.
import { useSyncExternalStore } from 'react'
import { api } from '../shared/api'

export interface LiveDayState {
  /** The server moved on from the day this game loaded with. */
  stale: boolean
  /** The new day (YYYY-MM-DD) when known. */
  newDay: string | null
  /** Set after the game restarted itself on this day, for a short "new day" note. */
  flipped: string | null
  /** Bumped to start the game fresh (the provider is keyed on it). */
  epoch: number
  /** Bumped when a pack bounced off the new day, so a hidden note shows again. */
  nudge: number
  /** The note the student hid (see staleKey); a small pill stands in for it. */
  hidden: string | null
}

let state: LiveDayState = { stale: false, newDay: null, flipped: null, epoch: 0, nudge: 0, hidden: null }
const listeners = new Set<() => void>()

function set(patch: Partial<LiveDayState>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

/** The day moved, but the student has work in progress: ask them to refresh. */
export function markStale(newDay: string | null) {
  if (state.stale && (newDay === null || newDay === state.newDay)) return
  set({ stale: true, newDay: newDay ?? state.newDay })
}

/** A tray was packed for the old day and the server said no: show the note again, even if hidden. */
export function nudgeStale() {
  set({ stale: true, nudge: state.nudge + 1 })
}

/** The server refused a tray, vote or guess for the old day: show the note with the new day. */
export function staleFromServer() {
  nudgeStale()
  api
    .health()
    .then((h) => markStale(h.today))
    .catch(() => {})
}

/** The day moved back to the one this game loaded with. */
export function clearStale() {
  if (state.stale) set({ stale: false, newDay: null })
}

/** Nothing would be lost: start the game fresh on the new day. */
export function restartOn(day: string) {
  set({ stale: false, newDay: null, flipped: day, epoch: state.epoch + 1 })
}

/** Which note is showing: it changes when the day moves again or a pack bounces, so hiding lasts until then. */
export function staleKey(s: LiveDayState): string | null {
  return s.stale ? `${s.newDay ?? 'unknown'}:${s.nudge}` : null
}

/** Hide the current note, leaving the small refresh pill. */
export function hideNotice() {
  set({ hidden: staleKey(state) })
}

export function clearFlipped() {
  if (state.flipped) set({ flipped: null })
}

export function useLiveDay(): LiveDayState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => {
        listeners.delete(l)
      }
    },
    () => state,
    () => state,
  )
}
