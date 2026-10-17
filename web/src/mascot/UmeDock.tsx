// The companion in the bottom right corner of wide screens, in the gutter beside the page.
// Bounces around the gutter now and then and travels to elements when asked through
// ume.moveTo(). It always stays fully on screen, above the bottom edge and the safe area.
// Narrower screens get UmeInline inside the layout instead, so the dock renders nothing there
// and never covers content.
import { animate, motion, useMotionValue, useReducedMotion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { useDocked } from './dock'
import { FEET, STAGE, rigBus, type MascotHandle } from './rig/bus'
import { Ume } from './Ume'
import { useUmeState } from './store'

const rand = (a: number, b: number) => a + Math.random() * (b - a)
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
/** The rising half of a hop arc, then the fall. */
const RISE = [0.15, 0.75, 0.35, 1] as const
const FALL = [0.55, 0, 0.9, 0.45] as const
/** Keep the dock's head this far below the top bar when it bounces up the gutter. */
const TOP_CLEAR = 56 + 32

export type UmeDockProps = {
  /** Width in CSS pixels. Defaults to 106. */
  size?: number
  hidden?: boolean
  onPet?: (count: number) => void
}

export function UmeDock({ size, hidden = false, onPet }: UmeDockProps) {
  const state = useUmeState()
  const docked = useDocked()
  const reduced = !!useReducedMotion()
  const px = size ?? 106

  const homeRef = useRef<HTMLDivElement>(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const [away, setAway] = useState(false)
  const rig = useRef<MascotHandle | null>(null)
  const air = (ms: number) => {
    if (rig.current) rigBus.send(rig.current, { type: 'air', ms })
  }

  // Travel: spring onto the target's top edge, hold, then hop home.
  useEffect(() => {
    const move = state.move
    if (!move || !homeRef.current) return
    const home = homeRef.current.getBoundingClientRect()
    // Feet sit at 90% of the box; line them up with the top of the target.
    const dx = move.rect.left + move.rect.width / 2 - (home.left + home.width / 2)
    const dy = move.rect.top - (home.top + home.height * 0.9)
    let cancelled = false
    const go = async () => {
      setAway(true)
      if (reduced) {
        x.set(dx)
        y.set(dy)
      } else {
        const lift = Math.min(dy, 0) - 60
        air(620)
        await wait(90)
        void animate(x, dx, { duration: 0.62, ease: [0.3, 0, 0.3, 1] })
        await animate(y, lift, { duration: 0.32, ease: RISE })
        if (cancelled) return
        await animate(y, dy, { duration: 0.3, ease: FALL })
      }
      await new Promise((r) => setTimeout(r, move.holdMs))
      if (cancelled) return
      if (reduced) {
        x.set(0)
        y.set(0)
      } else {
        air(600)
        await wait(90)
        void animate(x, 0, { duration: 0.6, ease: [0.3, 0, 0.3, 1] })
        await animate(y, Math.min(dy, 0) - 50, { duration: 0.3, ease: RISE })
        if (cancelled) return
        await animate(y, 0, { duration: 0.3, ease: FALL })
      }
      if (!cancelled) setAway(false)
    }
    void go()
    return () => {
      cancelled = true
    }
  }, [state.move, reduced, x, y])

  // ume.back() clears the move: snap home.
  useEffect(() => {
    if (state.move) return
    if (reduced) {
      x.set(0)
      y.set(0)
    } else {
      void animate(x, 0, { type: 'spring', stiffness: 120, damping: 18 })
      void animate(y, 0, { type: 'spring', stiffness: 120, damping: 18 })
    }
  }, [state.move, reduced, x, y])

  // Wander: now and then bounce to a spot or two in the gutter (sideways and up), look around,
  // then hop home. Spots stay inside the gutter, below the top bar and above the bottom edge.
  const busy = !!state.move || away || reduced || hidden || !docked
  useEffect(() => {
    if (busy) return
    let cancelled = false
    let timer = 0
    const hopTo = async (toX: number, toY: number) => {
      const dist = Math.hypot(toX - x.get(), toY - y.get())
      const half = Math.min(0.42, 0.26 + dist / 2400)
      air(half * 2000)
      await wait(90)
      void animate(x, toX, { duration: half * 2, ease: [0.3, 0, 0.3, 1] })
      await animate(y, Math.min(y.get(), toY) - 44, { duration: half, ease: RISE })
      if (cancelled) return
      await animate(y, toY, { duration: half, ease: FALL })
    }
    const spot = () => {
      const home = homeRef.current?.getBoundingClientRect()
      const main = document.getElementById('main')?.getBoundingClientRect()
      if (!home || !main) return null
      // Sideways room between the page edge and home; upward room between home and the top bar.
      const side = Math.max(0, home.left - main.right - px * STAGE.side * 0.4 - 16)
      const up = Math.max(0, home.top - TOP_CLEAR - px * (STAGE.top - (1 - FEET)))
      if (side < 24 && up < 80) return null
      return { x: -rand(0, 1) * side, y: -rand(0.15, 0.85) * up }
    }
    const loop = () => {
      timer = window.setTimeout(async () => {
        const stops = Math.random() < 0.4 ? 2 : 1
        for (let k = 0; k < stops && !cancelled; k++) {
          const to = spot()
          if (!to) break
          await hopTo(to.x, to.y)
          await wait(rand(2600, 5200))
        }
        if (!cancelled && (x.get() !== 0 || y.get() !== 0)) await hopTo(0, 0)
        if (!cancelled) loop()
      }, rand(7000, 14000))
    }
    loop()
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [busy, px, x, y])

  if (hidden || !docked) return null

  return (
    <div className="ume-dock" ref={homeRef} style={{ width: px, height: px, ['--dock-size' as string]: `${px}px` }}>
      <motion.div style={{ x, y }}>
        <Ume
          size={px}
          mood={state.mood}
          say={state.line}
          sayKey={state.lineId}
          hopKey={state.hopId}
          bubbleAlign="end"
          bubbleInPlace
          onPet={onPet}
          rigRef={rig}
        />
      </motion.div>
    </div>
  )
}
