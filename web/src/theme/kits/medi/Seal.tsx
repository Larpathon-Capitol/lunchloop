// Packed-tray seal for the courtyard world: an eight-point tile medallion. Its eight points
// fly in as shards and snap together, the center tile pops in with the label, the whole seal
// squashes once on the snap, and a gold glint sweeps across. When not visible it keeps an
// empty box of the same size so layouts do not jump.
import { motion, useReducedMotion } from 'framer-motion'
import { useEffect, useId } from 'react'
import { sound } from '../../../shared/sound'
import type { SealProps } from '../../types'
import { starPath, starShards } from './geometry'
import './medi.css'

const POP = { type: 'spring' as const, stiffness: 380, damping: 22, mass: 0.8 }
const SNAP_MS = 330
const DONE_MS = 1150
const C = 50
const R = 47

export function Seal({ visible, size = 104, label = 'Packed', silent = false, onDone, className }: SealProps) {
  const reduce = useReducedMotion()
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const small = size < 72
  const discR = small ? 30 : 25
  const fontSize = Math.min(small ? 17 : 15, (discR * 2 * 0.84) / Math.max(2.4, label.length * 0.54))

  useEffect(() => {
    if (!visible || silent) return
    const id = window.setTimeout(() => sound.stamp(), reduce ? 0 : SNAP_MS)
    return () => window.clearTimeout(id)
  }, [visible, silent, reduce])

  useEffect(() => {
    if (!visible || !onDone) return
    const id = window.setTimeout(onDone, reduce ? 200 : DONE_MS)
    return () => window.clearTimeout(id)
  }, [visible, onDone, reduce])

  const box = { width: size, height: size }
  if (!visible) return <span className={`mk mk-seal${className ? ` ${className}` : ''}`} style={box} aria-hidden="true" />

  const shards = starShards(C, C, R)
  const outline = starPath(C, C, R)
  const t0 = SNAP_MS / 1000

  return (
    <motion.span
      className={`mk mk-seal${className ? ` ${className}` : ''}`}
      style={{ ...box, rotate: -4 }}
      role="img"
      aria-label={label}
      initial={reduce ? { opacity: 0 } : undefined}
      animate={reduce ? { opacity: 1 } : { scaleX: [1, 1, 1.12, 0.96, 1], scaleY: [1, 1, 0.88, 1.04, 1] }}
      transition={reduce ? { duration: 0.2 } : { duration: 0.62, times: [0, t0 / 0.62 - 0.08, t0 / 0.62 + 0.1, 0.8, 1], ease: 'easeOut' }}
    >
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <defs>
          <clipPath id={`sc-${uid}`}>
            <path d={outline} />
          </clipPath>
          <linearGradient id={`sg-${uid}`} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset="0.5" stopColor="#fff6dc" stopOpacity="0.85" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* contact shadow, lands with the snap */}
        <motion.path
          d={outline}
          transform="translate(0 3.5)"
          fill="rgb(58 22 38 / 0.16)"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: reduce ? 0 : t0, duration: 0.2 }}
        />

        {/* eight shards fly in from their own direction */}
        {shards.map((d, i) => {
          const a = (i * 45 * Math.PI) / 180
          const dx = Math.sin(a) * 64
          const dy = -Math.cos(a) * 64
          return (
            <motion.path
              key={i}
              d={d}
              className="f-au s-au"
              strokeWidth="0.8"
              strokeLinejoin="round"
              initial={reduce ? false : { x: dx, y: dy, rotate: i % 2 ? 50 : -50, opacity: 0 }}
              animate={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
              transition={{ ...POP, stiffness: 420, delay: i * 0.025 }}
              style={{ transformBox: 'fill-box', transformOrigin: '50% 50%' }}
            />
          )
        })}

        {/* center tile and label pop in on the snap */}
        <motion.g
          initial={reduce ? false : { scale: 0.2, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ ...POP, delay: reduce ? 0 : t0 - 0.06 }}
          style={{ transformBox: 'fill-box', transformOrigin: '50% 50%' }}
        >
          <path d={starPath(C, C, R * 0.88)} className="f-none s-gold" strokeWidth="1.1" strokeLinejoin="round" />
          {!small && <path d={starPath(C, C, R * 0.74)} className="f-tq" />}
          {!small &&
            Array.from({ length: 8 }, (_, i) => {
              const a = (i * 45 * Math.PI) / 180
              return <circle key={i} cx={C + Math.sin(a) * R * 0.62} cy={C - Math.cos(a) * R * 0.62} r="2" className="f-p3" />
            })}
          <circle cx={C} cy={C} r={discR} className="f-p1 s-tq" strokeWidth={small ? 3.4 : 2.4} />
          {!small && <circle cx={C} cy={C} r={discR - 3.2} className="f-none s-p3" strokeWidth="0.8" />}
          <text
            x={C}
            y={C}
            dy="0.36em"
            textAnchor="middle"
            className="mk-seal-label f-au"
            fontSize={fontSize}
          >
            {label}
          </text>
        </motion.g>

        {/* gold glint sweeps across once it is whole */}
        {!reduce && (
          <g clipPath={`url(#sc-${uid})`}>
            <motion.rect
              x="-40"
              y="-10"
              width="36"
              height="120"
              fill={`url(#sg-${uid})`}
              transform="rotate(20 50 50)"
              initial={{ x: 0, opacity: 0 }}
              animate={{ x: [0, 0, 150], opacity: [0, 1, 1] }}
              transition={{ duration: 0.85, times: [0, 0.01, 1], delay: t0 + 0.18, ease: [0.22, 1, 0.36, 1] }}
            />
          </g>
        )}
      </svg>
    </motion.span>
  )
}
