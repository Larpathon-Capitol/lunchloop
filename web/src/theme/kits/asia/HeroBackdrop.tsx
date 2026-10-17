// Konbini window at blossom dusk: a pale moon over drifting mist, a noren hung across the top,
// a glowing onigiri shelf over a slow seigaiha wave, a sakura branch reaching in from the top
// right, and petals blowing past the glass. Each layer moves with the pointer at its own depth.
import { motion, useReducedMotion, useTransform, type MotionValue } from 'framer-motion'
import type { HeroBackdropProps } from '../../types'
import { Branch } from './art'
import { HERO_BRANCH } from './branches'
import { C } from './paint'
import { seigaihaTile } from './pattern'
import { PetalField } from './PetalField'
import { Crest, MilkBottle, MistBand, OnigiriPack, Weave } from './pieces'
import { useDocHidden } from './useDocHidden'
import './asia.css'

/** Moves a layer opposite the pointer by depth px. */
function useDepth(px: MotionValue<number>, py: MotionValue<number>, depth: number, still: boolean) {
  const x = useTransform(px, (v) => (still ? 0 : -v * depth))
  const y = useTransform(py, (v) => (still ? 0 : -v * depth * 0.6))
  return { x, y }
}

// Seven panels; the outer two hide on phones so each panel stays taller than it is wide.
const PANELS = 7
const WAVES = seigaihaTile('#FFC2D1', '#FF8FAB', 1.6)

/** One noren panel. It swings away from the pointer; the nearer the pointer, the more it swings. */
function NorenPanel({ i, px, still }: { i: number; px: MotionValue<number>; still: boolean }) {
  const u = (i + 0.5) / PANELS - 0.5
  const rotate = useTransform(px, (v) => {
    if (still) return 0
    const d = u - v
    return 12 * d * Math.exp(-((d * 3.4) ** 2))
  })
  const centre = i === Math.floor(PANELS / 2)
  return (
    <motion.div className="ka-noren__panel" style={{ rotate }}>
      <div className={`ka-noren__cloth${still ? '' : ' ka-loop'}`} style={{ animationDelay: `${-i * 1.3}s` }}>
        <Weave strength={0.4} />
        <div className="ka-noren__hem" />
        {centre && (
          <div className="ka-noren__crest">
            <Crest size={64} />
          </div>
        )}
      </div>
    </motion.div>
  )
}

export function HeroBackdrop({ px, py, className }: HeroBackdropProps) {
  const reduce = useReducedMotion() ?? false
  const hidden = useDocHidden()
  const still = reduce
  const moon = useDepth(px, py, 8, still)
  const shelf = useDepth(px, py, 18, still)
  const noren = useDepth(px, py, 10, still)
  const branch = useDepth(px, py, 40, still)

  return (
    <div className={`ka ka-hero${className ? ` ${className}` : ''}`} data-paused={hidden || undefined} aria-hidden="true">
      <div className="ka-hero__sky" />

      <motion.div className="ka-hero__layer" style={moon}>
        <div className="ka-hero__moon">
          <svg viewBox="-100 -100 200 200" aria-hidden="true" focusable="false">
            <circle r="99" fill={C.pink2} opacity="0.55" />
            <circle r="84" fill={C.pink3} />
            <path d="M-50 -40a22 14 -20 1 0 1 0Z" fill={C.pink4} opacity="0.18" />
            <ellipse cx="34" cy="-28" rx="16" ry="11" fill={C.pink4} opacity="0.16" />
            <ellipse cx="12" cy="38" rx="26" ry="14" fill={C.pink4} opacity="0.14" />
            <circle r="84" fill="none" stroke={C.surface} strokeOpacity="0.5" strokeWidth="1.5" />
          </svg>
        </div>
        <MistBand className="ka-hero__mist ka-hero__mist--a ka-loop" />
        <MistBand className="ka-hero__mist ka-hero__mist--b ka-loop" fill={C.pink1} />
      </motion.div>

      <motion.div className="ka-hero__layer ka-hero__ground" style={shelf}>
        <div className="ka-hero__waves">
          <div className="ka-hero__wave-tile ka-loop" style={{ backgroundImage: WAVES }} />
        </div>
        <div className="ka-hero__glow" />
        <div className="ka-hero__shelf">
          <div className="ka-hero__goods ka-hero__goods--left">
            <OnigiriPack className="ka-good" tag={C.leaf} n={1} />
            <OnigiriPack className="ka-good ka-good--b" tag={C.pink5} n={2} />
          </div>
          <div className="ka-hero__goods ka-hero__goods--right">
            <MilkBottle className="ka-good ka-good--milk" />
            <OnigiriPack className="ka-good" tag={C.vermilion} n={3} />
          </div>
          <div className="ka-hero__board" />
        </div>
      </motion.div>

      <motion.div className="ka-hero__layer ka-noren" style={noren}>
        <div className="ka-noren__rod" />
        <div className="ka-noren__row">
          {Array.from({ length: PANELS }, (_, i) => (
            <NorenPanel key={i} i={i} px={px} still={still} />
          ))}
        </div>
      </motion.div>

      <motion.div className="ka-hero__layer" style={branch}>
        <div className={`ka-hero__branch${still ? '' : ' ka-loop'}`}>
          <Branch art={HERO_BRANCH} />
        </div>
      </motion.div>

      <PetalField px={px} py={py} still={still} />
    </div>
  )
}
