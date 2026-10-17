// Streak milestone art for the courtyard world, drawn on the field color: a large star
// medallion that rules itself in line by line, fills with tile, then a ring of boteh and two
// tulips unfurl around it. About 1.2s when grow is true; static otherwise.
import { motion, useReducedMotion } from 'framer-motion'
import type { ArtProps } from '../../types'
import { botehPath, squarePaths, starPath } from './geometry'
import { Tulip } from './motifs'
import './medi.css'

const C = 160
const R = 104
const EASE = [0.22, 1, 0.36, 1] as const
const POP = { type: 'spring' as const, stiffness: 380, damping: 22, mass: 0.8 }

export function Milestone({ className, style, grow = false }: ArtProps & { grow?: boolean }) {
  const reduce = useReducedMotion()
  const play = grow && !reduce
  const [sqA, sqB] = squarePaths(C, C, R)

  const line = (delay: number, dur = 0.5) =>
    play
      ? { initial: { pathLength: 0, opacity: 0 }, animate: { pathLength: 1, opacity: 1 }, transition: { pathLength: { duration: dur, ease: EASE, delay }, opacity: { duration: 0.1, delay } } }
      : {}
  const pop = (delay: number) =>
    play ? { initial: { scale: 0, opacity: 0 }, animate: { scale: 1, opacity: 1 }, transition: { ...POP, delay } } : {}
  const rise = (delay: number) =>
    play ? { initial: { scaleY: 0, opacity: 0 }, animate: { scaleY: 1, opacity: 1 }, transition: { duration: 0.5, ease: EASE, delay } } : {}

  const center = { transformBox: 'fill-box' as const, transformOrigin: '50% 50%' }
  const base = { transformBox: 'fill-box' as const, transformOrigin: '50% 100%' }

  return (
    <div className={`mk mk-milestone${className ? ` ${className}` : ''}`} style={style} aria-hidden="true">
      <svg viewBox="0 0 320 320">
        {/* soft halo on the field */}
        <motion.circle cx={C} cy={C} r={R * 1.32} className="f-au" style={{ ...center, opacity: 0.6 }} {...pop(0)} />
        <motion.circle cx={C} cy={C} r={R * 1.22} className="f-none s-gold" strokeWidth="2" strokeDasharray="1 7" strokeLinecap="round" {...line(0.05, 0.7)} />

        {/* tile fill under the ruled lines */}
        <motion.path d={starPath(C, C, R)} className="f-tq" style={center} {...pop(0.35)} />
        <motion.path d={starPath(C, C, R * 0.7, 22.5)} className="f-p3" style={center} {...pop(0.48)} />
        <motion.path d={starPath(C, C, R * 0.42)} className="f-p5" style={center} {...pop(0.58)} />
        <motion.circle cx={C} cy={C} r={R * 0.16} className="f-p1" style={center} {...pop(0.66)} />

        {/* the two squares, ruled in like a tile maker's layout */}
        <motion.path d={sqA} className="f-none s-gold" strokeWidth="2.2" strokeLinejoin="round" {...line(0)} />
        <motion.path d={sqB} className="f-none s-gold" strokeWidth="2.2" strokeLinejoin="round" {...line(0.15)} />
        <motion.path d={starPath(C, C, R * 0.7, 22.5)} className="f-none s-au" strokeWidth="2" strokeLinejoin="round" {...line(0.5, 0.4)} />

        {/* a ring of boteh between the points */}
        {Array.from({ length: 8 }, (_, i) => {
          const a = ((i * 45 + 22.5) * Math.PI) / 180
          const x = C + Math.sin(a) * R * 1.04
          const y = C - Math.cos(a) * R * 1.04
          return (
            <g key={i} transform={`translate(${x} ${y}) rotate(${i * 45 + 22.5})`}>
              <motion.g style={center} {...pop(0.7 + i * 0.04)}>
                <path d={botehPath(26)} className={i % 2 ? 'f-p4' : 'f-p2'} />
                <path d={botehPath(13)} transform="translate(-0.5 4)" className="f-au" />
                <circle cx="-0.8" cy="7" r="2" className="f-gold" />
              </motion.g>
            </g>
          )
        })}

        {/* tulips unfurling at the foot */}
        <motion.g style={base} {...rise(0.75)}>
          <Tulip x={74} y={312} s={96} petal="f-p5" />
        </motion.g>
        <motion.g style={base} {...rise(0.85)}>
          <Tulip x={246} y={312} s={96} petal="f-p4" flip />
        </motion.g>
      </svg>
    </div>
  )
}
