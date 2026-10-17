// The packed-tray seal: a die-cut sticker slapped on at an angle. A white cut border,
// a yellow sign-painter burst, a pink disc and a cobalt name ribbon, with a halftone
// shine and a peeled corner that catches a glint once it lands.
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useId } from 'react'
import type { SealProps } from '../../types'
import { sound } from '../../../shared/sound'
import { americasCopy } from './copy'
import './americas.css'

const REST = -8

/** A rounded starburst with n points between radius r0 and r1, centered at 50,50. */
function burst(n: number, r0: number, r1: number) {
  let d = ''
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2
    const r = i % 2 ? r0 : r1
    d += `${i ? 'L' : 'M'}${(50 + Math.cos(a) * r).toFixed(2)} ${(50 + Math.sin(a) * r).toFixed(2)}`
  }
  return `${d}Z`
}
const OUTER = burst(14, 42, 48)
const INNER = burst(14, 37, 43)

// Halftone shine: dots that shrink away from the top left.
const DOTS = (() => {
  const out: Array<[number, number, number]> = []
  for (let y = 14; y < 56; y += 5) {
    for (let x = 14 + ((y / 5) % 2) * 2.5; x < 60; x += 5) {
      const d = Math.hypot(x - 18, y - 18)
      const r = 1.7 - d / 26
      if (r > 0.25) out.push([x, y, r])
    }
  }
  return out
})()

export function Seal({ visible, size = 120, label = americasCopy.packed, silent = false, onDone, className }: SealProps) {
  const reduce = useReducedMotion()
  const uid = useId().replace(/:/g, '')
  const clip = `amx-seal-clip-${uid}`
  const small = size < 72
  const fontSize = Math.min(small ? 23 : 20, 118 / Math.max(4, label.length))

  useEffect(() => {
    if (!visible || silent) return
    // The slap sounds as the sticker hits the paper, not when it starts to fall.
    const id = window.setTimeout(() => sound.stamp(), reduce ? 0 : 150)
    return () => window.clearTimeout(id)
  }, [visible, silent, reduce])

  useEffect(() => {
    if (!visible || !onDone) return
    const id = window.setTimeout(onDone, reduce ? 160 : 950)
    return () => window.clearTimeout(id)
  }, [visible, onDone, reduce])

  return (
    // The outer span always keeps its size, so layout does not jump when the seal lands.
    <span className={`amx amx-seal${className ? ` ${className}` : ''}`} style={{ width: size, height: size }}>
      <AnimatePresence>
        {visible && (
          <motion.span
            key="seal"
            className="amx-seal-body"
            role="img"
            aria-label={label}
            initial={reduce ? { opacity: 0, rotate: REST } : { opacity: 0, scaleX: 1.4, scaleY: 1.4, rotate: REST - 10, y: -10 }}
            animate={
              reduce
                ? { opacity: 1, rotate: REST }
                : { opacity: 1, scaleX: [1.4, 1.1, 0.97, 1], scaleY: [1.4, 0.88, 1.04, 1], rotate: REST, y: 0 }
            }
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
            transition={
              reduce
                ? { duration: 0.16 }
                : {
                    opacity: { duration: 0.08 },
                    scaleX: { duration: 0.5, times: [0, 0.32, 0.66, 1], ease: 'easeOut' },
                    scaleY: { duration: 0.5, times: [0, 0.32, 0.66, 1], ease: 'easeOut' },
                    rotate: { type: 'spring', stiffness: 380, damping: 22, mass: 0.8 },
                    y: { type: 'spring', stiffness: 380, damping: 22, mass: 0.8 },
                  }
            }
            style={{ transformOrigin: '50% 60%' }}
          >
            {!small && <span className="amx-seal-shadow" />}
            <svg viewBox="0 0 100 100" aria-hidden="true">
              <defs>
                <clipPath id={clip}>
                  <path d={INNER} />
                </clipPath>
              </defs>
              {/* the die-cut white border with a thin shadow line so it reads on white paper */}
              <path d={OUTER} className="amx-f-white" stroke="rgba(58,22,38,0.18)" strokeWidth="0.8" strokeLinejoin="round" />
              <path d={INNER} className="amx-f-yellow" strokeLinejoin="round" />
              <circle cx="50" cy="50" r="31" className="amx-f-pink5" />
              <circle cx="50" cy="50" r="27.5" fill="none" className="amx-s-ink" strokeWidth="1" strokeDasharray="2.2 2.4" opacity="0.55" />
              {!small && (
                <g transform="translate(50 31)">
                  <path d="M0-6C1-1 1-1 6 0 1 1 1 1 0 6-1 1-1 1-6 0-1-1-1-1 0-6Z" className="amx-f-yellow" />
                </g>
              )}
              {/* the name ribbon, wider than the disc, with notched ends */}
              <path d="M6 41h88l-5 9 5 9H6l5-9Z" className="amx-f-cobalt" />
              <text x="50" y={50 + fontSize * 0.36} textAnchor="middle" fontSize={fontSize} className="amx-f-white amx-seal-text">
                {label}
              </text>
              {!small && (
                <g clipPath={`url(#${clip})`} opacity="0.42">
                  {DOTS.map(([x, y, r]) => (
                    <circle key={`${x}-${y}`} cx={x} cy={y} r={r} className="amx-f-white" />
                  ))}
                </g>
              )}
              {/* the peeled corner: a folded white flap at the lower right */}
              <path d="M76 79l12-4c-2 6-6 10-12 12Z" className="amx-f-white" stroke="rgba(58,22,38,0.25)" strokeWidth="0.8" strokeLinejoin="round" />
              <path d="M76 79l12-4" stroke="rgba(58,22,38,0.35)" strokeWidth="0.8" />
              {!reduce && (
                <g clipPath={`url(#${clip})`}>
                  <g transform="rotate(24 50 50)">
                    <motion.g
                      initial={{ x: 0, opacity: 0 }}
                      animate={{ x: [0, 150], opacity: [0, 0.75, 0] }}
                      transition={{ duration: 0.55, delay: 0.42, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <rect x="-30" y="-20" width="16" height="140" className="amx-f-white" />
                    </motion.g>
                  </g>
                </g>
              )}
            </svg>
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  )
}
