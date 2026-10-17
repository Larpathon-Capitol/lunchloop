// Reusable courtyard motifs as SVG groups: pomegranate, Iznik tulip, boteh, star medallion.
// Fills use the .f-* and .s-* classes from medi.css, so they must sit inside a .mk root.
import type { SVGProps } from 'react'
import { botehPath, sazLeaf, starPath, tulipPetals } from './geometry'

type G = SVGProps<SVGGElement>

/** Whole pomegranate with its five-point crown. Center at x,y, radius r. */
export function Pomegranate({ x, y, r, ...rest }: { x: number; y: number; r: number } & G) {
  const c = r * 0.36
  const crown = `M${-c} ${-r * 0.86}L${-c * 1.15} ${-r * 1.3}L${-c * 0.5} ${-r * 1.06}L0 ${-r * 1.38}L${c * 0.5} ${-r * 1.06}L${c * 1.15} ${-r * 1.3}L${c} ${-r * 0.86}Z`
  return (
    <g transform={`translate(${x} ${y})`} {...rest}>
      <path d={crown} className="f-au" />
      <circle r={r} className="f-p5 s-au" strokeWidth={r * 0.08} />
      <path d={`M${-r * 0.62} ${-r * 0.2}A${r * 0.66} ${r * 0.66} 0 0 1 ${-r * 0.1} ${-r * 0.68}`} className="f-none s-p2" strokeWidth={r * 0.13} strokeLinecap="round" />
      <circle cx={-r * 0.66} cy={r * 0.02} r={r * 0.06} className="f-p2" />
    </g>
  )
}

/** A pomegranate cut in half, face on: rind ring, pale pith, seeds in pink-5. */
export function PomegranateHalf({ x, y, r, ...rest }: { x: number; y: number; r: number } & G) {
  const seeds: [number, number][] = []
  for (let ring = 1; ring <= 3; ring++) {
    const n = ring * 6
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + ring * 0.4
      const d = ring * r * 0.22
      seeds.push([Math.cos(a) * d, Math.sin(a) * d])
    }
  }
  return (
    <g transform={`translate(${x} ${y})`} {...rest}>
      <circle r={r} className="f-p4 s-au" strokeWidth={r * 0.07} />
      <circle r={r * 0.84} className="f-sf" />
      {seeds.map(([sx, sy], i) => (
        <ellipse key={i} cx={sx} cy={sy} rx={r * 0.085} ry={r * 0.1} transform={`rotate(${(i * 37) % 180} ${sx} ${sy})`} className="f-p5" />
      ))}
      <path d={`M0 ${-r * 0.8}V${r * 0.8}M${-r * 0.8} 0H${r * 0.8}`} className="s-p3" strokeWidth={r * 0.05} />
    </g>
  )
}

/** Iznik tulip on a stem with a serrated saz leaf. Base of the stem at x,y; about s tall. */
export function Tulip({ x, y, s, petal = 'f-p5', flip = false, ...rest }: { x: number; y: number; s: number; petal?: string; flip?: boolean } & G) {
  const petals = tulipPetals(s * 0.42)
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -1 : 1} 1)`} {...rest}>
      <path d={`M0 0C${s * 0.04} ${-s * 0.25} ${-s * 0.06} ${-s * 0.42} 0 ${-s * 0.6}`} className="f-none s-leafd" strokeWidth={Math.max(1.5, s * 0.025)} strokeLinecap="round" />
      <path d={sazLeaf(s * 0.5)} transform={`translate(${s * 0.01} ${-s * 0.04}) rotate(18)`} className="f-leaf s-leafd" strokeWidth={Math.max(1, s * 0.012)} strokeLinejoin="round" />
      <path d={sazLeaf(s * 0.38)} transform={`translate(${-s * 0.01} ${-s * 0.1}) scale(-1 1) rotate(10)`} className="f-leafd" />
      <g transform={`translate(0 ${-s * 0.58})`}>
        <path d={petals[2]} className={`${petal} s-au`} strokeWidth={Math.max(1, s * 0.014)} strokeLinejoin="round" />
        <path d={petals[0]} className={`${petal} s-au`} strokeWidth={Math.max(1, s * 0.014)} strokeLinejoin="round" />
        <path d={petals[1]} className={`${petal} s-au`} strokeWidth={Math.max(1, s * 0.014)} strokeLinejoin="round" />
        <path d={`M0 ${-s * 0.06}L0 ${-s * 0.24}`} className="s-au" strokeWidth={Math.max(1, s * 0.012)} strokeLinecap="round" />
      </g>
    </g>
  )
}

/** Boteh with a smaller boteh nested inside and a row of dots along its back. */
export function Boteh({ x, y, s, rot = 0, outer = 'f-tq', inner = 'f-p3', ...rest }: { x: number; y: number; s: number; rot?: number; outer?: string; inner?: string } & G) {
  const dots = [0.15, 0.32, 0.5, 0.68].map((t) => {
    const a = Math.PI * (0.55 + t * 0.9)
    return [Math.cos(a) * s * 0.52, Math.sin(a) * s * 0.36 + s * 0.12] as const
  })
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`} {...rest}>
      <path d={botehPath(s)} className={`${outer} s-au`} strokeWidth={Math.max(1, s * 0.03)} strokeLinejoin="round" />
      <path d={botehPath(s * 0.55)} transform={`translate(${-s * 0.02} ${s * 0.18})`} className={inner} />
      <circle cx={-s * 0.03} cy={s * 0.3} r={s * 0.05} className="f-au" />
      {dots.map(([dx, dy], i) => (
        <circle key={i} cx={dx} cy={dy} r={s * 0.035} className="f-au" />
      ))}
    </g>
  )
}

/** Eight-point star tile: star, inner star turned 22.5deg, a dot. */
export function StarTile({ x, y, R, a = 'f-tq', b = 'f-p3', c = 'f-au', line = 's-au', ...rest }: { x: number; y: number; R: number; a?: string; b?: string; c?: string; line?: string } & G) {
  return (
    <g {...rest}>
      <path d={starPath(x, y, R)} className={`${a} ${line}`} strokeWidth={Math.max(0.8, R * 0.05)} strokeLinejoin="round" />
      <path d={starPath(x, y, R * 0.58, 22.5)} className={b} />
      <circle cx={x} cy={y} r={R * 0.2} className={c} />
    </g>
  )
}
