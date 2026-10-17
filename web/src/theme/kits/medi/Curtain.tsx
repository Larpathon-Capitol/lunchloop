// Hero-to-game cover for the courtyard world: two tall doors in the hero's pink plaster,
// each with a tiled pointed-arch panel and the same frieze as the hero. They hold shut while
// the game mounts, then swing open into the courtyard and call onDone once out of view.
import { motion, useReducedMotion } from 'framer-motion'
import { useId, useRef, useState } from 'react'
import { archPath, starPath } from './geometry'
import { useSize } from './hooks'
import './medi.css'

const OPEN = { duration: 0.8, ease: [0.6, 0, 0.2, 1] as const, delay: 0.05 }

function Door({ w, h, side, uid }: { w: number; h: number; side: 'l' | 'r'; uid: string }) {
  if (w <= 0 || h <= 0) return null
  const x0 = w * 0.17
  const x1 = w * 0.83
  const pw = x1 - x0
  const apex = Math.max(h * 0.12, 64)
  const spring = apex + pw * 0.866
  const bottom = h * 0.9
  const seam = side === 'l' ? w - 7 : 7
  const fr = 9
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <pattern id={`cd-t-${uid}-${side}`} width="44" height="44" patternUnits="userSpaceOnUse" x={side === 'l' ? 0 : 22}>
          <rect width="44" height="44" className="f-p1" />
          <path d={starPath(22, 22, 14)} className="f-p2 s-p3" strokeWidth="1.2" />
          <path d={starPath(22, 22, 6, 22.5)} className="f-p3" />
        </pattern>
        <pattern id={`cd-s-${uid}-${side}`} width={fr * 2.2} height={fr} patternUnits="userSpaceOnUse">
          <path d={`M0 0A${fr * 1.1} ${fr} 0 0 0 ${fr * 2.2} 0Z`} className="f-p4 s-au" strokeWidth="1.2" />
          <circle cx={fr * 1.1} cy={fr * 0.42} r={fr * 0.24} className="f-p1" />
        </pattern>
      </defs>
      {/* tiled arch panel with a turquoise border */}
      <path d={`${archPath(x0, x1, spring, bottom)}Z`} fill={`url(#cd-t-${uid}-${side})`} />
      <path d={`${archPath(x0, x1, spring, bottom, 7)}Z`} className="f-none s-tq" strokeWidth="10" strokeLinejoin="round" />
      <path d={`${archPath(x0, x1, spring, bottom, 7)}Z`} className="f-none s-p1" strokeWidth="3" strokeDasharray="0 9" strokeLinecap="round" />
      <path d={`${archPath(x0, x1, spring, bottom, 13)}Z`} className="f-none s-au" strokeWidth="2.5" strokeLinejoin="round" />
      {/* plinth under the panel */}
      <rect x={x0 - 16} y={bottom + 14} width={pw + 32} height={10} rx="2" className="f-au" />
      {/* frieze, matching the hero's */}
      <rect x="0" y="0" width={w} height="9" className="f-au" />
      <rect x="0" y="13" width={w} height="2.5" className="f-tq" />
      <rect x="0" y="19" width={w} height="3.5" className="f-au" />
      <rect x="0" y="22.5" width={w} height={fr} fill={`url(#cd-s-${uid}-${side})`} />
      {/* the meeting edge: turquoise stile, gold studs, a ring pull */}
      <rect x={side === 'l' ? w - 14 : 0} y="0" width="14" height={h} className="f-tq" />
      <path d={`M${seam} 30V${h}`} className="s-gold" strokeWidth="3" strokeDasharray="0 16" strokeLinecap="round" />
      <circle cx={side === 'l' ? w - 34 : 34} cy={h * 0.52} r="13" className="f-none s-gold" strokeWidth="4" />
      <circle cx={side === 'l' ? w - 34 : 34} cy={h * 0.52 - 15} r="4" className="f-gold" />
    </svg>
  )
}

export function Curtain({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const { w, h } = useSize(ref)
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const [done, setDone] = useState(false)
  const dw = Math.ceil(w * 0.505)

  const finish = () => {
    if (done) return
    setDone(true)
    onDone()
  }

  if (reduce) {
    return (
      <motion.div
        ref={ref}
        className="mk mk-curtain"
        aria-hidden="true"
        style={{ background: 'var(--m-p2)' }}
        initial={{ opacity: 1 }}
        animate={{ opacity: ready ? 0 : 1 }}
        transition={{ duration: 0.2 }}
        onAnimationComplete={() => ready && finish()}
      />
    )
  }

  return (
    <div ref={ref} className="mk mk-curtain" aria-hidden="true">
      <motion.div
        className="mk-door mk-door-l"
        initial={{ rotateY: 0, x: 0 }}
        animate={ready ? { rotateY: 96, x: -w * 0.04 } : { rotateY: 0, x: 0 }}
        transition={OPEN}
        onAnimationComplete={() => ready && finish()}
      >
        <Door w={dw} h={h} side="l" uid={uid} />
      </motion.div>
      <motion.div
        className="mk-door mk-door-r"
        initial={{ rotateY: 0, x: 0 }}
        animate={ready ? { rotateY: -96, x: w * 0.04 } : { rotateY: 0, x: 0 }}
        transition={OPEN}
      >
        <Door w={dw} h={h} side="r" uid={uid} />
      </motion.div>
    </div>
  )
}
