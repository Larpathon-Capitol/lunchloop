// The noren curtain between the hero and the game: two cloth panels that start closed on the
// hero's pink ground, with the shop crest split across the seam, then part left and right.
import { motion, useReducedMotion } from 'framer-motion'
import { useEffect, useRef } from 'react'
import { C } from './paint'
import { seigaihaTile } from './pattern'
import { Crest, Weave } from './pieces'
import './asia.css'

const part = { type: 'spring', stiffness: 170, damping: 24, mass: 1 } as const
const WAVES = seigaihaTile('#FFC2D1', '#FF8FAB', 1.6)

function Panel({ side, ready, reduce, onOut }: { side: 'left' | 'right'; ready: boolean; reduce: boolean; onOut?: () => void }) {
  const away = side === 'left' ? '-104%' : '104%'
  return (
    <motion.div
      className={`ka-curtain__panel ka-curtain__panel--${side}`}
      initial={reduce ? { opacity: 1 } : { x: '0%', skewY: 0 }}
      animate={reduce ? { opacity: ready ? 0 : 1 } : { x: ready ? away : '0%', skewY: ready ? (side === 'left' ? 2.5 : -2.5) : 0 }}
      transition={reduce ? { duration: 0.2 } : part}
      onAnimationComplete={() => {
        if (ready) onOut?.()
      }}
    >
      <div className="ka-curtain__sky" />
      <Weave strength={0.4} />
      <div className="ka-curtain__moon">
        <svg viewBox="-100 -100 200 200" aria-hidden="true" focusable="false">
          <circle r="99" fill={C.pink2} opacity="0.55" />
          <circle r="84" fill={C.pink3} />
          <circle r="84" fill="none" stroke={C.surface} strokeOpacity="0.5" strokeWidth="1.5" />
        </svg>
      </div>
      <div className="ka-curtain__sleeve" />
      <div className="ka-curtain__crest">
        <Crest size={200} ring={C.indigo} cut={C.pink1} />
      </div>
      <div className="ka-curtain__waves" style={{ backgroundImage: WAVES }} />
      <div className="ka-curtain__hem" />
    </motion.div>
  )
}

/** Fixed, full viewport. Holds closed until ready, then parts and calls onDone once off screen. */
export function Curtain({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const reduce = useReducedMotion() ?? false
  const done = useRef(false)
  const finish = () => {
    if (done.current) return
    done.current = true
    onDone()
  }
  const finishRef = useRef(finish)
  useEffect(() => {
    finishRef.current = finish
  })

  // A fallback in case the animation end never arrives (tab hidden mid-open, for one).
  useEffect(() => {
    if (!ready) return
    const id = window.setTimeout(() => finishRef.current(), document.hidden ? 0 : 3000)
    return () => window.clearTimeout(id)
  }, [ready])

  return (
    <div className="ka ka-curtain" aria-hidden="true">
      <Panel side="left" ready={ready} reduce={reduce} />
      <Panel side="right" ready={ready} reduce={reduce} onOut={finish} />
    </div>
  )
}
