// Short UI sounds made with Web Audio, so there are no files to load.
// Everything respects the mute toggle, which is saved per browser.
import { useSyncExternalStore } from 'react'
import { storeGet, storeSet } from './device'

const KEY = 'lunchloop.muted'
let muted = storeGet(KEY) === '1'
const listeners = new Set<() => void>()
let ctx: AudioContext | null = null

function audio(): AudioContext | null {
  if (ctx) return ctx
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (Ctor) ctx = new Ctor()
  } catch {
    // no Web Audio here: the app stays silent
  }
  return ctx
}

// Build the audio context while the page is idle. Making it inside the first tap
// freezes the first Spin for a few hundred milliseconds. It starts suspended, and
// tone() resumes it on the first gesture.
if (typeof window !== 'undefined') {
  const idle = window.requestIdleCallback
    ? (fn: () => void) => window.requestIdleCallback(fn)
    : (fn: () => void) => window.setTimeout(fn, 200)
  idle(() => void audio())
}

export function setMuted(value: boolean) {
  muted = value
  storeSet(KEY, value ? '1' : '0')
  listeners.forEach((l) => l())
}

export function useMuted() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => muted,
  )
}

function tone(freq: number, ms: number, { type = 'sine', gain = 0.08, delay = 0, slideTo }: {
  type?: OscillatorType
  gain?: number
  delay?: number
  slideTo?: number
} = {}) {
  if (muted) return
  const ac = audio()
  if (!ac) return
  if (ac.state === 'suspended') void ac.resume().catch(() => {})
  const t0 = ac.currentTime + delay / 1000
  const osc = ac.createOscillator()
  const amp = ac.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + ms / 1000)
  amp.gain.setValueAtTime(gain, t0)
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + ms / 1000)
  osc.connect(amp).connect(ac.destination)
  osc.start(t0)
  osc.stop(t0 + ms / 1000 + 0.02)
}

export const sound = {
  tap: () => tone(660, 50, { type: 'triangle', gain: 0.05 }),
  tick: () => tone(1200, 25, { type: 'square', gain: 0.025 }),
  land: () => {
    tone(523, 120, { type: 'triangle' })
    tone(784, 180, { type: 'triangle', delay: 70 })
  },
  vote: () => {
    tone(523, 90, { type: 'triangle' })
    tone(659, 90, { type: 'triangle', delay: 80 })
    tone(784, 220, { type: 'triangle', delay: 160 })
  },
  correct: () => {
    tone(659, 100, { type: 'triangle' })
    tone(988, 260, { type: 'triangle', delay: 90 })
  },
  streak: () => tone(440, 240, { type: 'sine', slideTo: 880 }),
}
