// Papel picado for the Americas world: one cut-paper flag, and a string of them.
import type { CSSProperties } from 'react'
import { FLAG_FILLS } from './util'


/** Circle as a path, so it can be a hole in an evenodd outline. */
function ring(cx: number, cy: number, r: number) {
  return `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`
}

function diamond(cx: number, cy: number, w: number, h: number) {
  return `M${cx} ${cy - h}L${cx + w} ${cy}L${cx} ${cy + h}L${cx - w} ${cy}Z`
}

// One flag is 56 wide and 44 tall: a straight top, a scalloped bottom edge.
const W = 56
const BODY = 36
const SCALLOP = 7
const outline = (() => {
  let d = `M0 0H${W}V${BODY}`
  const step = W / SCALLOP
  for (let i = 0; i < SCALLOP; i++) d += `A${step / 2} ${step / 2} 0 0 1 ${W - step * (i + 1)} ${BODY}`
  return `${d}V0Z`
})()

// Three cut patterns. Holes never overlap, so evenodd keeps them as holes.
const border = (() => {
  let d = ''
  for (let i = 0; i < 6; i++) d += diamond(6 + i * 8.8, 8, 2.4, 2.6)
  for (let i = 0; i < SCALLOP; i++) d += ring(4 + i * 8, BODY - 1.5, 1.3)
  return d
})()
const flower = (() => {
  let d = ring(28, 21, 2.6)
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    d += ring(28 + Math.cos(a) * 7, 21 + Math.sin(a) * 7, 2.3)
  }
  return d + diamond(9, 22, 3, 5) + diamond(47, 22, 3, 5)
})()
const sun = (() => {
  // A ring (outer hole with the disc filled back in) and rays as small diamonds.
  let d = ring(28, 21, 7) + ring(28, 21, 4.2)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    d += diamond(28 + Math.cos(a) * 10.5, 21 + Math.sin(a) * 10.5, 1.6, 1.6)
  }
  return d + ring(9, 22, 2.4) + ring(47, 22, 2.4)
})()
const stars = (() => {
  let d = diamond(28, 21, 4.5, 8)
  d += diamond(16, 21, 2.5, 4.5) + diamond(40, 21, 2.5, 4.5)
  d += ring(7, 22, 1.8) + ring(49, 22, 1.8)
  return d
})()
const CUTS = [flower, sun, stars]

export interface FlagProps {
  /** Which cut pattern, 0 to 2 (wraps). */
  cut: number
  fill: string
  /** Seconds of delay so neighbors sway out of step. */
  delay?: number
  x: number
  y: number
  scale?: number
}

/** One papel picado flag hanging from x,y (its top center). Sways from the top. */
export function Flag({ cut, fill, delay = 0, x, y, scale = 1 }: FlagProps) {
  return (
    <g transform={`translate(${x - (W / 2) * scale} ${y}) scale(${scale})`}>
      <g className="amx-sway" style={{ animationDelay: `${-delay}s` } as CSSProperties}>
        <path className={fill} d={outline + border + CUTS[cut % CUTS.length]} fillRule="evenodd" opacity="0.94" />
        {/* the paper folded over the string */}
        <rect className="amx-fold" x="0" y="0" width={W} height="3.2" />
      </g>
    </g>
  )
}

export interface BannerProps {
  x0: number
  y0: number
  x1: number
  y1: number
  /** How far the string droops at its middle. */
  sag: number
  count: number
  scale?: number
  /** Offset into the fill cycle so crossing strings do not match. */
  shift?: number
}

/** A string of flags hanging from a drooping line between two points. */
export function Banner({ x0, y0, x1, y1, sag, count, scale = 1, shift = 0 }: BannerProps) {
  // Quadratic curve with its control point pulled down by twice the sag.
  const cx = (x0 + x1) / 2
  const cy = (y0 + y1) / 2 + sag * 2
  const at = (t: number) => ({
    x: (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * x1,
    y: (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * cy + t * t * y1,
  })
  const flags = Array.from({ length: count }, (_, i) => {
    const p = at((i + 0.5) / count)
    return (
      <Flag
        key={i}
        x={p.x}
        y={p.y - 1}
        scale={scale}
        cut={i + shift}
        fill={FLAG_FILLS[(i + shift) % FLAG_FILLS.length]}
        delay={(i * 0.37 + shift * 0.5) % 3.2}
      />
    )
  })
  return (
    <g>
      <path className="amx-string" d={`M${x0} ${y0}Q${cx} ${cy} ${x1} ${y1}`} fill="none" />
      {flags}
    </g>
  )
}
