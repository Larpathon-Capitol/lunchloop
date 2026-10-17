// Streak milestone art on the indigo field: a full moon rises, seigaiha waves unfurl along the
// bottom, a sakura bough draws itself across the moon and its blossoms open one by one.
import { motion, useReducedMotion } from 'framer-motion'
import type { ArtProps } from '../../types'
import { Branch } from './art'
import { MILESTONE_BRANCH } from './branches'
import { brushEase, C, petalPath, spring } from './paint'
import { useDocHidden } from './useDocHidden'
import './asia.css'

/** Three nested half rings of one wave scale, centered on (cx, cy). */
function scaleArcs(cx: number, cy: number) {
  return [36, 26, 15].map((r) => `M${cx - r} ${cy}A${r} ${r} 0 0 1 ${cx + r} ${cy}`).join('')
}

const ROWS = [
  { y: 300, xs: [-8, 64, 136, 208, 280, 352, 424], o: 0.55 },
  { y: 326, xs: [28, 100, 172, 244, 316, 388], o: 0.8 },
]

// x, y, size, delay: petals that let go of the branch once it has bloomed.
const FALL = [
  [190, 150, 9, 1.5],
  [132, 112, 7, 2.3],
  [226, 92, 8, 3.1],
  [272, 140, 6, 3.8],
  [238, 232, 7, 4.4],
] as const

export function Milestone({ className, style, grow = false }: ArtProps & { grow?: boolean }) {
  const reduce = useReducedMotion()
  const hidden = useDocHidden()
  const anim = grow && !reduce
  return (
    <div className={`ka ka-mile${className ? ` ${className}` : ''}`} style={style} data-paused={hidden || undefined} aria-hidden="true">
      <svg className="ka-fill" viewBox="0 0 400 320" aria-hidden="true" focusable="false">
        <motion.g
          style={{ transformOrigin: '228px 150px' }}
          initial={anim ? { scale: 0.7, opacity: 0, y: 30 } : false}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ ...spring.settle, opacity: { duration: 0.3 } }}
        >
          <circle cx="228" cy="150" r="128" fill={C.pink1} opacity="0.08" />
          <circle cx="228" cy="150" r="112" fill={C.pink3} />
          <ellipse cx="190" cy="118" rx="26" ry="16" fill={C.pink4} opacity="0.18" />
          <ellipse cx="262" cy="190" rx="34" ry="18" fill={C.pink4} opacity="0.15" />
        </motion.g>
        <g fill="none" stroke={C.pink3} strokeWidth="2.4" strokeLinecap="round">
          {ROWS.map((row, ri) => (
            <g key={ri} opacity={row.o}>
              {row.xs.map((x, i) => (
                <g key={i}>
                  <circle cx={x} cy={row.y} r="37" fill={C.field} stroke="none" />
                  <motion.path
                    d={scaleArcs(x, row.y)}
                    initial={anim ? { pathLength: 0 } : false}
                    animate={{ pathLength: 1 }}
                    transition={{ delay: 0.1 + ri * 0.12 + i * 0.06, duration: 0.6, ease: brushEase }}
                  />
                </g>
              ))}
            </g>
          ))}
        </g>
      </svg>
      <Branch art={MILESTONE_BRANCH} grow={anim} delay={0.15} className="ka-fill" />
      {!reduce && (
        <svg className="ka-fill" viewBox="0 0 400 320" aria-hidden="true" focusable="false">
          {FALL.map(([x, y, s, d], i) => (
            <g key={i} transform={`translate(${x} ${y})`}>
              <g className="ka-mile__petal ka-loop" style={{ animationDelay: `${anim ? d : d - 6}s` }}>
                <path d={petalPath(s)} fill={i % 2 ? C.pink4 : C.pink3} />
              </g>
            </g>
          ))}
        </svg>
      )}
    </div>
  )
}
