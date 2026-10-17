// Ume, the onigiri buddy. Inline SVG drawing (UmeArt) wrapped in three transform
// layers: hop (y + puff), squash (scale + tilt, pinned at the feet) and breathe.
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useSpring } from 'framer-motion'
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { sound } from '../shared/sound'
import { lines, pickLine } from './lines'
import { announce, registerPet } from './store'
import { UmeArt, type Face, type Heart } from './UmeArt'
import type { Point, UmeMood } from './types'
import './ume.css'

export type UmeProps = {
  mood?: UmeMood
  /** Rendered width in CSS pixels. The drawing is square. */
  size?: number
  /** Called after each pet with the new lifetime pet count. */
  onPet?: (count: number) => void
  /** A short line for the speech bubble. Change it (or sayKey) to show it again. */
  say?: string | null
  sayKey?: number
  /** Viewport point to look at when curious. Defaults to the pointer. */
  lookAt?: Point | null
  /** Bump to make Ume hop once. */
  hopKey?: number
  /** Where the bubble sits over Ume. */
  bubbleAlign?: 'center' | 'start' | 'end'
  /** Set false for purely decorative copies (no button, no petting). */
  interactive?: boolean
  /** Say a petted line when petted. On by default. */
  talkWhenPetted?: boolean
  className?: string
}

const FACES: Record<UmeMood, Face> = {
  idle: { eyes: 'open', mouth: 'smile', blush: 0.15 },
  happy: { eyes: 'happy', mouth: 'open', blush: 0.45 },
  excited: { eyes: 'wide', mouth: 'open', blush: 0.55 },
  curious: { eyes: 'open', mouth: 'small', blush: 0.15 },
  thinking: { eyes: 'open', mouth: 'hmm', blush: 0.1 },
  sleepy: { eyes: 'sleepy', mouth: 'small', blush: 0.2 },
  proud: { eyes: 'bliss', mouth: 'smug', blush: 0.35 },
  petted: { eyes: 'squeeze', mouth: 'open', blush: 1 },
  surprised: { eyes: 'wide', mouth: 'o', blush: 0.2 },
}

const BUBBLE_MS = 3500
const spring = { type: 'spring', stiffness: 520, damping: 16 } as const
const soft = { type: 'spring', stiffness: 220, damping: 18 } as const

const rand = (a: number, b: number) => a + Math.random() * (b - a)

function playPet() {
  const s = sound as typeof sound & { pet?: () => void }
  if (s.pet) s.pet()
  else s.tap()
}

export function Ume({
  mood = 'idle',
  size = 120,
  onPet,
  say,
  sayKey,
  lookAt,
  hopKey,
  bubbleAlign = 'center',
  interactive = true,
  talkWhenPetted = true,
  className,
}: UmeProps) {
  const reduced = !!useReducedMotion()
  const [override, setOverride] = useState<UmeMood | null>(null)
  const shown = override ?? mood
  const face = FACES[shown]

  // Transform layers
  const y = useMotionValue(0)
  const puff = useMotionValue(1)
  const sx = useMotionValue(1)
  const sy = useMotionValue(1)
  const rot = useMotionValue(0)
  const breathe = useMotionValue(1)
  const eyeXRaw = useMotionValue(0)
  const eyeYRaw = useMotionValue(0)
  const eyeX = useSpring(eyeXRaw, { stiffness: 300, damping: 26 })
  const eyeY = useSpring(eyeYRaw, { stiffness: 300, damping: 26 })

  const rootRef = useRef<HTMLDivElement>(null)
  const hopping = useRef(false)

  // ---- Hop: anticipate, stretch up, fall, squash, settle on a spring.
  const hop = useCallback(
    async (height = 12) => {
      if (reduced || hopping.current) return
      hopping.current = true
      const k = Math.min(1, height / 28)
      const lift = height * (size / 120)
      await Promise.all([
        animate(sy, 1 - 0.1 * (0.6 + k), { duration: 0.09, ease: 'easeOut' }),
        animate(sx, 1 + 0.08 * (0.6 + k), { duration: 0.09, ease: 'easeOut' }),
      ])
      animate(sy, 1 + 0.09 * (0.5 + k), spring)
      animate(sx, 1 - 0.07 * (0.5 + k), spring)
      await animate(y, -lift, { duration: 0.16 + 0.12 * k, ease: [0.15, 0.75, 0.35, 1] })
      animate(sy, 1, soft)
      animate(sx, 1, soft)
      await animate(y, 0, { duration: 0.14 + 0.1 * k, ease: [0.55, 0, 0.9, 0.45] })
      await Promise.all([
        animate(sy, 1 - 0.12 * (0.5 + k), { duration: 0.06 }),
        animate(sx, 1 + 0.1 * (0.5 + k), { duration: 0.06 }),
      ])
      animate(sy, 1, { type: 'spring', stiffness: 480, damping: 11 })
      await animate(sx, 1, { type: 'spring', stiffness: 480, damping: 11 })
      hopping.current = false
    },
    [reduced, size, sx, sy, y],
  )

  const spin = useCallback(async () => {
    if (reduced) return
    await hop(20)
    await animate(rot, 360, { type: 'spring', stiffness: 120, damping: 14 })
    rot.set(0)
  }, [hop, reduced, rot])

  // External hop requests
  const firstHop = useRef(hopKey)
  useEffect(() => {
    if (hopKey === undefined || hopKey === firstHop.current) return
    void hop(14)
  }, [hopKey, hop])

  // ---- Blink: random 2.5 to 6s. Kept in reduced motion (it is tiny).
  const [blink, setBlink] = useState(false)
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>
    const loop = () => {
      t = setTimeout(() => {
        setBlink(true)
        t = setTimeout(() => {
          setBlink(false)
          loop()
        }, 130)
      }, rand(2500, 6000))
    }
    loop()
    return () => clearTimeout(t)
  }, [])

  // ---- Breathing, per mood.
  useEffect(() => {
    if (reduced) {
      breathe.set(1)
      return
    }
    const amp = shown === 'sleepy' ? 0.035 : shown === 'idle' || shown === 'curious' || shown === 'thinking' ? 0.025 : 0.015
    const period = shown === 'sleepy' ? 2.4 : 1.6
    const c = animate(breathe, [1, 1 + amp, 1], { duration: period * 2, ease: 'easeInOut', repeat: Infinity })
    return () => c.stop()
  }, [breathe, reduced, shown])

  // ---- Mood choreography
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    const every = (fn: () => void, min: number, max: number) => {
      const tick = () => {
        timers.push(
          setTimeout(() => {
            fn()
            tick()
          }, rand(min, max)),
        )
      }
      tick()
    }
    const to = (mv: typeof rot, v: number, t: object = soft) => (reduced ? mv.set(v) : void animate(mv, v, t))

    to(puff, shown === 'proud' ? 1.06 : 1, { type: 'spring', stiffness: 260, damping: 12 })
    to(rot, shown === 'thinking' ? -5 : shown === 'sleepy' ? 4 : 0)
    if (shown !== 'curious') {
      eyeXRaw.set(shown === 'thinking' ? 2.2 : 0)
      eyeYRaw.set(shown === 'thinking' ? -2.6 : 0)
    }

    if (!reduced) {
      if (shown === 'idle') every(() => void hop(6), 7000, 13000)
      if (shown === 'happy') {
        void hop(10)
        every(() => void hop(10), 700, 900)
      }
      if (shown === 'excited') {
        void hop(30)
        every(() => void hop(30), 1300, 1500)
      }
      if (shown === 'surprised') {
        void animate(y, [0, -8 * (size / 120), 0], { duration: 0.32, ease: 'easeOut' })
        void animate(sy, [1, 1.12, 1], { duration: 0.5, ease: 'easeOut' })
        void animate(sx, [1, 0.9, 1], { duration: 0.5, ease: 'easeOut' })
      }
      if (shown === 'petted') {
        void animate(rot, [0, -7, 6, -5, 4, -2, 0], { duration: 0.9, ease: 'easeInOut' })
      }
    }
    return () => timers.forEach(clearTimeout)
  }, [shown, reduced, size, hop, puff, rot, sx, sy, y, eyeXRaw, eyeYRaw])

  // ---- Curious: tilt toward the target, eyes follow it (rAF, no re-renders).
  useEffect(() => {
    if (shown !== 'curious') return
    let target: Point | null = lookAt ?? null
    let raf = 0
    const onMove = (e: globalThis.PointerEvent) => {
      if (!lookAt) target = { x: e.clientX, y: e.clientY }
    }
    const frame = () => {
      const el = rootRef.current
      if (el && target) {
        const r = el.getBoundingClientRect()
        const cx = r.left + r.width / 2
        const cy = r.top + r.height * 0.55
        const dx = target.x - cx
        const dy = target.y - cy
        const d = Math.hypot(dx, dy) || 1
        const pull = Math.min(1, d / 160)
        eyeXRaw.set((dx / d) * 2.6 * pull)
        eyeYRaw.set((dy / d) * 2.2 * pull)
        if (!reduced) rot.set(rot.get() + ((Math.max(-12, Math.min(12, dx / 18)) - rot.get()) * 0.12))
      }
      raf = requestAnimationFrame(frame)
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    raf = requestAnimationFrame(frame)
    return () => {
      window.removeEventListener('pointermove', onMove)
      cancelAnimationFrame(raf)
      eyeXRaw.set(0)
      eyeYRaw.set(0)
    }
  }, [shown, lookAt, reduced, rot, eyeXRaw, eyeYRaw])

  // ---- Speech bubble
  const [bubble, setBubble] = useState<{ text: string; id: number } | null>(null)
  const bubbleId = useRef(0)
  const showLine = useCallback((text: string) => {
    bubbleId.current += 1
    setBubble({ text, id: bubbleId.current })
    announce(text)
  }, [])
  useEffect(() => {
    if (say) showLine(say)
  }, [say, sayKey, showLine])
  useEffect(() => {
    if (!bubble) return
    const t = setTimeout(() => setBubble(null), BUBBLE_MS)
    return () => clearTimeout(t)
  }, [bubble])

  // ---- Hearts (petted)
  const [hearts, setHearts] = useState<Heart[]>([])
  const heartId = useRef(0)
  const burst = useCallback(() => {
    const next: Heart[] = [-1, 1, -1].map((side, i) => ({
      id: ++heartId.current,
      dx: side * rand(30, 44),
      delay: i * 0.14,
    }))
    setHearts((h) => [...h.slice(-6), ...next])
  }, [])
  const heartDone = useCallback((id: number) => setHearts((h) => h.filter((x) => x.id !== id)), [])
  const prevShown = useRef(shown)
  useEffect(() => {
    if (shown === 'petted' && prevShown.current !== 'petted') burst()
    prevShown.current = shown
  }, [shown, burst])

  // ---- Petting
  const overrideTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const lastPet = useRef(0)
  const pet = useCallback(() => {
    const now = performance.now()
    if (now - lastPet.current < 600) return
    lastPet.current = now
    const { count, milestone } = registerPet()
    playPet()
    burst()
    if (!reduced) void animate(rot, [rot.get(), -7, 6, -4, 3, 0], { duration: 0.7, ease: 'easeInOut' })
    setOverride('petted')
    clearTimeout(overrideTimer.current)
    overrideTimer.current = setTimeout(() => setOverride(null), 2200)
    if (milestone) {
      setOverride('happy')
      void spin()
      showLine(lines.petMilestone[milestone] ?? pickLine(lines.milestone))
    } else if (talkWhenPetted && (count === 1 || Math.random() < 0.35)) {
      showLine(pickLine(lines.petted))
    }
    onPet?.(count)
  }, [burst, onPet, reduced, rot, showLine, spin, talkWhenPetted])

  useEffect(() => () => clearTimeout(overrideTimer.current), [])

  const drag = useRef<{ down: boolean; travel: number; last: Point; total: number }>({ down: false, travel: 0, last: { x: 0, y: 0 }, total: 0 })
  const taps = useRef<number[]>([])

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    drag.current = { down: true, travel: 0, total: 0, last: { x: e.clientX, y: e.clientY } }
    e.currentTarget.setPointerCapture?.(e.pointerId)
    if (!reduced) {
      void animate(sy, 0.94, { duration: 0.08 })
      void animate(sx, 1.04, { duration: 0.08 })
    }
  }
  const onPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current
    if (!d.down) return
    const step = Math.hypot(e.clientX - d.last.x, e.clientY - d.last.y)
    d.last = { x: e.clientX, y: e.clientY }
    d.travel += step
    d.total += step
    if (d.travel > Math.max(36, size * 0.45)) {
      d.travel = 0
      pet()
    }
  }
  const release = () => {
    const d = drag.current
    if (!d.down) return
    d.down = false
    if (!reduced) {
      void animate(sy, 1, { type: 'spring', stiffness: 500, damping: 12 })
      void animate(sx, 1, { type: 'spring', stiffness: 500, damping: 12 })
    }
    if (d.total < 10) {
      const now = performance.now()
      taps.current = [...taps.current.filter((t) => now - t < 1000), now]
      if (taps.current.length >= 3) {
        taps.current = []
        pet()
      } else {
        sound.tap()
      }
    }
  }
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      pet()
    }
  }

  const figure = (
    <motion.div className="ume-hop" style={{ y, scale: puff }}>
      <motion.div className="ume-squash" style={{ scaleX: sx, scaleY: sy, rotate: rot }}>
        <motion.div className="ume-breathe" style={{ scaleY: breathe }}>
          <UmeArt
            face={face}
            blink={blink}
            eyeX={eyeX}
            eyeY={eyeY}
            blossomWiggle={shown === 'excited' || shown === 'petted'}
            hearts={hearts}
            onHeartDone={heartDone}
            sparkles={shown === 'proud'}
            dozing={shown === 'sleepy'}
            thinking={shown === 'thinking'}
            reduced={reduced}
          />
        </motion.div>
      </motion.div>
    </motion.div>
  )

  return (
    <div ref={rootRef} className={`ume${className ? ` ${className}` : ''}`} style={{ width: size, height: size }} data-mood={shown}>
      <motion.div className="ume-bubble-anchor" style={{ y }}>
      <AnimatePresence>
        {bubble && (
          <motion.div
            key={bubble.id}
            className="ume-bubble"
            data-align={bubbleAlign}
            aria-hidden="true"
            initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.6, y: 6 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.85, y: 4 }}
            transition={reduced ? { duration: 0.12 } : { type: 'spring', stiffness: 520, damping: 26 }}
          >
            {bubble.text}
          </motion.div>
        )}
      </AnimatePresence>
      </motion.div>
      {interactive ? (
        <button
          type="button"
          className="ume-button"
          aria-label="Pet Ume"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={release}
          onPointerCancel={release}
          onKeyDown={onKeyDown}
        >
          {figure}
        </button>
      ) : (
        <div className="ume-button" aria-hidden="true">
          {figure}
        </div>
      )}
    </div>
  )
}
