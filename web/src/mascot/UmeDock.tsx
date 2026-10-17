// The companion in the bottom right corner of wide screens, in the gutter beside the page.
// Peeks from its edge while the user scrolls down, wanders along the bottom of the gutter now
// and then, and travels to elements when asked through ume.moveTo(). Narrower screens get
// UmeInline inside the layout instead, so the dock renders nothing there and never covers content.
import { animate, motion, useMotionValue, useReducedMotion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { useDocked } from './dock'
import { rigBus, type MascotHandle } from './rig/bus'
import { Ume } from './Ume'
import { useUmeState } from './store'

const rand = (a: number, b: number) => a + Math.random() * (b - a)
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
/** The rising half of a hop arc, then the fall. */
const RISE = [0.15, 0.75, 0.35, 1] as const
const FALL = [0.55, 0, 0.9, 0.45] as const

export type UmeDockProps = {
  /** Width in CSS pixels. Defaults to 76. */
  size?: number
  hidden?: boolean
  onPet?: (count: number) => void
}

export function UmeDock({ size, hidden = false, onPet }: UmeDockProps) {
  const state = useUmeState()
  const docked = useDocked()
  const reduced = !!useReducedMotion()
  const px = size ?? 76

  const homeRef = useRef<HTMLDivElement>(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const peekY = useMotionValue(0)
  const [away, setAway] = useState(false)
  const [peek, setPeek] = useState(false)
  const rig = useRef<MascotHandle | null>(null)
  const air = (ms: number) => {
    if (rig.current) rigBus.send(rig.current, { type: 'air', ms })
  }

  // Peek: tuck half of Ume below the dock edge while scrolling down, pop back up on scroll up.
  useEffect(() => {
    let last = window.scrollY
    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const now = window.scrollY
        if (now < 120) setPeek(false)
        else if (now > last + 6) setPeek(true)
        else if (now < last - 6) setPeek(false)
        last = now
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [])

  useEffect(() => {
    const target = peek && !(away && state.move) ? px * 0.5 : 0
    if (reduced) peekY.set(target)
    else void animate(peekY, target, { type: 'spring', stiffness: 380, damping: 26 })
  }, [peek, away, state.move, px, reduced, peekY])

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
      peekY.set(0)
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
  }, [state.move, reduced, x, y, peekY])

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

  // Wander: now and then hop to another spot along the bottom of the gutter, look around, hop home.
  const busy = !!state.move || away || peek || reduced || hidden || !docked
  useEffect(() => {
    if (busy) return
    let cancelled = false
    let timer = 0
    const hopTo = async (to: number) => {
      air(560)
      await wait(90)
      void animate(x, to, { duration: 0.56, ease: [0.3, 0, 0.3, 1] })
      await animate(y, -44, { duration: 0.28, ease: RISE })
      await animate(y, 0, { duration: 0.28, ease: FALL })
    }
    const loop = () => {
      timer = window.setTimeout(async () => {
        const main = document.getElementById('main')?.getBoundingClientRect()
        const gutter = main ? window.innerWidth - main.right : 0
        const room = gutter - px - 48
        if (room > 60 && !cancelled) {
          await hopTo(-rand(0.4, 1) * room)
          await wait(rand(3500, 7000))
          if (!cancelled) await hopTo(0)
        }
        if (!cancelled) loop()
      }, rand(14000, 26000))
    }
    loop()
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [busy, px, x, y])

  const free = away && !!state.move

  if (hidden || !docked) return null

  return (
    <div className="ume-dock" data-free={free} ref={homeRef} style={{ width: px, height: px }}>
      <motion.div style={{ x, y }} onPointerEnter={() => setPeek(false)}>
        <motion.div style={{ y: peekY }}>
          <Ume
            size={px}
            mood={state.mood}
            say={state.line}
            sayKey={state.lineId}
            hopKey={state.hopId}
            bubbleAlign="end"
            onPet={onPet}
            rigRef={rig}
          />
        </motion.div>
      </motion.div>
    </div>
  )
}
