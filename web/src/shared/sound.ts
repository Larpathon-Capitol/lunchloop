// Short UI sounds made with Web Audio, so there are no files to load.
// Sound is always on: the header mute button is gone, and an old saved "muted" choice is ignored
// so nobody is left silent with no way back. Every voice stays quiet (peaks at 0.08 or less).
// The pluck scale, the pluck timbre, the seal and the vote reveal follow the active world.
import { themeStore } from '../theme/store'
import type { ThemeId } from '../theme/types'

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

/** Kept so older callers compile. Sound can no longer be muted, so this does nothing. */
export function setMuted(value: boolean) {
  void value
}

/** Kept so older callers compile. Always false: sound is always on. */
export function useMuted(): boolean {
  return false
}

function tone(freq: number, ms: number, { type = 'sine', gain = 0.08, delay = 0, slideTo }: {
  type?: OscillatorType
  gain?: number
  delay?: number
  slideTo?: number
} = {}) {
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

// Longer voices for the reward kit. Every voice peaks at 0.08 or less.
let noiseBuf: AudioBuffer | null = null
let noiseCtx: AudioContext | null = null

function live(): AudioContext | null {
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
function string(freq: number, { gain = 0.06, decay = 0.7, delay = 0, bend = 1.012, type = 'triangle', bright = 9 }: {
  gain?: number
  decay?: number
  delay?: number
  /** Starting pitch as a ratio of the note, sliding to the note over 30ms. */
  bend?: number
  type?: OscillatorType
  /** Filter opening at the attack, as a multiple of the note. */
  bright?: number
} = {}) {
  const ac = live()
  if (!ac) return
  const t0 = ac.currentTime + delay / 1000
  const body = ac.createOscillator()
  const over = ac.createOscillator()
  const overAmp = ac.createGain()
  const filter = ac.createBiquadFilter()
  const amp = ac.createGain()
  body.type = type
  over.type = 'sine'
  body.frequency.setValueAtTime(freq * bend, t0)
  body.frequency.exponentialRampToValueAtTime(freq, t0 + 0.03)
  over.frequency.setValueAtTime(freq * 2 * bend, t0)
  over.frequency.exponentialRampToValueAtTime(freq * 2, t0 + 0.03)
  overAmp.gain.value = 0.28
  filter.type = 'lowpass'
  filter.Q.value = 0.7
  filter.frequency.setValueAtTime(Math.min(freq * bright, 7000), t0)
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

/** Marimba bar: a round sine with a quiet fourth partial and a soft mallet knock. */
function marimba(freq: number, { gain = 0.07, decay = 0.42, delay = 0 }: { gain?: number; decay?: number; delay?: number } = {}) {
  const ac = live()
  if (!ac) return
  const t0 = ac.currentTime + delay / 1000
  const partials: [number, number, number][] = [
    [1, 1, decay],
    [3.93, 0.16, decay * 0.3],
  ]
  for (const [ratio, level, d] of partials) {
    const osc = ac.createOscillator()
    const amp = ac.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq * ratio
    amp.gain.setValueAtTime(0.0001, t0)
    amp.gain.linearRampToValueAtTime(Math.min(gain, 0.08) * level, t0 + 0.003)
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + d)
    osc.connect(amp).connect(ac.destination)
    osc.start(t0)
    osc.stop(t0 + d + 0.02)
  }
  hiss(18, { freq: 1600, q: 2.5, gain: 0.03, delay })
}

/** Oud or qanun: a brighter string that rises into the note, struck twice quickly. */
function oud(freq: number, { gain = 0.06, delay = 0 }: { gain?: number; delay?: number } = {}) {
  string(freq, { gain, decay: 0.6, delay, bend: 0.982, type: 'sawtooth', bright: 7 })
  string(freq, { gain: gain * 0.55, decay: 0.45, delay: delay + 62, bend: 0.99, type: 'sawtooth', bright: 5 })
}

/** A filtered-noise sweep: air moving past, rising then settling. */
function sweep(ms: number, { from, to, gain = 0.05, q = 1.4 }: { from: number; to: number; gain?: number; q?: number }) {
  const ac = live()
  if (!ac) return
  const t0 = ac.currentTime
  const dur = ms / 1000
  const src = ac.createBufferSource()
  const filter = ac.createBiquadFilter()
  const amp = ac.createGain()
  src.buffer = noise(ac)
  src.loop = true
  filter.type = 'bandpass'
  filter.Q.value = q
  filter.frequency.setValueAtTime(from, t0)
  filter.frequency.exponentialRampToValueAtTime(to, t0 + dur * 0.7)
  amp.gain.setValueAtTime(0.0001, t0)
  amp.gain.linearRampToValueAtTime(Math.min(gain, 0.08), t0 + dur * 0.4)
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  src.connect(filter).connect(amp).connect(ac.destination)
  src.start(t0)
  src.stop(t0 + dur + 0.02)
}

// Each world's pluck scale, as semitones above its root within one octave. Each step up
// the tray lands one note higher, then rolls into the next octave.
//   Americas: C major pentatonic (C D E G A), marimba
//   East Asia: D yo scale (D E G A B), koto
//   Mediterranean: D Hijaz (D Eb F# G A Bb C), oud
const WORLD_SCALES: Record<ThemeId, { root: number; steps: readonly number[] }> = {
  americas: { root: 261.63, steps: [0, 2, 4, 7, 9] },
  asia: { root: 293.66, steps: [0, 2, 5, 7, 9] },
  medi: { root: 293.66, steps: [0, 1, 4, 5, 7, 8, 10] },
}
export const PLUCK_STEPS = 12

/** The pluck note for a tray step in the active world (or the given one), in Hz. */
export function pluckFrequency(step: number, world: ThemeId = themeStore.get()) {
  const { root, steps } = WORLD_SCALES[world]
  const s = Math.max(0, Math.min(PLUCK_STEPS - 1, Math.round(step)))
  const semis = steps[s % steps.length] + 12 * Math.floor(s / steps.length)
  return root * Math.pow(2, semis / 12)
}

function worldPluck(step: number) {
  const world = themeStore.get()
  const freq = pluckFrequency(step, world)
  if (world === 'americas') marimba(freq)
  else if (world === 'medi') oud(freq)
  else string(freq)
}

function worldStamp() {
  const world = themeStore.get()
  if (world === 'americas') {
    // Sticker slap: a short low thump, then the snap of the backing paper.
    tone(160, 110, { type: 'sine', gain: 0.08, slideTo: 70 })
    hiss(40, { freq: 2600, q: 0.8, type: 'highpass', gain: 0.06 })
    hiss(22, { freq: 4200, q: 1.5, gain: 0.035, delay: 55 })
  } else if (world === 'medi') {
    // Ceramic tile clink: two bright partials that die fast, and a tiny tick.
    bell(2093, { gain: 0.05, decay: 0.32 })
    bell(3171, { gain: 0.03, decay: 0.22, delay: 6 })
    bell(2349, { gain: 0.025, decay: 0.26, delay: 90 })
    hiss(12, { freq: 5200, q: 2, gain: 0.03 })
  } else {
    // Hanko on paper: a low thump and the slap of the paper.
    tone(135, 170, { type: 'sine', gain: 0.08, slideTo: 48 })
    hiss(70, { freq: 1800, q: 0.9, gain: 0.06 })
    hiss(30, { freq: 380, q: 1.2, type: 'lowpass', gain: 0.07 })
  }
}

/**
 * One vote option landing on the ballot, by world. `index` is the row (0 to 3): each one lands a
 * note higher so the four read as a little phrase, and the last one gets an extra flourish.
 *   Americas: a loteria card slapped on the table, with a marimba note on top.
 *   East Asia: hyoshigi wood blocks clacking (twice on the last one).
 *   Mediterranean: a glazed tile set down with a clink.
 */
function worldReveal(index: number, last: boolean) {
  const world = themeStore.get()
  const i = Math.max(0, Math.min(5, index))
  if (world === 'americas') {
    tone(150, 90, { type: 'sine', gain: 0.07, slideTo: 62 })
    hiss(34, { freq: 2400, q: 0.8, type: 'highpass', gain: 0.055 })
    marimba(pluckFrequency(5 + i, world), { gain: 0.045, decay: 0.34, delay: 12 })
    if (last) marimba(pluckFrequency(8 + i, world), { gain: 0.04, decay: 0.5, delay: 110 })
  } else if (world === 'medi') {
    const f = pluckFrequency(7 + i, world) * 2
    tone(210, 70, { type: 'sine', gain: 0.045, slideTo: 120 })
    bell(f, { gain: 0.04, decay: 0.28 })
    bell(f * 2.76, { gain: 0.016, decay: 0.16, delay: 4 })
    hiss(10, { freq: 5200, q: 2, gain: 0.028 })
    if (last) {
      bell(f * 1.5, { gain: 0.03, decay: 0.42, delay: 120 })
      bell(f * 3, { gain: 0.012, decay: 0.3, delay: 135 })
    }
  } else {
    const clack = (delay: number, gain: number) => {
      const f = pluckFrequency(5 + i, world) * 2
      tone(f, 55, { type: 'sine', gain, delay })
      tone(f * 2.4, 30, { type: 'sine', gain: gain * 0.35, delay })
      hiss(26, { freq: 1900, q: 5, gain: gain * 0.8, delay })
      tone(240, 50, { type: 'sine', gain: gain * 0.6, slideTo: 150, delay })
    }
    clack(0, 0.06)
    if (last) clack(95, 0.045)
  }
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
  /**
   * One note in the world's voice (marimba, koto or oud). Step 0 is the first food group
   * on the tray, each step is one note up the world's scale.
   */
  pluck: (step = 0) => worldPluck(step),
  /** The seal landing: sticker slap, hanko thud or tile clink, by world. */
  stamp: () => worldStamp(),
  /** Milestone: three soft bell partials, a bit apart so it shimmers. */
  chime: () => {
    bell(784, { gain: 0.035, decay: 1.5 })
    bell(784 * 2.01, { gain: 0.022, decay: 1.2, delay: 20 })
    bell(784 * 3.02, { gain: 0.012, decay: 0.9, delay: 40 })
  },
  /** The vote reel starting: a quick rising whirr under the first ticks. */
  spinUp: () => sweep(420, { from: 500, to: 2200, gain: 0.03, q: 1.1 }),
  /** One vote option landing on the ballot, in the world's voice. See worldReveal. */
  reveal: (index = 0, last = false) => worldReveal(index, last),
  /** Skip: soft and falling, never a buzz. */
  skip: () => tone(520, 130, { type: 'sine', gain: 0.045, slideTo: 330 }),
  /** Petting the mascot: a tiny happy chirp. */
  pet: () => {
    tone(880, 60, { type: 'sine', gain: 0.05, slideTo: 1180 })
    tone(1320, 80, { type: 'sine', gain: 0.045, delay: 60, slideTo: 1560 })
  },
  /** The world switch: a soft rush of air under the wipe. */
  whoosh: () => {
    sweep(520, { from: 380, to: 2400, gain: 0.05 })
    tone(330, 260, { type: 'sine', gain: 0.025, slideTo: 660, delay: 120 })
  },
}
