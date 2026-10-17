import { useEffect, useId } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { sound } from '../shared/sound'
import { celebrateCopy } from './copy'
import './celebrate.css'

export interface HankoStampProps {
  label?: string
  visible: boolean
  /** Called once the seal has landed and the ink ring has played. */
  onDone?: () => void
  /** Seal width and height in px. Default 104. */
  size?: number
  /** Skip the built in stamp sound when the caller plays its own. */
  silent?: boolean
  className?: string
}

const REST = -6 // degrees: a hand never stamps perfectly square

/** Five carved petals, a small plum blossom cut into the seal. */
function Blossom({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <g transform={`translate(${cx} ${cy})`}>
      {[0, 72, 144, 216, 288].map((a) => (
        <ellipse key={a} cx="0" cy={-r * 0.62} rx={r * 0.42} ry={r * 0.52} transform={`rotate(${a})`} />
      ))}
    </g>
  )
}

/** A square vermilion seal that slams onto the page. */
export function HankoStamp({ label = celebrateCopy.packed, visible, onDone, size = 104, silent = false, className }: HankoStampProps) {
  const reduce = useReducedMotion()
  const uid = useId().replace(/:/g, '')
  const filterId = `hanko-rough-${uid}`
  const fontSize = Math.min(24, 74 / Math.max(3, label.length * 0.66))

  useEffect(() => {
    if (!visible || silent) return
    // The thump lands as the seal reaches the paper, not as it starts to move.
    const id = window.setTimeout(() => sound.stamp(), reduce ? 0 : 110)
    return () => window.clearTimeout(id)
  }, [visible, silent, reduce])

  useEffect(() => {
    if (!visible || !onDone) return
    const id = window.setTimeout(onDone, reduce ? 150 : 780)
    return () => window.clearTimeout(id)
  }, [visible, onDone, reduce])

  return (
    <span className={`hanko${className ? ` ${className}` : ''}`} style={{ width: size, height: size }}>
      <AnimatePresence>
        {visible && (
          <motion.span
            key="seal"
            role="img"
            aria-label={label}
            style={{ display: 'block', width: '100%', height: '100%' }}
            initial={reduce ? { opacity: 0, rotate: REST } : { scale: 1.4, rotate: REST + 9, opacity: 0 }}
            animate={reduce ? { opacity: 1, rotate: REST } : { scale: 1, rotate: REST, opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.22 } }}
            transition={
              reduce
                ? { duration: 0.15 }
                : { scale: { type: 'spring', duration: 0.5, bounce: 0.35 }, rotate: { type: 'spring', duration: 0.5, bounce: 0.35 }, opacity: { duration: 0.08 } }
            }
          >
            <svg className="hanko-seal" viewBox="0 0 100 100" aria-hidden="true">
              <defs>
                {/* Rough, inked edges, plus a few places where the ink did not take. */}
                <filter id={filterId} x="-8%" y="-8%" width="116%" height="116%" colorInterpolationFilters="sRGB">
                  <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="4" result="warp" />
                  <feDisplacementMap in="SourceGraphic" in2="warp" scale="3.4" xChannelSelector="R" yChannelSelector="G" result="rough" />
                  <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="1" seed="11" result="grain" />
                  <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -16 0 0 0 12.2" result="keep" />
                  <feComposite in="rough" in2="keep" operator="in" />
                </filter>
              </defs>
              <g filter={`url(#${filterId})`}>
                <rect x="5" y="5" width="90" height="90" rx="4" style={{ fill: 'var(--shu)' }} />
                <rect x="10.5" y="10.5" width="79" height="79" rx="1.5" fill="none" strokeWidth="2.4" style={{ stroke: 'var(--on-shu)' }} />
                <g style={{ fill: 'var(--on-shu)' }}>
                  <Blossom cx={50} cy={36} r={14} />
                  <circle cx="50" cy="36" r="3" style={{ fill: 'var(--shu)' }} />
                </g>
                <text
                  x="50"
                  y="73"
                  textAnchor="middle"
                  fontWeight="800"
                  fontSize={fontSize}
                  style={{ fill: 'var(--on-shu)', fontFamily: 'var(--font-display)' }}
                >
                  {label}
                </text>
              </g>
            </svg>
            {!reduce && (
              <motion.span
                className="hanko-ring"
                aria-hidden="true"
                initial={{ scale: 1, opacity: 0 }}
                animate={{ scale: [1, 1.04, 1.28], opacity: [0, 0.55, 0] }}
                transition={{ duration: 0.55, delay: 0.16, times: [0, 0.15, 1], ease: [0.7, 0, 0.2, 1] }}
              >
                <svg viewBox="0 0 100 100">
                  <rect x="5" y="5" width="90" height="90" rx="6" fill="none" strokeWidth="2" style={{ stroke: 'var(--shu)' }} />
                </svg>
              </motion.span>
            )}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  )
}
