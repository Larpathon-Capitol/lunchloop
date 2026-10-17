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

// Longer voices for the reward kit. Every voice peaks at 0.08 or less and goes through
// the same mute switch as tone().
let noiseBuf: AudioBuffer | null = null
let noiseCtx: AudioContext | null = null

function live(): AudioContext | null {
  if (muted) return null
  const ac = audio()
  if (!ac) return null
  if (ac.state === 'suspended') void ac.resume().catch(() => {})
  return ac
}

function noise(ac: AudioContext) {
  if (noiseBuf && noiseCtx === ac) return noiseBuf
  const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.5), ac.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  noiseBuf = buf
  noiseCtx = ac
  return buf
}

/** A short burst of filtered noise: the paper and wood part of a sound. */
function hiss(ms: number, { freq, q = 1, type = 'bandpass', gain = 0.05, delay = 0 }: {
  freq: number
  q?: number
  type?: BiquadFilterType
  gain?: number
  delay?: number
}) {
  const ac = live()
  if (!ac) return
  const t0 = ac.currentTime + delay / 1000
  const src = ac.createBufferSource()
  const filter = ac.createBiquadFilter()
  const amp = ac.createGain()
  src.buffer = noise(ac)
  filter.type = type
  filter.frequency.value = freq
  filter.Q.value = q
  amp.gain.setValueAtTime(Math.min(gain, 0.08), t0)
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + ms / 1000)
  src.connect(filter).connect(amp).connect(ac.destination)
  src.start(t0, Math.random() * 0.2)
  src.stop(t0 + ms / 1000 + 0.02)
}

/** One plucked string: bright attack that closes down, like a koto. */
function string(freq: number, { gain = 0.06, decay = 0.7, delay = 0, bend = 1.012 }: {
  gain?: number
  decay?: number
  delay?: number
  bend?: number
} = {}) {
  const ac = live()
  if (!ac) return
  const t0 = ac.currentTime + delay / 1000
  const body = ac.createOscillator()
  const over = ac.createOscillator()
  const overAmp = ac.createGain()
  const filter = ac.createBiquadFilter()
  const amp = ac.createGain()
  body.type = 'triangle'
  over.type = 'sine'
  body.frequency.setValueAtTime(freq * bend, t0)
  body.frequency.exponentialRampToValueAtTime(freq, t0 + 0.03)
  over.frequency.setValueAtTime(freq * 2 * bend, t0)
  over.frequency.exponentialRampToValueAtTime(freq * 2, t0 + 0.03)
  overAmp.gain.value = 0.28
  filter.type = 'lowpass'
  filter.Q.value = 0.7
  filter.frequency.setValueAtTime(Math.min(freq * 9, 7000), t0)
  filter.frequency.exponentialRampToValueAtTime(Math.max(freq * 1.6, 500), t0 + decay * 0.6)
  amp.gain.setValueAtTime(0.0001, t0)
  amp.gain.linearRampToValueAtTime(Math.min(gain, 0.08) * 0.8, t0 + 0.004)
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + decay)
  body.connect(filter)
  over.connect(overAmp).connect(filter)
  filter.connect(amp).connect(ac.destination)
  body.start(t0)
  over.start(t0)
  body.stop(t0 + decay + 0.02)
  over.stop(t0 + decay + 0.02)
  hiss(14, { freq: 3200, q: 1.2, gain: 0.018, delay })
}

/** One bell partial: a sine with a soft attack and a long tail. */
function bell(freq: number, { gain = 0.03, decay = 1.1, delay = 0 }: { gain?: number; decay?: number; delay?: number } = {}) {
  const ac = live()
  if (!ac) return
  const t0 = ac.currentTime + delay / 1000
  const osc = ac.createOscillator()
  const amp = ac.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  amp.gain.setValueAtTime(0.0001, t0)
  amp.gain.linearRampToValueAtTime(Math.min(gain, 0.08), t0 + 0.012)
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + decay)
  osc.connect(amp).connect(ac.destination)
  osc.start(t0)
  osc.stop(t0 + decay + 0.02)
}

// The pluck scale: D yo scale (D E G A B), bright and open, with no half steps to sound
// tense. Each step up the tray lands one note higher, then rolls into the next octave.
const SCALE = [0, 2, 5, 7, 9]
const D4 = 293.66
export const PLUCK_STEPS = 12

export function pluckFrequency(step: number) {
  const s = Math.max(0, Math.min(PLUCK_STEPS - 1, Math.round(step)))
  const semis = SCALE[s % SCALE.length] + 12 * Math.floor(s / SCALE.length)
  return D4 * Math.pow(2, semis / 12)
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

  /** Wooden tap: a short knock of filtered noise over a low sine. */
  tok: () => {
    tone(190, 80, { type: 'sine', gain: 0.07, slideTo: 105 })
    hiss(45, { freq: 1100, q: 3.5, gain: 0.06 })
  },
  /** Koto pluck. Step 0 is the first food group on the tray, each step is one note up. */
  pluck: (step = 0) => string(pluckFrequency(step)),
  /** Seal on paper: a low thump and the slap of the paper. */
  stamp: () => {
    tone(135, 170, { type: 'sine', gain: 0.08, slideTo: 48 })
    hiss(70, { freq: 1800, q: 0.9, gain: 0.06 })
    hiss(30, { freq: 380, q: 1.2, type: 'lowpass', gain: 0.07 })
  },
  /** Milestone: three soft bell partials, a bit apart so it shimmers. */
  chime: () => {
    bell(784, { gain: 0.035, decay: 1.5 })
    bell(784 * 2.01, { gain: 0.022, decay: 1.2, delay: 20 })
    bell(784 * 3.02, { gain: 0.012, decay: 0.9, delay: 40 })
  },
  /** Skip: soft and falling, never a buzz. */
  skip: () => tone(520, 130, { type: 'sine', gain: 0.045, slideTo: 330 }),
  /** Petting the mascot: a tiny happy chirp. */
  pet: () => {
    tone(880, 60, { type: 'sine', gain: 0.05, slideTo: 1180 })
    tone(1320, 80, { type: 'sine', gain: 0.045, delay: 60, slideTo: 1560 })
  },
}
