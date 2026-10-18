// Block party at dusk: a slow sunburst sign, a painted wall with a sarape stripe, two papel
// picado strings crossing overhead, loteria cards and a checker tablecloth up front. Each layer follows
// the pointer at its own depth; the sunburst moves the other way.
import { motion, useReducedMotion, useTransform, type MotionValue } from 'framer-motion'
import { useEffect, useId, useRef, useState } from 'react'
import type { HeroBackdropProps } from '../../types'
import { LoteriaCard } from './Loteria'
import { HtmlBanner } from './shapes'
import { sparklePath, usePageHidden } from './util'
import './americas.css'

function useDepth(v: MotionValue<number>, depth: number, reduce: boolean | null) {
  return useTransform(v, (n) => (reduce ? 0 : n * depth))
}

/** A painted sarape stripe along the wall: pink, sun and leaf bands with zigzag seams. */
function SarapeStripe() {
  const id = `amx-sarape-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  return (
    <svg className="amx-sarape" aria-hidden="true" focusable="false">
      <defs>
        <pattern id={id} width="24" height="36" patternUnits="userSpaceOnUse">
          <rect width="24" height="36" className="amx-f-leaf" />
          <path d="M0 0H24V22L18 28L12 22L6 28L0 22Z" className="amx-f-yellow" />
          <path d="M0 0H24V9L18 15L12 9L6 15L0 9Z" className="amx-f-pink4" />
          <circle cx="12" cy="4.5" r="1.6" className="amx-f-pink1" />
          <circle cx="6" cy="31" r="1.4" className="amx-f-pink1" />
          <circle cx="18" cy="31" r="1.4" className="amx-f-pink1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  )
}

function useBox() {
  const ref = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ w: 390, h: 600 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect
      setBox((b) => (Math.abs(b.w - width) < 1 && Math.abs(b.h - height) < 1 ? b : { w: width, h: height }))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, box] as const
}

const SPARKS: ReadonlyArray<[x: number, y: number, r: number, cls: string, delay: number]> = [
  [0.06, 0.34, 11, 'amx-f-yellow', 0],
  [0.94, 0.3, 13, 'amx-f-pink5', 0.9],
  [0.12, 0.56, 8, 'amx-f-leaf', 1.6],
  [0.88, 0.52, 9, 'amx-f-yellow', 2.1],
  [0.3, 0.27, 6, 'amx-f-pink4', 1.2],
  [0.72, 0.25, 7, 'amx-f-cobalt', 0.4],
]

export function HeroBackdrop({ px, py, className }: HeroBackdropProps) {
  const reduce = useReducedMotion()
  const hidden = usePageHidden()
  const [ref, { w, h }] = useBox()

  const burstX = useDepth(px, -28, reduce)
  const burstY = useDepth(py, -18, reduce)
  const wallX = useDepth(px, 6, reduce)
  const tableX = useDepth(px, 14, reduce)
  const cardX = useDepth(px, 22, reduce)
  const cardY = useDepth(py, 8, reduce)
  const sparkX = useDepth(px, 18, reduce)
  const garX = useDepth(px, 32, reduce)
  const garY = useDepth(py, 14, reduce)

  // Flags are sized in real pixels so they read the same on a phone and a laptop.
  const wide = w > 720
  // Phones (and phones on their side): one string of small flags along the very top edge,
  // above the logo, instead of two big strings crossing through the logo and the clock.
  const compact = !wide || h < 520
  const scale = compact ? 0.6 : 1.05
  const gap = 62 * scale + (compact ? 8 : 22)
  const garH = compact ? 44 : Math.min(h * 0.42, 300)
  const yA = compact ? -5 : 10
  const yB = compact ? -5 : garH - 70
  // Wide screens: both strings are tied at one point just right of the logo (340px at 1440 wide)
  // and fan out to the right, so the logo sits on calm sunburst instead of flags.
  const tieX = compact ? -0.08 * w : w * (340 / 1440)
  const endX = w * 1.08
  const count = Math.max(4, Math.round((compact ? w + 40 : endX - tieX) / gap))

  return (
    <div
      ref={ref}
      className={`amx amx-hero${className ? ` ${className}` : ''}`}
      data-paused={hidden || undefined}
      aria-hidden="true"
    >
      <motion.div className="amx-layer" style={{ x: burstX, y: burstY }}>
        <div className="amx-burst-wrap">
          <div className={`amx-burst${reduce ? ' is-static' : ''}`} />
        </div>
      </motion.div>

      <motion.div className="amx-layer" style={{ x: wallX }}>
        <div className="amx-wall">
          <div className="amx-wall-sign">
            <SarapeStripe />
          </div>
        </div>
      </motion.div>

      <motion.div className="amx-layer" style={{ x: sparkX }}>
        {/* Each sparkle is its own <svg>, so its twinkle runs on the compositor instead of
            repainting a full-screen <svg> every frame. */}
        <div className="amx-sparkles">
          {SPARKS.map(([x, y, r, cls, d]) => {
            const R = r * (wide ? 1.4 : 1)
            return (
              <svg
                key={`${x}-${y}`}
                className="amx-spark amx-twinkle"
                viewBox={`${-R} ${-R} ${2 * R} ${2 * R}`}
                width={2 * R}
                height={2 * R}
                style={{ left: `${x * 100}%`, top: `${y * 100}%`, animationDelay: `${-d}s` }}
              >
                <path d={sparklePath(R)} className={cls} />
              </svg>
            )
          })}
        </div>
      </motion.div>

      <motion.div className="amx-layer" style={{ x: tableX }}>
        <div className="amx-table">
          <div className="amx-table-top" />
          <div className="amx-table-front" />
        </div>
      </motion.div>

      <motion.div className="amx-layer" style={{ x: cardX, y: cardY }}>
        <div className="amx-cards">
          <LoteriaCard card="sandia" className="amx-card amx-card-l" />
          <LoteriaCard card="pera" className="amx-card amx-card-r" />
        </div>
      </motion.div>

      <motion.div className="amx-layer" style={{ x: garX, y: garY }}>
        {/* Box pixels match the string coordinates (it starts 6% left of the hero), so every
            flag can be its own small layer that sways without repainting the rest. */}
        <div className="amx-hero-svg amx-garland" style={{ height: garH }}>
          <HtmlBanner originX={-0.06 * w} width={w * 1.12} height={garH} x0={tieX} y0={yA} x1={endX} y1={yB} sag={compact ? 5 : 30} count={count} scale={scale} />
          {!compact && (
            <HtmlBanner originX={-0.06 * w} width={w * 1.12} height={garH} x0={tieX} y0={yA + 4} x1={endX} y1={yA + 4} sag={30} count={count} scale={scale} shift={2} />
          )}
        </div>
      </motion.div>
    </div>
  )
}
