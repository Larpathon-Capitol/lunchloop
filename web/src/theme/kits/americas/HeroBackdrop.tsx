// Block party at dusk: a slow sunburst sign, a painted wall, two papel picado strings
// crossing overhead, loteria cards and a checker tablecloth up front. Each layer follows
// the pointer at its own depth; the sunburst moves the other way.
import { motion, useReducedMotion, useTransform, type MotionValue } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import type { HeroBackdropProps } from '../../types'
import { LoteriaCard } from './Loteria'
import { Banner } from './shapes'
import { sparklePath, usePageHidden } from './util'
import './americas.css'

function useDepth(v: MotionValue<number>, depth: number, reduce: boolean | null) {
  return useTransform(v, (n) => (reduce ? 0 : n * depth))
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
  const scale = wide ? 1.05 : 0.78
  const gap = 62 * scale + (wide ? 22 : 6)
  const count = Math.max(4, Math.round((w + 40) / gap))
  const garH = Math.min(h * 0.42, wide ? 300 : 230)
  const yA = wide ? 10 : 6
  const yB = wide ? garH - 70 : garH - 95

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
        <div className="amx-wall" />
      </motion.div>

      <motion.div className="amx-layer" style={{ x: sparkX }}>
        <svg className="amx-sparkles" viewBox={`0 0 ${w} ${h}`}>
          {SPARKS.map(([x, y, r, cls, d]) => (
            <g key={`${x}-${y}`} transform={`translate(${x * w} ${y * h})`}>
              <path d={sparklePath(r * (wide ? 1.4 : 1))} className={`${cls} amx-twinkle`} style={{ animationDelay: `${-d}s` }} />
            </g>
          ))}
        </svg>
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
        <svg className="amx-hero-svg amx-garland" viewBox={`${-0.06 * w} 0 ${w * 1.12} ${garH}`} style={{ height: garH }}>
          <Banner x0={-0.08 * w} y0={yA} x1={w * 1.08} y1={yB} sag={wide ? 30 : 18} count={count} scale={scale} />
          <Banner x0={-0.08 * w} y0={yB + 6} x1={w * 1.08} y1={yA + 4} sag={wide ? 30 : 18} count={count} scale={scale} shift={2} />
        </svg>
      </motion.div>
    </div>
  )
}
