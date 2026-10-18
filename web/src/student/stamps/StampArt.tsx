// One stamp in the book. Earned: the shape inked in the world's style (a die-cut sticker, a
// hanko impression, a tile medallion) that lands with the world's motion. Unearned: a faint
// dashed ghost of the same shape, filled from the bottom by progress.
import { motion, useReducedMotion, type TargetAndTransition, type Transition } from 'framer-motion'
import { useId } from 'react'
import { useThemeId } from '../../theme/store'
import type { ThemeId } from '../../theme/types'
import { SHAPES, fitLabel, type ShapeId } from './shapes'

const INSET = (k: number) => `translate(50 50) scale(${k}) translate(-50 -50)`

// Rough glyph widths per display face, as a share of the font size, for fitting labels.
const CHAR: Record<ThemeId, number> = { americas: 0.5, asia: 0.78, medi: 0.56 }

// Paper specks in a hanko impression, so the ink reads as pressed, not printed.
const SPECKS: ReadonlyArray<[number, number, number]> = [
  [24, 30, 1.4], [71, 22, 1.1], [80, 64, 1.6], [33, 76, 1.2], [58, 84, 0.9], [18, 58, 0.8], [64, 40, 0.7], [44, 18, 0.9],
]

/** How each world's stamp arrives: a slapped sticker, a pressed hanko, a tile snapping in. */
function landing(world: ThemeId, tilt: number, reduce: boolean, delay: number): { initial: TargetAndTransition; animate: TargetAndTransition; transition: Transition } {
  if (reduce) return { initial: { opacity: 0, rotate: tilt }, animate: { opacity: 1, rotate: tilt }, transition: { duration: 0.16, delay } }
  if (world === 'asia')
    return {
      initial: { opacity: 0, scale: 1.22, rotate: tilt },
      animate: { opacity: [0, 1, 1], scale: [1.22, 0.95, 1], rotate: tilt },
      transition: { duration: 0.42, times: [0, 0.45, 1], ease: 'easeOut', delay },
    }
  if (world === 'medi')
    return {
      initial: { opacity: 0, scale: 0.4, rotate: tilt + 40 },
      animate: { opacity: 1, scale: 1, rotate: tilt },
      transition: { type: 'spring', stiffness: 380, damping: 18, mass: 0.8, delay, opacity: { duration: 0.12, delay } },
    }
  return {
    initial: { opacity: 0, scaleX: 1.4, scaleY: 1.4, rotate: tilt - 10, y: -10 },
    animate: { opacity: 1, scaleX: [1.4, 1.1, 0.97, 1], scaleY: [1.4, 0.88, 1.04, 1], rotate: tilt, y: 0 },
    transition: {
      opacity: { duration: 0.08, delay },
      scaleX: { duration: 0.5, times: [0, 0.32, 0.66, 1], ease: 'easeOut', delay },
      scaleY: { duration: 0.5, times: [0, 0.32, 0.66, 1], ease: 'easeOut', delay },
      rotate: { type: 'spring', stiffness: 380, damping: 22, mass: 0.8, delay },
      y: { type: 'spring', stiffness: 380, damping: 22, mass: 0.8, delay },
    },
  }
}

function Label({ text, shape, world, className }: { text: string; shape: ShapeId; world: ThemeId; className: string }) {
  const { textWidth, textY = 50 } = SHAPES[shape]
  const { lines, size } = fitLabel(text, textWidth, CHAR[world])
  const lead = size * 1.02
  const top = textY - ((lines.length - 1) * lead) / 2 + size * 0.36
  return (
    <text className={className} textAnchor="middle" fontSize={size.toFixed(2)}>
      {lines.map((line, i) => (
        <tspan key={line} x="50" y={(top + i * lead).toFixed(2)}>
          {line}
        </tspan>
      ))}
    </text>
  )
}

interface StampArtProps {
  shape: ShapeId
  label: string
  tone: 0 | 1 | 2
  tilt: number
  earned: boolean
  /** 0 to 1, how full the ghost is. */
  progress: number
  /** Seconds before an earned stamp lands, for a page-wide stagger. */
  delay?: number
}

export function StampArt({ shape, label, tone, tilt, earned, progress, delay = 0 }: StampArtProps) {
  const world = useThemeId()
  const reduce = !!useReducedMotion()
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const { d, textY = 50 } = SHAPES[shape]
  const clip = `stamp-clip-${uid}`

  if (!earned) {
    const level = 100 - Math.max(0, Math.min(1, progress)) * 100
    return (
      <span className="stamp-art stamp-art--ghost" aria-hidden="true">
        <svg viewBox="-4 -4 108 108">
          <defs>
            <clipPath id={clip}>
              <path d={d} />
            </clipPath>
          </defs>
          <path d={d} className="stamp-ghost__base" />
          {progress > 0 && (
            <motion.rect
              x="-4"
              width="108"
              height="108"
              className="stamp-ghost__fill"
              clipPath={`url(#${clip})`}
              // attrY moves the SVG attribute; a plain y would be a CSS pixel transform.
              initial={reduce ? false : { attrY: 100 }}
              animate={{ attrY: level }}
              transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 120, damping: 20, delay: 0.2 + delay }}
            />
          )}
          <path d={d} transform={INSET(0.86)} className="stamp-ghost__line" />
          <Label text={label} shape={shape} world={world} className="stamp-ghost__text" />
        </svg>
      </span>
    )
  }

  const move = landing(world, tilt, reduce, delay)
  return (
    <motion.span
      className={`stamp-art stamp-art--earned stamp-tone-${tone}`}
      style={{ transformOrigin: '50% 60%' }}
      initial={move.initial}
      animate={move.animate}
      transition={move.transition}
      aria-hidden="true"
    >
      <svg viewBox="-4 -4 108 108">
        <defs>
          <clipPath id={clip}>
            <path d={d} />
          </clipPath>
        </defs>
        {world !== 'asia' && <path d={d} transform="translate(0 3)" className="stamp-face__shadow" />}
        {shape === 'rosette' && (
          <g className="stamp-face__tails">
            <path d="M37 72l-9 33 10-6 7 7 6-31Z" />
            <path d="M63 72l9 33-10-6-7 7-6-31Z" />
          </g>
        )}
        <path d={d} className="stamp-face__rim" />
        <path d={d} transform={INSET(world === 'asia' ? 1 : 0.87)} className="stamp-face__body" />
        <path d={d} transform={INSET(world === 'asia' ? 0.84 : 0.76)} className="stamp-face__line" />
        {world === 'asia' && (
          <g className="stamp-face__specks" clipPath={`url(#${clip})`}>
            {SPECKS.map(([x, y, r]) => (
              <circle key={`${x}-${y}`} cx={x} cy={y} r={r} />
            ))}
          </g>
        )}
        {world === 'medi' && (
          <g className="stamp-face__studs">
            <circle cx="50" cy="20" r="2" />
            <circle cx="50" cy="80" r="2" />
          </g>
        )}
        <Label text={label} shape={shape} world={world} className="stamp-face__text" />
        {/* Phones: the label would be too small to read (the caption under the stamp says it), so a check stands in. */}
        <path d={`M35 ${textY + 1}l10 10 20-22`} className="stamp-face__mark" />
        {!reduce && world !== 'asia' && (
          <g clipPath={`url(#${clip})`}>
            <g transform="rotate(24 50 50)">
              <motion.rect
                x="-30"
                y="-20"
                width="14"
                height="140"
                className="stamp-face__glint"
                initial={{ x: 0, opacity: 0 }}
                animate={{ x: [0, 150], opacity: [0, 0.7, 0] }}
                transition={{ duration: 0.55, delay: delay + 0.42, ease: [0.22, 1, 0.36, 1] }}
              />
            </g>
          </g>
        )}
      </svg>
    </motion.span>
  )
}
