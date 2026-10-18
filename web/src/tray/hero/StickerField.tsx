// Die-cut food stickers floating around the hero tray in depth layers. Each one drifts with the
// pointer by its depth (near ones move more), bobs on its own slow loop, and gathers toward the
// tray when the student heads into the game.
import { motion, useTransform, type MotionValue } from 'framer-motion'
import { useSyncExternalStore } from 'react'
import { Sticker, type StickerId } from './Stickers'

interface Placement {
  id: StickerId
  /** Position in percent of the hero box (sticker center). */
  left: number
  top: number
  size: number
  /** Parallax travel in px at the edge of the screen. */
  depth: number
  tilt: number
  /** Float loop length in seconds. */
  float: number
}

// Phones: four small stickers tucked at the corners of the tray, clear of the words below.
const NARROW: Placement[] = [
  { id: 'apple', left: 10, top: 16, size: 58, depth: 14, tilt: -8, float: 3.6 },
  { id: 'milk', left: 88, top: 13, size: 54, depth: 28, tilt: 7, float: 4.2 },
  { id: 'taco', left: 87, top: 44, size: 66, depth: 48, tilt: -6, float: 3.2 },
  { id: 'broccoli', left: 8, top: 40, size: 52, depth: 6, tilt: 6, float: 4.6 },
]

// Wide screens: a loose ring around the tray on the right, with a far one near the copy. The
// top center is the clock's, and the bottom band belongs to the tray canvas's foods.
const WIDE: Placement[] = [
  { id: 'apple', left: 62, top: 19, size: 92, depth: 14, tilt: -8, float: 3.8 },
  { id: 'milk', left: 92, top: 15, size: 84, depth: 28, tilt: 7, float: 4.2 },
  { id: 'taco', left: 93, top: 66, size: 112, depth: 48, tilt: -6, float: 3.3 },
  { id: 'broccoli', left: 52, top: 72, size: 86, depth: 28, tilt: 6, float: 4.6 },
  { id: 'rice', left: 72, top: 8, size: 70, depth: 6, tilt: 4, float: 4.0 },
  { id: 'carrot', left: 30, top: 10, size: 58, depth: 6, tilt: 12, float: 4.4 },
]

const WIDE_QUERY = '(min-width: 900px)'
const subscribeWide = (cb: () => void) => {
  const mq = window.matchMedia(WIDE_QUERY)
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}
const getWide = () => window.matchMedia(WIDE_QUERY).matches

const pop = { type: 'spring', stiffness: 380, damping: 22, mass: 0.8 } as const

function One({ p, i, px, py, reduce, leaving }: { p: Placement; i: number; px: MotionValue<number>; py: MotionValue<number>; reduce: boolean; leaving: boolean }) {
  const x = useTransform(px, (v) => -v * p.depth * 2)
  const y = useTransform(py, (v) => -v * p.depth * 2)
  // Pull toward the tray (roughly the hero center) on the way out.
  const towardX = (50 - p.left) * 2.2
  const towardY = (40 - p.top) * 2.2
  return (
    <motion.div
      className="sticker"
      style={{ left: `${p.left}%`, top: `${p.top}%`, width: p.size, height: p.size, x, y, zIndex: p.depth > 20 ? 3 : 1 }}
    >
      <motion.div
        className="sticker__pose"
        initial={reduce ? false : { scale: 0.3, rotate: p.tilt * 4, opacity: 0 }}
        animate={
          leaving
            ? { scale: 0.4, rotate: p.tilt, opacity: 0, x: towardX, y: towardY }
            : { scale: 1, rotate: p.tilt, opacity: 1, x: 0, y: 0 }
        }
        transition={leaving ? { type: 'spring', stiffness: 260, damping: 30, mass: 1 } : { ...pop, delay: reduce ? 0 : 0.35 + i * 0.07 }}
      >
        <div
          className={reduce ? 'sticker__float' : 'sticker__float is-floating'}
          style={{ animationDuration: `${p.float}s`, animationDelay: `${-i * 0.9}s` }}
        >
          <Sticker id={p.id} size={p.size} />
        </div>
      </motion.div>
    </motion.div>
  )
}

/** Props for the sticker field. */
export interface StickerFieldProps {
  /** Sprung pointer offset, -0.5 to 0.5. */
  px: MotionValue<number>
  py: MotionValue<number>
  reduce: boolean
  /** The student tapped in: stickers gather toward the tray and fade. */
  leaving: boolean
  /** far: the slow, small ones that sit behind the tray. near: the rest, in front of it. */
  layer: 'far' | 'near'
}

export function StickerField({ px, py, reduce, leaving, layer }: StickerFieldProps) {
  const wide = useSyncExternalStore(subscribeWide, getWide, () => false)
  const list = (wide ? WIDE : NARROW).map((p, i) => ({ p, i })).filter(({ p }) => (p.depth <= 6) === (layer === 'far'))
  return (
    <div className={`stickers stickers--${layer}`} aria-hidden="true">
      {list.map(({ p, i }) => (
        <One key={`${wide ? 'w' : 'n'}${p.id}`} p={p} i={i} px={px} py={py} reduce={reduce} leaving={leaving} />
      ))}
    </div>
  )
}
