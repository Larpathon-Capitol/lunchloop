// Hero backdrop for the courtyard world: "courtyard arch at pink hour".
// Back to front: a far zellige wall seen through the doorway (light sweep, lamp glow on the
// pointer, a slow-turning star medallion), a pennant chain strung inside the arch, the near
// plaster wall with the turquoise tile border and a truck-art frieze, and tulips up front.
// Each layer moves with the pointer at its own depth; the middle of the arch stays calm.
import { motion, useReducedMotion, useTransform, type MotionValue } from 'framer-motion'
import { useId, useMemo, useRef } from 'react'
import type { HeroBackdropProps } from '../../types'
import { archHalfWidth, archPath, starPath } from './geometry'
import { useDocHidden, useSize } from './hooks'
import { Boteh, Pomegranate, PomegranateHalf, StarTile, Tulip } from './motifs'
import './medi.css'

const M = 48 // layers overhang the hero by this much so parallax never shows an edge

const PENNANT_FILLS = ['f-p4', 'f-tq', 'f-p2', 'f-leaf', 'f-au', 'f-p5']

function useDepth(v: MotionValue<number>, depth: number, still: boolean) {
  return useTransform(v, (n) => (still ? 0 : n * depth))
}

interface Layout {
  W: number
  H: number
  x0: number
  x1: number
  mid: number
  springY: number
  apexY: number
  w: number
  wide: boolean
}

function layoutFor(W: number, H: number): Layout {
  // Phones: a touch wider, so the arch's tiled sides frame the screen instead of running
  // through the left edge of the words.
  const w = Math.min(W * (W < 700 ? 0.93 : 0.88), H * 0.94, 1000)
  const mid = W / 2
  const apexY = Math.max(H * 0.06, 58)
  const springY = apexY + w * 0.866
  return { W, H, x0: mid - w / 2, x1: mid + w / 2, mid, springY, apexY, w, wide: (W - w) / 2 > 150 }
}

/** The far wall through the doorway. */
function FarWall({ L, uid }: { L: Layout; uid: string }) {
  const T = Math.round(Math.max(56, Math.min(80, L.w * 0.09)))
  const c = T / 2
  return (
    <svg viewBox={`${-M} ${-M} ${L.W + 2 * M} ${L.H + 2 * M}`} aria-hidden="true">
      <defs>
        <pattern id={`zl-${uid}`} width={T} height={T} patternUnits="userSpaceOnUse">
          <path d={starPath(c, c, T * 0.34)} className="f-p2 s-p3" strokeWidth="1.2" strokeLinejoin="round" />
          <path d={starPath(c, c, T * 0.14, 22.5)} className="f-p3" />
          <path d={`M0 ${-T * 0.13}L${T * 0.13} 0L0 ${T * 0.13}L${-T * 0.13} 0Z M${T} ${-T * 0.13}L${T + T * 0.13} 0L${T} ${T * 0.13}L${T - T * 0.13} 0Z M0 ${T - T * 0.13}L${T * 0.13} ${T}L0 ${T + T * 0.13}L${-T * 0.13} ${T}Z M${T} ${T - T * 0.13}L${T + T * 0.13} ${T}L${T} ${T + T * 0.13}L${T - T * 0.13} ${T}Z`} className="f-p3" />
          <path d={`M${c} ${c - T * 0.34}V0M${c} ${c + T * 0.34}V${T}M${c - T * 0.34} ${c}H0M${c + T * 0.34} ${c}H${T}`} className="s-p3" strokeWidth="1" />
        </pattern>
        <radialGradient id={`calm-${uid}`} cx="50%" cy="56%" r="62%">
          <stop offset="0.28" stopColor="#000" />
          <stop offset="0.8" stopColor="#fff" />
        </radialGradient>
        <mask id={`mask-${uid}`}>
          <rect x={-M} y={-M} width={L.W + 2 * M} height={L.H + 2 * M} fill={`url(#calm-${uid})`} />
        </mask>
      </defs>
      <rect x={-M} y={-M} width={L.W + 2 * M} height={L.H + 2 * M} className="f-p1" />
      <rect x={-M} y={-M} width={L.W + 2 * M} height={L.H + 2 * M} fill={`url(#zl-${uid})`} mask={`url(#mask-${uid})`} />
    </svg>
  )
}

/** The big star turning slowly up under the apex. */
function Medallion({ L }: { L: Layout }) {
  const cy = L.apexY + Math.min(L.w * 0.3, L.H * 0.15)
  const R = Math.min(L.w * 0.16, L.H * 0.075, 74)
  return (
    <svg viewBox={`${-M} ${-M} ${L.W + 2 * M} ${L.H + 2 * M}`} aria-hidden="true">
      <circle cx={L.mid} cy={cy} r={R * 1.18} className="f-p2 s-p3" strokeWidth="1.5" />
      <circle cx={L.mid} cy={cy} r={R * 1.08} className="f-none s-au" strokeWidth="1" strokeDasharray="1 5" strokeLinecap="round" />
      <g className="mk-spin">
        <StarTile x={L.mid} y={cy} R={R} a="f-tq" b="f-p3" c="f-au" line="s-au" />
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i * 45 * Math.PI) / 180
          return <circle key={i} cx={L.mid + Math.sin(a) * R * 0.5} cy={cy - Math.cos(a) * R * 0.5} r={R * 0.06} className="f-p1" />
        })}
      </g>
    </svg>
  )
}

/** Pennants hung along a sagging string from a to b. */
function chain(a: number, b: number, y: number, sag: number, pw: number, k: string) {
  const n = Math.max(4, Math.floor((b - a) / (pw * 1.3)))
  const ph = pw * 1.3
  return (
    <g key={k}>
      <path d={`M${a} ${y}Q${(a + b) / 2} ${y + 2 * sag} ${b} ${y}`} className="f-none s-au" strokeWidth="1.6" />
      {Array.from({ length: n }, (_, i) => {
        const t = (i + 0.5) / n
        const x = a + (b - a) * t
        const yy = y + 4 * sag * t * (1 - t)
        const rot = (Math.atan((4 * sag * (1 - 2 * t)) / (b - a)) * 180) / Math.PI
        const fill = PENNANT_FILLS[i % PENNANT_FILLS.length]
        return (
          <g key={i} transform={`translate(${x} ${yy}) rotate(${rot})`}>
            <g className="mk-pennant" style={{ animationDelay: `${-i * 0.37}s`, animationDuration: `${3 + (i % 3) * 0.5}s` }}>
              <path d={`M${-pw / 2} 0H${pw / 2}L0 ${ph}Z`} className={`${fill} s-au`} strokeWidth="1" strokeLinejoin="round" />
              <path d={`M${-pw / 2} 0H${pw / 2}`} className="s-au" strokeWidth="2.4" />
              <path d={`M0 ${ph * 0.2}L${pw * 0.12} ${ph * 0.36}L0 ${ph * 0.52}L${-pw * 0.12} ${ph * 0.36}Z`} className={fill === 'f-au' || fill === 'f-tq' ? 'f-p2' : 'f-au'} />
            </g>
          </g>
        )
      })}
    </g>
  )
}

/** A string of pennants slung across the arch. */
function Pennants({ L }: { L: Layout }) {
  const y = L.apexY + Math.min(L.w * 0.58, L.H * 0.27)
  const hw = archHalfWidth(L.x0, L.x1, L.springY, y) - 4
  const sag = Math.min(hw * 0.22, 46)
  const pw = Math.max(20, Math.min(34, hw * 0.13))
  return (
    <svg viewBox={`${-M} ${-M} ${L.W + 2 * M} ${L.H + 2 * M}`} aria-hidden="true">
      {chain(L.mid - hw, L.mid + hw, y, sag, pw, 'in')}
    </svg>
  )
}

/** Near plaster wall: arch cut out, tile border, truck-art frieze and the spandrel motifs. */
function NearWall({ L, uid }: { L: Layout; uid: string }) {
  const { x0, x1, springY, W, H, mid } = L
  const bottom = H + M
  const outer = `M${-M} ${-M}H${W + M}V${H + M}H${-M}Z`
  const opening = `${archPath(x0, x1, springY, bottom)}Z`
  const band = Math.max(18, Math.min(30, L.w * 0.034))
  const sideW = x0
  const fr = 9 // frieze scallop radius
  const lift = L.wide ? H * 0.16 : 0 // on wide screens the spandrel motifs sit below the swags
  return (
    <svg viewBox={`${-M} ${-M} ${W + 2 * M} ${H + 2 * M}`} aria-hidden="true">
      <defs>
        <pattern id={`scal-${uid}`} width={fr * 2.2} height={fr * 2} patternUnits="userSpaceOnUse" x={-M}>
          <path d={`M0 0A${fr * 1.1} ${fr} 0 0 0 ${fr * 2.2} 0Z`} className="f-p4 s-au" strokeWidth="1.2" />
          <circle cx={fr * 1.1} cy={fr * 0.42} r={fr * 0.24} className="f-p1" />
        </pattern>
        <pattern id={`sten-${uid}`} width="48" height="48" patternUnits="userSpaceOnUse">
          <path d={starPath(24, 24, 12)} className="f-none s-p1" strokeWidth="1.2" opacity="0.7" />
          <circle cx="0" cy="0" r="2" className="f-p3" />
          <circle cx="48" cy="0" r="2" className="f-p3" />
          <circle cx="0" cy="48" r="2" className="f-p3" />
          <circle cx="48" cy="48" r="2" className="f-p3" />
        </pattern>
        <pattern id={`panel-${uid}`} width="40" height="40" patternUnits="userSpaceOnUse">
          <rect width="40" height="40" className="f-p3" />
          <path d={starPath(20, 20, 13)} className="f-tq s-au" strokeWidth="1" />
          <path d={starPath(20, 20, 6, 22.5)} className="f-p1" />
          <path d="M0 -6L6 0L0 6L-6 0ZM40 -6L46 0L40 6L34 0ZM0 34L6 40L0 46L-6 40ZM40 34L46 40L40 46L34 40Z" className="f-au" />
        </pattern>
      </defs>

      {/* plaster with the doorway cut out, and a faint stencilled star lattice on it */}
      <path d={`${outer}${opening}`} fillRule="evenodd" className="f-p2" />
      <path d={`${outer}${opening}`} fillRule="evenodd" fill={`url(#sten-${uid})`} />
      {/* a stitched line just inside the doorway */}
      <path d={archPath(x0, x1, springY, bottom, -14)} className="f-none s-p3" strokeWidth="2" strokeDasharray="10 6" />

      {/* tile border: aubergine rule, turquoise band with a dot row, inner scallops */}
      <path d={archPath(x0, x1, springY, bottom, band * 0.5 + 3)} className="f-none s-au" strokeWidth="3" />
      <path d={archPath(x0, x1, springY, bottom, band * 0.5 - 1)} className="f-none s-au" strokeWidth={band + 2} />
      <path d={archPath(x0, x1, springY, bottom, band * 0.5)} className="f-none s-tq" strokeWidth={band - 2} />
      <path d={archPath(x0, x1, springY, bottom, band * 0.5)} className="f-none s-p1" strokeWidth={band * 0.28} strokeDasharray={`0 ${band * 0.62}`} strokeLinecap="round" />
      <path d={archPath(x0, x1, springY, bottom, band * 0.5)} className="f-none s-gold" strokeWidth={band * 0.12} strokeDasharray={`0 ${band * 0.62}`} strokeDashoffset={band * 0.31} strokeLinecap="round" />
      <path d={archPath(x0, x1, springY, bottom, -2)} className="f-none s-p4" strokeWidth="8" strokeDasharray="0 10" strokeLinecap="round" />
      <path d={archPath(x0, x1, springY, bottom, band + 10)} className="f-none s-tq" strokeWidth="1.5" />
      <path d={archPath(x0, x1, springY, bottom, band + 16)} className="f-none s-au" strokeWidth="1" strokeDasharray="2 6" strokeLinecap="round" />

      {/* keystone star at the apex */}
      <StarTile x={mid} y={L.apexY - band * 0.5} R={band * 0.95} a="f-p5" b="f-p1" c="f-tq" line="s-au" />

      {/* spandrels: pomegranates and boteh in the upper corners */}
      <g className="mk-bob" style={{ animationDelay: '-1.2s' }}>
        <Pomegranate x={Math.max(34, x0 * 0.5 + 10)} y={Math.max(70, L.apexY + 30) + lift} r={Math.max(15, Math.min(L.wide ? 40 : 30, L.w * 0.045))} />
      </g>
      <Boteh x={Math.max(84, x0 * 0.5 + 64)} y={Math.max(78, L.apexY + 44) + lift} s={Math.max(26, Math.min(L.wide ? 70 : 56, L.w * 0.07))} rot={-24} />
      <g className="mk-bob" style={{ animationDelay: '-3s' }}>
        <PomegranateHalf x={Math.min(W - 34, W - x0 * 0.5 - 10)} y={Math.max(72, L.apexY + 34) + lift} r={Math.max(16, Math.min(L.wide ? 40 : 30, L.w * 0.045))} />
      </g>
      <Boteh x={Math.min(W - 84, W - x0 * 0.5 - 64)} y={Math.max(80, L.apexY + 46) + lift} s={Math.max(26, Math.min(L.wide ? 70 : 56, L.w * 0.07))} rot={204} outer="f-p5" inner="f-p2" />

      {/* wide screens: a tiled niche on each side wall */}
      {L.wide &&
        [sideW / 2, W - sideW / 2].map((cx, i) => {
          const nw = Math.min(sideW * 0.52, 190)
          const top = H * 0.36
          const nb = H * 0.86
          const sy = top + nw * 0.866
          const nx0 = cx - nw / 2
          const nx1 = cx + nw / 2
          return (
            <g key={i}>
              <path d={`${archPath(nx0, nx1, sy, nb)}Z`} fill={`url(#panel-${uid})`} />
              <path d={`${archPath(nx0, nx1, sy, nb)}Z`} className="f-none s-au" strokeWidth="5" strokeLinejoin="round" />
              <path d={`${archPath(nx0, nx1, sy, nb, 7)}`} className="f-none s-tq" strokeWidth="3" />
              <path d={`M${nx0 - 18} ${nb + 6}H${nx1 + 18}`} className="s-au" strokeWidth="8" strokeLinecap="round" />
              <path d={`M${nx0 - 12} ${nb + 14}H${nx1 + 12}`} className="s-tq" strokeWidth="3" strokeLinecap="round" />
            </g>
          )
        })}

      {/* wide screens: pennants swagged from the frieze toward the arch, kept clear of the logo at
          the top left (it owns about 340px at 1440 wide) and mirrored on the right. On most
          laptops the logo reaches the arch, so the swags only show on very wide screens. */}
      {L.wide && x0 - band - 24 - W * (340 / 1440) >= 120 && chain(W * (340 / 1440), x0 - band - 24, 34, 40, 26, 'wl')}
      {L.wide && x0 - band - 24 - W * (340 / 1440) >= 120 && chain(x1 + band + 24, W - W * (340 / 1440), 34, 40, 26, 'wr')}

      {/* truck-art frieze along the top: thick rule, thin rule, scallops with a dot each */}
      <rect x={-M} y={-M} width={W + 2 * M} height={M + 9} className="f-au" />
      <rect x={-M} y={13} width={W + 2 * M} height={2.5} className="f-tq" />
      <rect x={-M} y={19} width={W + 2 * M} height={3.5} className="f-au" />
      <rect x={-M} y={22.5} width={W + 2 * M} height={fr} fill={`url(#scal-${uid})`} />
      <path d={`M${-M} 4.5H${W + M}`} className="s-gold" strokeWidth="2" strokeDasharray="0 9" strokeLinecap="round" />
    </svg>
  )
}

/** Tulips and saz leaves in the bottom corners, closest to the viewer. */
function Foreground({ L }: { L: Layout }) {
  const s = Math.max(120, Math.min(260, L.H * 0.26, L.W * 0.36))
  const b = L.H + 10
  const plant = (x: number, flip: boolean, k: number) => (
    <g key={k}>
      <g className="mk-sway" style={{ animationDelay: `${-k * 0.9}s` }}>
        <Tulip x={x} y={b} s={s} petal="f-p5" flip={flip} />
      </g>
      <g className="mk-sway" style={{ animationDelay: `${-k * 0.9 - 2}s`, animationDuration: '6.1s' }}>
        <Tulip x={x + (flip ? -1 : 1) * s * 0.3} y={b} s={s * 0.74} petal="f-p4" flip={!flip} />
      </g>
      <g className="mk-sway" style={{ animationDelay: `${-k * 0.9 - 1}s`, animationDuration: '4.7s' }}>
        <Tulip x={x - (flip ? -1 : 1) * s * 0.22} y={b} s={s * 0.6} petal="f-au" flip={flip} />
      </g>
    </g>
  )
  return (
    <svg viewBox={`${-M} ${-M} ${L.W + 2 * M} ${L.H + 2 * M}`} aria-hidden="true">
      {plant(s * 0.22, false, 0)}
      {plant(L.W - s * 0.22, true, 1)}
    </svg>
  )
}

/** Layered courtyard behind the hero. Positioned absolute inset 0 inside the hero. */
export function HeroBackdrop({ px, py, className }: HeroBackdropProps) {
  const ref = useRef<HTMLDivElement>(null)
  const { w: W, h: H } = useSize(ref)
  const reduce = !!useReducedMotion()
  const hidden = useDocHidden()
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const L = useMemo(() => (W > 0 && H > 0 ? layoutFor(W, H) : null), [W, H])

  // Inside the doorway moves against the frame; the frame and tulips move with the pointer.
  const farX = useDepth(px, -22, reduce)
  const farY = useDepth(py, -12, reduce)
  const medX = useDepth(px, -14, reduce)
  const medY = useDepth(py, -8, reduce)
  const penX = useDepth(px, -6, reduce)
  const penY = useDepth(py, -4, reduce)
  const wallX = useDepth(px, 8, reduce)
  const wallY = useDepth(py, 5, reduce)
  const frontX = useDepth(px, 30, reduce)
  const frontY = useDepth(py, 14, reduce)
  const glowX = useTransform(px, (n) => (reduce ? 0 : n * W * 0.9))
  const glowY = useTransform(py, (n) => (reduce ? 0 : n * H * 0.9))

  return (
    <div ref={ref} className={`mk mk-hero${hidden ? ' mk-paused' : ''}${className ? ` ${className}` : ''}`} aria-hidden="true">
      {L && (
        <>
          <motion.div className="mk-layer" style={{ x: farX, y: farY }}>
            <FarWall L={L} uid={uid} />
            <motion.div className="mk-glow" style={{ x: glowX, y: glowY }} />
            <div className="mk-sweep" />
          </motion.div>
          <motion.div className="mk-layer" style={{ x: medX, y: medY }}>
            <Medallion L={L} />
          </motion.div>
          <motion.div className="mk-layer" style={{ x: penX, y: penY }}>
            <Pennants L={L} />
          </motion.div>
          <motion.div className="mk-layer" style={{ x: wallX, y: wallY }}>
            <NearWall L={L} uid={uid} />
          </motion.div>
          <motion.div className="mk-layer" style={{ x: frontX, y: frontY }}>
            <Foreground L={L} />
          </motion.div>
        </>
      )}
    </div>
  )
}
