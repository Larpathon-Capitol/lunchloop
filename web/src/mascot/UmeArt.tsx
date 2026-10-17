// The drawing. One inline SVG, 120 x 120 viewBox, lineless rice with a single sumi
// outline weight (LINE) shared by every stroke. Behavior lives in Ume.tsx.
import { AnimatePresence, motion, type MotionValue } from 'framer-motion'
import { useId } from 'react'
import { LINE, P } from './palette'

export type EyeKind = 'open' | 'wide' | 'happy' | 'bliss' | 'squeeze' | 'sleepy'
export type MouthKind = 'smile' | 'open' | 'o' | 'small' | 'smug' | 'hmm'

export type Face = {
  eyes: EyeKind
  mouth: MouthKind
  /** 0..1, how flushed the cheeks are. */
  blush: number
}

// Rounded triangle with gently bulging sides: chubby, not a geometric icon.
const BODY =
  'M60 12C70.5 12 77.6 18.6 84.6 30.4C91 41.4 99 54.6 104.4 64.6C108.7 72.6 111 80 111 87.6C111 100.6 101.6 108.6 88.2 108.6H31.8C18.4 108.6 9 100.6 9 87.6C9 80 11.3 72.6 15.6 64.6C21 54.6 29 41.4 35.4 30.4C42.4 18.6 49.5 12 60 12Z'

const EYE_Y = 63.5
const EYE_DX = 11.8
const MOUTH_Y = 72.5

// Rice grains along the edges, in the shade color: texture without noise.
const GRAINS: [number, number, number][] = [
  [27.5, 66, -58],
  [38, 44, -56],
  [50.5, 25.5, -40],
  [90.5, 57, 58],
  [99, 79, 74],
  [19.5, 86, -84],
]

/** The plum blossom hair clip. Petals are round (ume, not sakura). */
const PETALS = [0, 72, 144, 216, 288].map((deg) => {
  const r = (deg - 90) * (Math.PI / 180)
  return { cx: Math.cos(r) * 4.9, cy: Math.sin(r) * 4.9 }
})

function Eye({ kind, side }: { kind: EyeKind; side: -1 | 1 }) {
  const stroke = { stroke: P.ink, strokeWidth: LINE, strokeLinecap: 'round' as const, fill: 'none' }
  switch (kind) {
    case 'happy':
      return <path d="M-4.6 2.2Q0-4.4 4.6 2.2" style={stroke} />
    case 'bliss':
      return <path d="M-4.8-0.8Q0 4.4 4.8-0.8" style={stroke} />
    case 'squeeze':
      // Eyes squeezed shut with delight: > <
      return <path d={side < 0 ? 'M-3.4-3.8L3 0L-3.4 3.8' : 'M3.4-3.8L-3 0L3.4 3.8'} style={{ ...stroke, strokeLinejoin: 'round' }} />
    case 'sleepy': {
      // Heavy, rounded lids over the lower part of the eye.
      const rx = 4.4
      const ry = 5.6
      const yc = 1.2
      const xc = rx * Math.sqrt(1 - (yc / ry) ** 2)
      return (
        <g>
          <path d={`M${-xc} ${yc}Q0 ${yc + 2.6} ${xc} ${yc}A${rx} ${ry} 0 0 1 ${-xc} ${yc}Z`} style={{ fill: P.ink }} />
          <path d={`M${-xc - 1.2} ${yc - 0.4}Q0 ${yc + 2.8} ${xc + 1.2} ${yc - 0.4}`} style={stroke} />
        </g>
      )
    }
    case 'wide':
      return (
        <g>
          <ellipse rx={5.1} ry={6.5} style={{ fill: P.ink }} />
          <circle cx={1.7} cy={-2.4} r={1.9} style={{ fill: P.white }} />
          <circle cx={-1.8} cy={2.6} r={0.9} style={{ fill: P.white }} />
        </g>
      )
    default:
      return (
        <g>
          <ellipse rx={4.3} ry={5.6} style={{ fill: P.ink }} />
          <circle cx={1.5} cy={-2.1} r={1.55} style={{ fill: P.white }} />
        </g>
      )
  }
}

function Mouth({ kind }: { kind: MouthKind }) {
  const stroke = { stroke: P.ink, strokeWidth: LINE, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' }
  switch (kind) {
    case 'open':
      return (
        <g>
          <path d="M-4.6-0.8Q0 0.2 4.6-0.8Q4 6.4 0 6.4Q-4 6.4-4.6-0.8Z" style={{ fill: P.ink, stroke: P.ink, strokeWidth: 1.2, strokeLinejoin: 'round' }} />
          <path d="M-2.4 4.6Q0 2.7 2.4 4.6Q1.4 5.9 0 5.9Q-1.4 5.9-2.4 4.6Z" style={{ fill: P.blush }} />
        </g>
      )
    case 'o':
      return <ellipse cy={1.6} rx={2.5} ry={3.1} style={{ fill: P.ink }} />
    case 'small':
      return <ellipse cy={1} rx={1.6} ry={1.8} style={{ fill: P.ink }} />
    case 'smug':
      return <path d="M-4.4 0Q-0.6 4 4.4-1.2" style={stroke} />
    case 'hmm':
      return <path d="M-1.6 1.2Q1 0 3.8 1" style={stroke} />
    default:
      return <path d="M-3.4 0Q0 3.6 3.4 0" style={stroke} />
  }
}

export type Heart = { id: number; dx: number; delay: number }

type ArtProps = {
  face: Face
  blink: boolean
  eyeX: MotionValue<number>
  eyeY: MotionValue<number>
  blossomWiggle: boolean
  hearts: Heart[]
  onHeartDone: (id: number) => void
  sparkles: boolean
  dozing: boolean
  thinking: boolean
  reduced: boolean
}

const SPARKS = [
  { x: 20, y: 28, s: 1.5, d: 0 },
  { x: 106, y: 40, s: 1.2, d: 0.35 },
  { x: 98, y: 6, s: 1, d: 0.7 },
  { x: 8, y: 56, s: 0.9, d: 1.05 },
]

export function UmeArt(p: ArtProps) {
  const uid = useId().replace(/:/g, '')
  const clip = `ume-body-${uid}`
  const blinkable = p.face.eyes === 'open' || p.face.eyes === 'wide'
  const inst = p.reduced ? { duration: 0 } : undefined

  return (
    <svg viewBox="0 0 120 120" width="100%" height="100%" overflow="visible" aria-hidden="true" focusable="false">
      <defs>
        <clipPath id={clip}>
          <path d={BODY} />
        </clipPath>
      </defs>

      {/* Body: shade fill, rice offset up-left so a soft crescent shows lower right. */}
      <g clipPath={`url(#${clip})`}>
        <path d={BODY} style={{ fill: P.riceShade }} />
        <path d={BODY} transform="translate(-4.5 -4.5)" style={{ fill: P.rice }} />
        {GRAINS.map(([x, y, r]) => (
          <ellipse key={`${x}-${y}`} cx={x} cy={y} rx={2.5} ry={1.25} transform={`rotate(${r} ${x} ${y})`} style={{ fill: P.grain }} />
        ))}
        {/* Nori belt */}
        <rect x={32} y={85} width={56} height={40} rx={4.5} style={{ fill: P.nori }} />
        <path d="M37.5 91.5Q38.5 89.4 42 89" style={{ stroke: P.noriSheen, strokeWidth: 2.2, strokeLinecap: 'round', fill: 'none' }} />
        <path d="M82 94V102" style={{ stroke: P.noriSheen, strokeWidth: 1.2, strokeLinecap: 'round', fill: 'none', opacity: 0.55 }} />
      </g>
      <path d={BODY} style={{ fill: 'none', stroke: P.ink, strokeWidth: LINE, strokeLinejoin: 'round' }} />

      {/* Cheeks */}
      {[-1, 1].map((side) => (
        <motion.ellipse
          key={side}
          cx={60 + side * 22}
          cy={72.5}
          rx={6.4}
          ry={3.9}
          initial={false}
          animate={{ opacity: 0.42 + p.face.blush * 0.5, scale: 1 + p.face.blush * 0.18 }}
          transition={inst ?? { type: 'spring', stiffness: 260, damping: 20 }}
          style={{ fill: P.blush, transformBox: 'fill-box', transformOrigin: 'center' }}
        />
      ))}

      {/* Eyes: shift together to look around, squash together to blink. */}
      <motion.g style={{ x: p.eyeX, y: p.eyeY }}>
        {[-1, 1].map((side) => (
          <g key={side} transform={`translate(${60 + side * EYE_DX} ${EYE_Y})`}>
            <motion.g
              initial={false}
              animate={{ scaleY: p.blink && blinkable ? 0.12 : 1 }}
              transition={{ duration: p.blink ? 0.06 : 0.1 }}
              style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
            >
              <Eye kind={p.face.eyes} side={side as -1 | 1} />
            </motion.g>
          </g>
        ))}
      </motion.g>

      <g transform={`translate(60 ${MOUTH_Y})`}>
        <Mouth kind={p.face.mouth} />
      </g>

      {/* Plum blossom hair clip. Outline-behind, then fill, so petals read as one flower. */}
      <g transform="translate(76.5 21.5) rotate(14)">
        <motion.g
          animate={p.blossomWiggle && !p.reduced ? { rotate: [0, -16, 12, -8, 5, 0] } : { rotate: 0 }}
          transition={p.blossomWiggle ? { duration: 0.8, repeat: Infinity, repeatDelay: 0.5 } : { type: 'spring', stiffness: 300, damping: 14 }}
        >
          {PETALS.map((c, i) => (
            <circle key={`o${i}`} cx={c.cx} cy={c.cy} r={4.4} style={{ fill: P.ink, stroke: P.ink, strokeWidth: LINE * 2 }} />
          ))}
          {PETALS.map((c, i) => (
            <circle key={`f${i}`} cx={c.cx} cy={c.cy} r={4.4} style={{ fill: P.petal }} />
          ))}
          <circle r={3.2} style={{ fill: P.petalTint }} />
          <circle r={1.6} style={{ fill: P.gold }} />
        </motion.g>
      </g>

      {/* Thinking: three rice grains drift up, one at a time. */}
      {p.thinking &&
        [0, 1, 2].map((i) => (
          <motion.ellipse
            key={i}
            cx={94 + i * 7.5}
            cy={30 - i * 8}
            rx={2.2 + i * 0.5}
            ry={1.4 + i * 0.3}
            transform={`rotate(-30 ${94 + i * 7.5} ${30 - i * 8})`}
            initial={{ opacity: 0 }}
            animate={{ opacity: p.reduced ? 1 : [0, 1, 1, 0] }}
            transition={p.reduced ? { duration: 0 } : { duration: 2.1, times: [0, 0.2, 0.75, 1], delay: i * 0.32, repeat: Infinity, repeatDelay: 0.2 }}
            style={{ fill: P.rice, stroke: P.ink, strokeWidth: LINE * 0.7 }}
          />
        ))}

      {/* Sleepy: one petal drifts up along a z, like a snore. */}
      {p.dozing && (
        <motion.path
          d="M0-3.2C2.6-3.2 4 -1 4 0.4C4 2.4 2 3.4 0 3.4C-2 3.4-4 2.4-4 0.4C-4-1-2.6-3.2 0-3.2Z"
          initial={{ x: 86, y: 30, opacity: 0 }}
          animate={
            p.reduced
              ? { x: 92, y: 18, opacity: 1 }
              : { x: [86, 98, 88, 100], y: [30, 26, 16, 12], opacity: [0, 1, 1, 0], rotate: [0, 30, -20, 40] }
          }
          transition={p.reduced ? { duration: 0 } : { duration: 3.2, ease: 'easeInOut', repeat: Infinity, repeatDelay: 0.6 }}
          style={{ fill: P.petal, stroke: P.ink, strokeWidth: LINE * 0.6 }}
        />
      )}

      {/* Proud: gold specks twinkle around the head. */}
      {p.sparkles &&
        SPARKS.map((s) => (
          <motion.path
            key={`${s.x}-${s.y}`}
            d="M0-5Q0.9-0.9 5 0Q0.9 0.9 0 5Q-0.9 0.9-5 0Q-0.9-0.9 0-5Z"
            initial={{ x: s.x, y: s.y, scale: 0 }}
            animate={p.reduced ? { scale: s.s } : { scale: [0, s.s, 0], rotate: [0, 45, 90] }}
            transition={p.reduced ? { duration: 0 } : { duration: 1.3, delay: s.d, repeat: Infinity, repeatDelay: 0.3 }}
            style={{ fill: P.gold, stroke: P.goldEdge, strokeWidth: 0.7, strokeLinejoin: 'round' }}
          />
        ))}

      {/* Petted: hearts made of two plum petals float up. */}
      <AnimatePresence>
        {p.hearts.map((h) => (
          <motion.g
            key={h.id}
            initial={{ x: 60 + h.dx, y: 52, opacity: 0, scale: 0.5 }}
            animate={
              p.reduced
                ? { opacity: [0, 1, 0], scale: 1.35 }
                : { x: 60 + h.dx * 1.35, y: 4, opacity: [0, 1, 1, 0], scale: 1.35, rotate: h.dx > 0 ? 16 : -16 }
            }
            transition={{ duration: p.reduced ? 1.2 : 1.5, delay: h.delay, ease: 'easeOut', opacity: { duration: p.reduced ? 1.2 : 1.5, delay: h.delay, times: p.reduced ? [0, 0.3, 1] : [0, 0.12, 0.7, 1] } }}
            onAnimationComplete={() => p.onHeartDone(h.id)}
          >
            <path
              d="M0 5.6C-1.2 4.4-6.6 1.4-6.6-2.4C-6.6-5-4.6-6.6-2.8-6.6C-1.4-6.6-0.4-5.8 0-4.6C0.4-5.8 1.4-6.6 2.8-6.6C4.6-6.6 6.6-5 6.6-2.4C6.6 1.4 1.2 4.4 0 5.6Z"
              style={{ fill: P.petal, stroke: P.ink, strokeWidth: LINE * 0.6, strokeLinejoin: 'round' }}
            />
            <ellipse cx={-2.8} cy={-3.4} rx={1.3} ry={0.9} transform="rotate(-30 -2.8 -3.4)" style={{ fill: P.petalTint }} />
          </motion.g>
        ))}
      </AnimatePresence>
    </svg>
  )
}
