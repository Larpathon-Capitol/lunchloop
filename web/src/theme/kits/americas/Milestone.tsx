// Streak milestone art on the cobalt field: a painted sun rising with brush-stroke rays,
// a papel picado string unfurling across the top, a painted flourish underneath and a
// few sparkles. Draws itself in over about 1.2 seconds when grow is true.
import { motion, useReducedMotion } from 'framer-motion'
import type { ArtProps } from '../../types'
import { Flag } from './shapes'
import { FLAG_FILLS, sparklePath, usePageHidden } from './util'
import './americas.css'

const CX = 160
const CY = 176
const RAYS = Array.from({ length: 13 }, (_, i) => {
  const a = Math.PI + ((i + 1) / 14) * Math.PI
  const long = i % 2 === 0
  const r0 = 62
  const r1 = long ? 122 : 100
  return {
    d: `M${(CX + Math.cos(a) * r0).toFixed(1)} ${(CY + Math.sin(a) * r0).toFixed(1)}L${(CX + Math.cos(a) * r1).toFixed(1)} ${(CY + Math.sin(a) * r1).toFixed(1)}`,
    long,
    i,
  }
})

// Flags hang from a drooping string across the top.
const FLAGS = Array.from({ length: 6 }, (_, i) => {
  const t = (i + 0.5) / 6
  const x = -10 + t * 340
  const y = 4 + 64 * t * (1 - t)
  return { x, y, i }
})

const FLOURISH_L = 'M156 206C140 206 132 196 116 196S92 208 76 204C70 202 66 198 64 194'
const FLOURISH_R = 'M164 206C180 206 188 196 204 196S228 208 244 204C250 202 254 198 256 194'

const SPARKS: ReadonlyArray<[number, number, number, string]> = [
  [36, 96, 9, 'amx-f-yellow'],
  [288, 100, 11, 'amx-f-pink4'],
  [22, 150, 6, 'amx-f-pink2'],
  [300, 156, 7, 'amx-f-leaf'],
]

const ease = [0.22, 1, 0.36, 1] as const

export function Milestone({ className, style, grow = false }: ArtProps & { grow?: boolean }) {
  const reduce = useReducedMotion()
  const hidden = usePageHidden()
  const animate = grow && !reduce
  // Start values when drawing in; the final state otherwise.
  const from = <T,>(start: T, end: T) => (animate ? start : end)

  return (
    <div className={`amx amx-milestone${className ? ` ${className}` : ''}`} style={style} data-paused={hidden || undefined} aria-hidden="true">
      <svg viewBox="0 0 320 220" preserveAspectRatio="xMidYMid meet">
        {RAYS.map((r) => (
          <motion.path
            key={r.i}
            d={r.d}
            fill="none"
            strokeLinecap="round"
            strokeWidth={r.long ? 11 : 7}
            className={r.long ? 'amx-s-yellow' : 'amx-s-pink4'}
            initial={{ pathLength: from(0, 1), opacity: from(0, 1) }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.45, delay: 0.08 + Math.abs(r.i - 6) * 0.045, ease }}
          />
        ))}

        <motion.g
          initial={{ scale: from(0.4, 1), opacity: from(0, 1) }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 380, damping: 22, mass: 0.8, delay: 0.05 }}
          style={{ originX: 0.5, originY: 1 }}
        >
          <path d={`M${CX - 50} ${CY}a50 50 0 0 1 100 0Z`} className="amx-f-pink5" />
          <path d={`M${CX - 38} ${CY}a38 38 0 0 1 76 0`} fill="none" strokeWidth="2" strokeDasharray="3 4" className="amx-s-ink" opacity="0.45" />
          <path d={`M${CX - 56} ${CY}H${CX + 56}`} strokeWidth="5" strokeLinecap="round" className="amx-s-yellow" />
        </motion.g>

        <motion.path
          d="M-10 4Q160 36 330 4"
          fill="none"
          className="amx-string"
          style={{ stroke: 'var(--amx-pink2)', opacity: 0.8 }}
          initial={{ pathLength: from(0, 1) }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.4, delay: 0.2, ease }}
        />
        {FLAGS.map((f) => (
          <motion.g
            key={f.i}
            initial={{ scaleY: from(0, 1), opacity: from(0, 1) }}
            animate={{ scaleY: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 380, damping: 18, delay: 0.32 + f.i * 0.08 }}
            style={{ originY: 0 }}
          >
            <Flag x={f.x} y={f.y} cut={f.i} fill={FLAG_FILLS[f.i % FLAG_FILLS.length]} scale={0.82} delay={f.i * 0.5} />
          </motion.g>
        ))}

        {[FLOURISH_L, FLOURISH_R].map((d) => (
          <motion.path
            key={d}
            d={d}
            fill="none"
            strokeWidth="3.2"
            strokeLinecap="round"
            className="amx-s-leaf"
            initial={{ pathLength: from(0, 1) }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.6, delay: 0.55, ease: [0.7, 0, 0.2, 1] }}
          />
        ))}
        {[
          [62, 191, -30],
          [258, 191, 30],
        ].map(([x, y, a]) => (
          <motion.ellipse
            key={x}
            cx={x}
            cy={y}
            rx="7"
            ry="3.4"
            transform={`rotate(${a} ${x} ${y})`}
            className="amx-f-leaf"
            initial={{ opacity: from(0, 1) }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2, delay: 1.05 }}
          />
        ))}
        <motion.circle
          cx="160"
          cy="206"
          r="4.5"
          className="amx-f-pink2"
          initial={{ scale: from(0, 1) }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 600, damping: 18, delay: 0.6 }}
        />

        {SPARKS.map(([x, y, r, cls], i) => (
          <g key={`${x}-${y}`} transform={`translate(${x} ${y})`}>
            <motion.g
              initial={{ scale: from(0, 1), rotate: from(-45, 0) }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 600, damping: 18, delay: 0.85 + i * 0.07 }}
            >
              <path d={sparklePath(r)} className={`${cls} amx-twinkle`} style={{ animationDelay: `${-i * 0.7}s` }} />
            </motion.g>
          </g>
        ))}
      </svg>
    </div>
  )
}
