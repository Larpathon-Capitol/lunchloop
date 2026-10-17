// The hanko: a vermilion seal pressed onto the packed tray. It drops in, squashes as it meets
// the paper, the ink spreads a little past the edge and a glint runs across it.
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useId } from 'react'
import { sound } from '../../../shared/sound'
import type { SealProps } from '../../types'
import { Blossom } from './art'
import { C } from './paint'
import './asia.css'

const REST = -6 // degrees: a hand never stamps perfectly square
const LAND_MS = 190 // when the seal meets the paper
const SETTLE_MS = 820

/**
 * The packed-tray seal. Under 72px it drops the word and keeps the blossom, so the stamp book
 * still reads at 48px. While visible is false it keeps an empty box of the same size, so
 * layouts do not jump when it lands.
 */
export function Seal({ visible, size = 104, label = 'Packed', silent = false, onDone, className }: SealProps) {
  const reduce = useReducedMotion()
  const uid = 'kas' + useId().replace(/[^a-zA-Z0-9]/g, '')
  const small = size < 72
  // The display face is wide, about 0.92em a letter. Long labels get squeezed to fit the border.
  const fs = Math.min(22, Math.max(14, 70 / Math.max(1, label.length * 0.92)))
  const tooLong = label.length * 0.92 * fs > 70

  useEffect(() => {
    if (!visible || silent) return
    const id = window.setTimeout(() => sound.stamp(), reduce ? 0 : LAND_MS)
    return () => window.clearTimeout(id)
  }, [visible, silent, reduce])

  useEffect(() => {
    if (!visible || !onDone) return
    const id = window.setTimeout(onDone, reduce ? 150 : SETTLE_MS)
    return () => window.clearTimeout(id)
  }, [visible, onDone, reduce])

  return (
    <span className={`ka ka-seal${className ? ` ${className}` : ''}`} style={{ width: size, height: size }}>
      <AnimatePresence>
        {visible && (
          <motion.span
            key="seal"
            className="ka-seal__body"
            role="img"
            aria-label={label}
            initial={reduce ? { opacity: 0, rotate: REST } : { opacity: 0, scaleX: 1.7, scaleY: 1.7, y: -16, rotate: REST + 12 }}
            animate={
              reduce
                ? { opacity: 1, rotate: REST }
                : { opacity: 1, scaleX: [1.7, 1.14, 0.97, 1], scaleY: [1.7, 0.86, 1.04, 1], y: [-16, 0, 0, 0], rotate: [REST + 12, REST, REST, REST] }
            }
            exit={{ opacity: 0, transition: { duration: 0.2 } }}
            transition={reduce ? { duration: 0.15 } : { duration: 0.52, times: [0, 0.37, 0.68, 1], ease: 'easeOut', opacity: { duration: 0.08 } }}
          >
            {!reduce && (
              <motion.span
                className="ka-seal__bleed"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: [0.9, 1.07, 1.05], opacity: [0, 0.3, 0.14] }}
                transition={{ delay: LAND_MS / 1000, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              />
            )}
            <svg className="ka-seal__svg" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
              <defs>
                {/* Rough inked edges, and a few places where the ink did not take. */}
                <filter id={`${uid}r`} x="-8%" y="-8%" width="116%" height="116%" colorInterpolationFilters="sRGB">
                  <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="2" seed="7" result="warp" />
                  <feDisplacementMap in="SourceGraphic" in2="warp" scale={small ? 2.2 : 3.4} xChannelSelector="R" yChannelSelector="G" result="rough" />
                  <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="1" seed="3" result="grain" />
                  <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -14 0 0 0 11" result="keep" />
                  <feComposite in="rough" in2="keep" operator="in" />
                </filter>
                <clipPath id={`${uid}c`}>
                  <rect x="5" y="5" width="90" height="90" rx="10" />
                </clipPath>
              </defs>
              <g filter={`url(#${uid}r)`}>
                <rect x="5" y="5" width="90" height="90" rx="10" fill={C.vermilion} />
                <rect x="11" y="11" width="78" height="78" rx="6" fill="none" stroke={C.surface} strokeWidth={small ? 3.4 : 2.4} />
                {small ? (
                  <g transform="translate(50 50)">
                    <Blossom r={30} seed={1} tint={C.surface} deep={C.surface} heart={C.vermilion} />
                  </g>
                ) : (
                  <>
                    <g transform="translate(50 35) rotate(-10)">
                      <Blossom r={18} seed={1} tint={C.surface} deep={C.surface} heart={C.vermilion} />
                    </g>
                    <text
                      x="50"
                      y={72 + fs * 0.34}
                      textAnchor="middle"
                      fontSize={fs}
                      fill={C.surface}
                      textLength={tooLong ? 70 : undefined}
                      lengthAdjust={tooLong ? 'spacingAndGlyphs' : undefined}
                      style={{ fontFamily: "var(--font-display, 'Dela Gothic One', sans-serif)" }}
                    >
                      {label}
                    </text>
                  </>
                )}
              </g>
              {!reduce && (
                <g clipPath={`url(#${uid}c)`}>
                  <motion.rect
                    y="-40"
                    width="18"
                    height="180"
                    fill="#fff"
                    opacity="0.45"
                    transform="rotate(24 50 50)"
                    initial={{ x: -60 }}
                    animate={{ x: 150 }}
                    transition={{ delay: 0.42, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                  />
                </g>
              )}
            </svg>
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  )
}
