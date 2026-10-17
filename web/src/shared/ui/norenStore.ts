// The noren curtain between the home hero and the game. Home starts it; the shell draws it;
// the tray stage lifts itself above it while it parts so the tray stays in view the whole way.
import { useSyncExternalStore } from 'react'

let parting = 0 // 0 = no curtain, otherwise an id that changes per run
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export const noren = {
  /** Show the closed curtain over everything but the tray, then part it. */
  part() {
    parting += 1
    emit()
  },
  /** Called by the curtain when it has slid off screen. */
  done() {
    parting = 0
    emit()
  },
  subscribe(l: () => void) {
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  },
  get: () => parting,
}

export function useNoren() {
  return useSyncExternalStore(noren.subscribe, noren.get, () => 0)
}
