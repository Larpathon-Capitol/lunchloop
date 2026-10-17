// Drawing pieces shared by the kit: the notched sakura blossom, buds, leaves and a branch
// built from tapered strokes that can draw itself in.
import { motion } from 'framer-motion'
import { useId, type CSSProperties } from 'react'
import { brush, brushEase, C, f, jit, petalPath } from './paint'

/** A five-petal cherry blossom seen from the front, two-tone, with stamens. */
export function Blossom({ r, seed = 0, tint = C.pink3, deep = C.pink4, heart = C.pink5 }: {
  r: number
  seed?: number
  tint?: string
  deep?: string
  heart?: string
}) {
  const outer = petalPath(r)
  const inner = petalPath(r * 0.5)
  return (
    <g>
      {[0, 72, 144, 216, 288].map((a, j) => {
        const rot = a + 6 * Math.sin(seed * 3 + j * 2.1)
        const s = jit(seed * 5 + j, 0.07)
        return (
          <g key={j} transform={`rotate(${f(rot)}) scale(${f(s * 100) / 100})`}>
            <path d={outer} fill={tint} />
            <path d={inner} fill={deep} opacity={0.75} />
          </g>
        )
      })}
      <g stroke={heart} strokeWidth={Math.max(0.6, r * 0.05)} strokeLinecap="round">
        {Array.from({ length: 8 }, (_, j) => {
          const a = ((j * 45 + seed * 17) * Math.PI) / 180
          const len = r * 0.42 * jit(seed + j * 3, 0.2)
          return <line key={j} x1={0} y1={0} x2={f(Math.cos(a) * len)} y2={f(Math.sin(a) * len)} />
        })}
      </g>
      <g fill={heart}>
        {Array.from({ length: 8 }, (_, j) => {
          const a = ((j * 45 + seed * 17) * Math.PI) / 180
          const len = r * 0.42 * jit(seed + j * 3, 0.2)
          return <circle key={j} cx={f(Math.cos(a) * len)} cy={f(Math.sin(a) * len)} r={f(Math.max(0.7, r * 0.07))} />
        })}
        <circle r={f(r * 0.16)} />
      </g>
    </g>
  )
}

/** A closed bud with a green cup, pointing up from the origin. */
export function Bud({ r }: { r: number }) {
  return (
    <g>
      <path d={`M0 ${-r * 1.5}C${r * 0.9} ${-r * 0.9} ${r * 0.8} ${-r * 0.1} 0 0C${-r * 0.8} ${-r * 0.1} ${-r * 0.9} ${-r * 0.9} 0 ${-r * 1.5}Z`} fill={C.pink4} />
      <path d={`M0 ${-r * 1.5}C${r * 0.3} ${-r * 1} ${r * 0.3} ${-r * 0.5} 0 0`} fill="none" stroke={C.pink5} strokeWidth={r * 0.14} strokeLinecap="round" opacity={0.7} />
      <path d={`M${-r * 0.62} ${-r * 0.42}Q0 ${r * 0.2} ${r * 0.62} ${-r * 0.42}Q${r * 0.3} ${r * 0.4} 0 ${r * 0.5}Q${-r * 0.3} ${r * 0.4} ${-r * 0.62} ${-r * 0.42}Z`} fill={C.leaf} />
    </g>
  )
}

/** A young leaf pointing up from the origin, with a midrib. */
export function Leaf({ r }: { r: number }) {
  return (
    <g>
      <path d={`M0 0C${r * 0.55} ${-r * 0.3} ${r * 0.45} ${-r * 0.85} 0 ${-r}C${-r * 0.45} ${-r * 0.85} ${-r * 0.55} ${-r * 0.3} 0 0Z`} fill={C.leaf} />
      <path d={`M0 ${-r * 0.05}L0 ${-r * 0.8}`} stroke={C.leafDeep} strokeWidth={Math.max(0.6, r * 0.05)} strokeLinecap="round" opacity={0.55} />
    </g>
  )
}

// x0, y0, x1, y1, start width, end width, bend
export type Stroke = readonly [number, number, number, number, number, number, number]
// x, y, size, rotation, kind (0 blossom, 1 bud, 2 leaf), appears after stroke n
export type Bloom = readonly [number, number, number, number, 0 | 1 | 2, number]

export interface BranchArt {
  box: string
  strokes: readonly Stroke[]
  blooms: readonly Bloom[]
  /** Multiplies every flower and leaf size. */
  bloomScale?: number
  /** Multiplies every stroke width. */
  weight?: number
  /** Petal colors, for grounds where the default pinks would vanish. */
  tint?: string
  deep?: string
}

/**
 * A branch drawn from tapered strokes with blossoms, buds and leaves on it.
 * When grow is true the strokes draw in along their length and the flowers pop open after.
 */
export function Branch({ art, grow = false, bark = C.ink, delay = 0, className, style }: {
  art: BranchArt
  grow?: boolean
  bark?: string
  delay?: number
  className?: string
  style?: CSSProperties
}) {
  const id = 'kab' + useId().replace(/[^a-zA-Z0-9]/g, '')
  // Each stroke starts when the stroke it grows from is mostly done.
  const starts: number[] = []
  art.strokes.forEach(([x0, y0], i) => {
    let from = -1
    let best = 1e9
    for (let j = 0; j < i; j++) {
      const s = art.strokes[j]
      const d = Math.min(Math.hypot(s[0] - x0, s[1] - y0), Math.hypot(s[2] - x0, s[3] - y0))
      if (d < best) {
        best = d
        from = j
      }
    }
    starts.push(from < 0 ? delay : starts[from] + 0.22)
  })
  const ends = art.strokes.map(([x0, y0, x1, y1], i) => starts[i] + 0.35 + Math.hypot(x1 - x0, y1 - y0) / 700)

  return (
    <svg viewBox={art.box} className={className} style={{ overflow: 'visible', ...style }} aria-hidden="true" focusable="false">
      <g fill={bark}>
        {art.strokes.map(([x0, y0, x1, y1, sw0, sw1, bend], i) => {
          const w0 = sw0 * (art.weight ?? 1)
          const w1 = sw1 * (art.weight ?? 1)
          const L = Math.hypot(x1 - x0, y1 - y0)
          const deg = f((Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI)
          return (
            <g key={i} transform={`translate(${x0} ${y0}) rotate(${deg})`}>
              {grow && (
                <mask id={`${id}m${i}`} maskUnits="userSpaceOnUse" x={-40} y={-40} width={L + 80} height={80}>
                  <motion.path
                    d={`M${-w0} 0Q${f(L / 2)} ${2 * bend} ${f(L + 4)} 0`}
                    fill="none"
                    stroke="#fff"
                    strokeWidth={w0 * 1.6 + 10}
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ delay: starts[i], duration: 0.35 + L / 700, ease: brushEase }}
                  />
                </mask>
              )}
              <path d={brush(L, w0, w1, bend)} mask={grow ? `url(#${id}m${i})` : undefined} />
            </g>
          )
        })}
      </g>
      {art.blooms.map(([x, y, size, rot, kind, after], i) => {
        const r = size * (art.bloomScale ?? 1)
        return (
        <g key={i} transform={`translate(${x} ${y}) rotate(${rot})`}>
          <motion.g
            initial={grow ? { scale: 0, rotate: -40 } : false}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: (ends[after] ?? delay) + 0.05 * i, type: 'spring', stiffness: 380, damping: 16, mass: 0.8 }}
          >
            {kind === 0 ? <Blossom r={r} seed={i} tint={art.tint} deep={art.deep} /> : kind === 1 ? <Bud r={r} /> : <Leaf r={r} />}
          </motion.g>
        </g>
        )
      })}
    </svg>
  )
}
