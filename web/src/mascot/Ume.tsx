// The world's mascot (Chispa, Ume or Lafa) as a live 3D toy. This component is the DOM half:
// an invisible pet button the size of the slot, the speech bubble and the petting particles.
// The model itself is drawn by the shared 3D layer (three/MascotLayer.tsx) into a stage box
// around the slot, so the page holds at most one extra WebGL canvas however many mascots it shows.
// Until the model has drawn (or when WebGL is missing) a still poster of the mascot fills the slot.
// Named Ume for the screens that already import it; Mascot is the same component.
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type MutableRefObject, type PointerEvent } from 'react'
import { sound } from '../shared/sound'
import { FloatOver } from './FloatOver'
import { THEME_INFO } from '../theme/registry'
import { useThemeId } from '../theme/store'
import type { MascotId } from '../theme/types'
import { lines, pickLine } from './lines'
import { mascotName } from './name'
import { rigBus, type MascotHandle } from './rig/bus'
import { announce, registerPet } from './store'
import type { Point, UmeMood } from './types'
import './ume.css'

export type UmeProps = {
  mood?: UmeMood
  /** Rendered width in CSS pixels. The slot is square; hops use headroom above it. */
  size?: number
  /** Called after each pet with the new lifetime pet count. */
  onPet?: (count: number) => void
  /** A short line for the speech bubble. Change it (or sayKey) to show it again. */
  say?: string | null
  sayKey?: number
  /** Viewport point to look at. Defaults to the pointer. */
  lookAt?: Point | null
  /** Bump to make the mascot hop once. */
  hopKey?: number
  /** Where the bubble sits over the mascot. */
  bubbleAlign?: 'center' | 'start' | 'end'
  /** Set false for purely decorative copies (no button, no petting). */
  interactive?: boolean
  /** Say a petted line when petted. On by default. */
  talkWhenPetted?: boolean
  /** Show this mascot instead of the current world's (for a world switcher). */
  mascotId?: MascotId
  /** For hosts that draw their own bubble: true while it shows, so the mouth moves. */
  talking?: boolean
  /** Keep the bubble inside this element instead of lifting it above the 3D layer. Only for hosts
   * that already sit above the layer (the dock). */
  bubbleInPlace?: boolean
  /** Receives the rig handle, for hosts that move the mascot around (the dock). */
  rigRef?: MutableRefObject<MascotHandle | null>
  className?: string
}
export type MascotProps = UmeProps

const BUBBLE_MS = 3500

/** The still image shown until the 3D model draws: public/mascots/<id>.webp, framed like the rig. */
const posterUrl = (id: MascotId) => `${import.meta.env.BASE_URL}mascots/${id}.webp`

const rand = (a: number, b: number) => a + Math.random() * (b - a)

function playPet() {
  const s = sound as typeof sound & { pet?: () => void }
  if (s.pet) s.pet()
  else s.tap()
}

type Bit = { id: number; dx: number; delay: number; turn: number }

/** The little things that float up when petted: sparks for Chispa, petals for Ume, hearts for Lafa. */
function BitShape({ mascot }: { mascot: MascotId }) {
  if (mascot === 'chispa')
    return (
      <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
        <path d="M10 1.5 12 8l6.5 2-6.5 2-2 6.5L8 12l-6.5-2L8 8z" fill="#ffc72c" stroke="#3a1626" strokeWidth="1.2" strokeLinejoin="round" />
      </svg>
    )
  if (mascot === 'ume')
    return (
      <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" focusable="false">
        <path d="M10 18C4 14 2.5 9 4 5.5 5.5 2.5 8.5 2.8 10 5c1.5-2.2 4.5-2.5 6 .5 1.5 3.5 0 8.5-6 12.5z" fill="#ffb3c6" stroke="#fb6f92" strokeWidth="1.2" />
      </svg>
    )
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" focusable="false">
      <path d="M10 17.5S2.5 13 2.5 7.6C2.5 5 4.4 3 6.7 3c1.5 0 2.6.8 3.3 2 .7-1.2 1.8-2 3.3-2 2.3 0 4.2 2 4.2 4.6 0 5.4-7.5 9.9-7.5 9.9z" fill="#fb6f92" stroke="#3a1626" strokeWidth="1.1" />
    </svg>
  )
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
  mascotId,
  talking = false,
  bubbleInPlace = false,
  rigRef,
  className,
}: UmeProps) {
  const reduced = !!useReducedMotion()
  const themeId = useThemeId()
  const mascot = mascotId ?? THEME_INFO[themeId].mascot
  const name = mascotName(mascot)
  const [override, setOverride] = useState<UmeMood | null>(null)
  const shown = override ?? mood
  const stageRef = useRef<HTMLDivElement>(null)
  const anchorRef = useRef<HTMLDivElement>(null)
  const [bubble, setBubble] = useState<{ text: string; id: number } | null>(null)
  const [ready, setReady] = useState(false)

  // ---- The rig handle: created once, registered while mounted, kept in step every render.
  const [handle] = useState(() =>
    rigBus.create({ stage: null as unknown as HTMLElement, size, mascot, mood: shown, reduced, talking: false, lookAt: null }),
  )
  useLayoutEffect(() => {
    rigBus.sync(handle, { size, mascot, mood: shown, reduced, talking: !!bubble || talking, lookAt: lookAt ?? null })
  })
  useLayoutEffect(() => {
    if (!stageRef.current) return
    rigBus.add(handle, stageRef.current, () => setReady(true))
    if (rigRef) rigRef.current = handle
    return () => {
      rigBus.remove(handle)
      if (rigRef) rigRef.current = null
    }
  }, [handle, rigRef])

  // External hop requests
  const firstHop = useRef(hopKey)
  useEffect(() => {
    if (hopKey === undefined || hopKey === firstHop.current) return
    rigBus.send(handle, { type: 'hop', height: 0.18 })
  }, [hopKey, handle])

  // ---- Speech bubble
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

  // ---- Particles (petted)
  const [bits, setBits] = useState<Bit[]>([])
  const bitId = useRef(0)
  const burst = useCallback((n = 3) => {
    const next: Bit[] = Array.from({ length: n }, (_, i) => ({
      id: ++bitId.current,
      dx: (i % 2 ? 1 : -1) * rand(0.18, 0.4) * size,
      delay: i * 0.12,
      turn: rand(-40, 40),
    }))
    setBits((b) => [...b.slice(-8), ...next])
  }, [size])
  const bitDone = useCallback((id: number) => setBits((b) => b.filter((x) => x.id !== id)), [])
  const prevShown = useRef(shown)
  // A petted mood set from outside gets a burst too; pets from here burst on their own.
  useEffect(() => {
    if (shown === 'petted' && prevShown.current !== 'petted' && override === null) burst()
    prevShown.current = shown
  }, [shown, override, burst])

  // ---- Petting
  const overrideTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const lastPet = useRef(0)
  const pet = useCallback(() => {
    const now = performance.now()
    if (now - lastPet.current < 550) return
    lastPet.current = now
    const { count, milestone } = registerPet()
    playPet()
    navigator.vibrate?.(8)
    burst()
    rigBus.kick(handle, 0.35)
    rigBus.send(handle, { type: 'squish' })
    rigBus.send(handle, { type: 'wiggle' })
    setOverride('petted')
    clearTimeout(overrideTimer.current)
    overrideTimer.current = setTimeout(() => setOverride(null), 2200)
    if (milestone) {
      setOverride('happy')
      rigBus.send(handle, { type: 'hop', height: 0.34, spin: 2 })
      burst(6)
      showLine(lines.petMilestone[milestone] ?? pickLine(lines.milestone))
    } else if (talkWhenPetted && (count === 1 || Math.random() < 0.35)) {
      showLine(pickLine(lines.petted))
    }
    onPet?.(count)
  }, [burst, handle, onPet, showLine, talkWhenPetted])

  useEffect(() => () => clearTimeout(overrideTimer.current), [])

  const drag = useRef<{ down: boolean; travel: number; last: Point; total: number }>({ down: false, travel: 0, last: { x: 0, y: 0 }, total: 0 })
  const taps = useRef<number[]>([])

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    drag.current = { down: true, travel: 0, total: 0, last: { x: e.clientX, y: e.clientY } }
    e.currentTarget.setPointerCapture?.(e.pointerId)
    rigBus.send(handle, { type: 'squish' })
  }
  const onPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current
    if (!d.down) return
    const step = Math.hypot(e.clientX - d.last.x, e.clientY - d.last.y)
    d.last = { x: e.clientX, y: e.clientY }
    d.travel += step
    d.total += step
    // Rubbing builds the pet level smoothly; every so much travel counts as one pet.
    rigBus.kick(handle, Math.min(0.05, step / 900))
    if (d.travel > Math.max(36, size * 0.45)) {
      d.travel = 0
      pet()
    }
  }
  const release = () => {
    const d = drag.current
    if (!d.down) return
    d.down = false
    if (d.total < 10) {
      const now = performance.now()
      taps.current = [...taps.current.filter((t) => now - t < 1000), now]
      if (taps.current.length >= 3) {
        taps.current = []
        pet()
      } else {
        sound.tap()
        rigBus.kick(handle, 0.12)
        rigBus.send(handle, { type: 'hop', height: 0.1 })
      }
    }
  }
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      pet()
    }
  }

  const bubbleEl = (
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
  )

  return (
    <div
      className={`ume mascot${className ? ` ${className}` : ''}`}
      style={{ width: size, height: size }}
      data-mood={shown}
      data-mascot={mascot}
      data-ready={ready}
    >
      <img className="mascot__poster" src={posterUrl(mascot)} alt="" aria-hidden="true" draggable={false} decoding="async" />
      <div ref={stageRef} className="mascot__stage" aria-hidden="true" />
      <div ref={anchorRef} className="ume-bubble-anchor">
        {bubbleInPlace ? (
          bubbleEl
        ) : (
          <FloatOver anchor={anchorRef} active={!!bubble}>
            {bubbleEl}
          </FloatOver>
        )}
      </div>
      <div className="mascot__bits" aria-hidden="true">
        {bits.map((b) => (
          <motion.span
            key={b.id}
            className="mascot__bit"
            initial={{ x: 0, y: 0, opacity: 0, scale: 0.4, rotate: 0 }}
            animate={
              reduced
                ? { opacity: [0, 1, 0], scale: 1, x: b.dx * 0.5, y: -size * 0.2 }
                : { opacity: [0, 1, 1, 0], scale: [0.4, 1.15, 1, 0.8], x: b.dx, y: -size * 0.75, rotate: b.turn }
            }
            transition={{ duration: reduced ? 0.6 : 1, delay: b.delay, ease: [0.22, 1, 0.36, 1] }}
            onAnimationComplete={() => bitDone(b.id)}
          >
            <BitShape mascot={mascot} />
          </motion.span>
        ))}
      </div>
      {interactive ? (
        <button
          type="button"
          className="ume-button"
          aria-label={`Pet ${name}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={release}
          onPointerCancel={release}
          onKeyDown={onKeyDown}
        />
      ) : (
        <div className="ume-button" aria-hidden="true" />
      )}
    </div>
  )
}

/** The world's mascot. Same component as Ume. */
export const Mascot = Ume
