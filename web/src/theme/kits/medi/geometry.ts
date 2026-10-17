// Shape math for the courtyard world: the eight-point star, the pointed arch, the boteh,
// and the faint tile used on grounds. Everything returns plain SVG path strings.

const r2 = (n: number) => Math.round(n * 100) / 100

/** The 16 corners of an eight-point star (two squares, one turned 45deg), outer point first. */
export function starPoints(cx: number, cy: number, R: number, rot = 0): [number, number][] {
  // Where the two squares cross: R * cos45 / cos22.5.
  const r = R * 0.7654
  const pts: [number, number][] = []
  for (let i = 0; i < 16; i++) {
    const a = ((i * 22.5 - 90 + rot) * Math.PI) / 180
    const d = i % 2 === 0 ? R : r
    pts.push([r2(cx + d * Math.cos(a)), r2(cy + d * Math.sin(a))])
  }
  return pts
}

export function starPath(cx: number, cy: number, R: number, rot = 0): string {
  const p = starPoints(cx, cy, R, rot)
  return `M${p.map(([x, y]) => `${x} ${y}`).join('L')}Z`
}

/** The two overlapping squares as separate outlines, for line drawings that stroke in. */
export function squarePaths(cx: number, cy: number, R: number): [string, string] {
  const sq = (rot: number) => {
    const pts = [0, 1, 2, 3].map((i) => {
      const a = ((i * 90 - 90 + rot) * Math.PI) / 180
      return `${r2(cx + R * Math.cos(a))} ${r2(cy + R * Math.sin(a))}`
    })
    return `M${pts.join('L')}Z`
  }
  return [sq(0), sq(45)]
}

/** One point of the star as a kite (center, inner, outer, inner): the shards of the seal. */
export function starShards(cx: number, cy: number, R: number): string[] {
  const p = starPoints(cx, cy, R)
  const out: string[] = []
  for (let k = 0; k < 8; k++) {
    const o = p[k * 2]
    const a = p[(k * 2 + 15) % 16]
    const b = p[k * 2 + 1]
    out.push(`M${cx} ${cy}L${a[0]} ${a[1]}L${o[0]} ${o[1]}L${b[0]} ${b[1]}Z`)
  }
  return out
}

/**
 * Pointed arch opening: straight jambs up to the springing line, then two arcs, each
 * centered on the opposite springer (an equilateral arch). Open at the bottom edge.
 * A nonzero `d` draws the line offset outward (positive) or inward (negative) around the
 * same arc centers, so tile bands stay concentric.
 */
export function archPath(x0: number, x1: number, springY: number, bottomY: number, d = 0): string {
  const w = x1 - x0
  const R = w + d
  const mid = (x0 + x1) / 2
  const apexY = springY - Math.sqrt(R * R - (w / 2) * (w / 2))
  const a = x0 - d
  const b = x1 + d
  return `M${r2(a)} ${r2(bottomY)}L${r2(a)} ${r2(springY)}A${r2(R)} ${r2(R)} 0 0 1 ${r2(mid)} ${r2(apexY)}A${r2(R)} ${r2(R)} 0 0 1 ${r2(b)} ${r2(springY)}L${r2(b)} ${r2(bottomY)}`
}

/** Half width of an equilateral arch opening at height y (0 above the apex). */
export function archHalfWidth(x0: number, x1: number, springY: number, y: number): number {
  const w = x1 - x0
  if (y >= springY) return w / 2
  const dy = springY - y
  if (dy >= w * 0.866) return 0
  return Math.sqrt(w * w - dy * dy) - w / 2
}

/** Boteh (paisley) pointing up, its curled tip bending right. Drawn around 0,0, about 1 unit tall. */
export function botehPath(s: number): string {
  const p = (x: number, y: number) => `${r2(x * s)} ${r2(y * s)}`
  return `M${p(0, 0.5)}C${p(-0.42, 0.5)} ${p(-0.48, 0.02)} ${p(-0.22, -0.2)}C${p(-0.04, -0.36)} ${p(0.06, -0.42)} ${p(0.18, -0.5)}C${p(0.12, -0.38)} ${p(0.1, -0.3)} ${p(0.22, -0.18)}C${p(0.44, 0.04)} ${p(0.42, 0.5)} ${p(0, 0.5)}Z`
}

/** Iznik tulip: three pointed petals on a stem end at 0,0, flower upward, about 1 unit tall. */
export function tulipPetals(s: number): string[] {
  const p = (x: number, y: number) => `${r2(x * s)} ${r2(y * s)}`
  return [
    // left petal, flaring out to a sharp tip
    `M${p(0, 0)}C${p(-0.3, -0.02)} ${p(-0.34, -0.38)} ${p(-0.3, -0.62)}C${p(-0.18, -0.48)} ${p(-0.1, -0.3)} ${p(0, -0.22)}Z`,
    // right petal
    `M${p(0, 0)}C${p(0.3, -0.02)} ${p(0.34, -0.38)} ${p(0.3, -0.62)}C${p(0.18, -0.48)} ${p(0.1, -0.3)} ${p(0, -0.22)}Z`,
    // center petal, tall and narrow
    `M${p(0, -0.04)}C${p(-0.16, -0.2)} ${p(-0.12, -0.6)} ${p(0, -0.78)}C${p(0.12, -0.6)} ${p(0.16, -0.2)} ${p(0, -0.04)}Z`,
  ]
}

/** Saz leaf: a long curved blade with a serrated outer edge, base at 0,0 curving up and right. */
export function sazLeaf(len: number): string {
  const p = (x: number, y: number) => `${r2(x * len)} ${r2(y * len)}`
  // outer edge in small teeth, inner edge one smooth curve back
  const teeth: string[] = []
  const n = 6
  for (let i = 1; i <= n; i++) {
    const t = i / n
    const x = 0.08 + t * 0.5 - t * t * 0.1
    const y = -t * 0.95
    const w = 0.1 * Math.sin(Math.PI * t) + 0.01
    teeth.push(`L${p(x - w * 1.2, y + 0.05)}L${p(x - w * 0.7, y)}`)
  }
  return `M${p(0, 0)}${teeth.join('')}L${p(0.48, -0.98)}C${p(0.38, -0.6)} ${p(0.22, -0.2)} ${p(0, 0)}Z`
}

/** Faint tile for grounds: an eight-point star outline with diamonds where four tiles meet. */
export function groundTile(): { image: string; size: string } {
  const S = 56
  const c = S / 2
  const star = starPath(c, c, 15)
  // corner diamond, shared by four tiles
  const dia = (x: number, y: number) => `M${x} ${y - 6}L${x + 6} ${y}L${x} ${y + 6}L${x - 6} ${y}Z`
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='${S}' height='${S}' viewBox='0 0 ${S} ${S}'>` +
    `<g fill='none' stroke='#FFB3C6' stroke-width='1.2' stroke-linejoin='round'>` +
    `<path d='${star}'/>` +
    `<path d='${dia(0, 0)}${dia(S, 0)}${dia(0, S)}${dia(S, S)}'/>` +
    `<path d='M${c} ${c - 15}L${c} 0M${c} ${c + 15}L${c} ${S}M${c - 15} ${c}L0 ${c}M${c + 15} ${c}L${S} ${c}' stroke-width='0.8'/>` +
    `</g>` +
    `<circle cx='${c}' cy='${c}' r='2' fill='#FF8FAB'/>` +
    `</svg>`
  return { image: `url("data:image/svg+xml,${encodeURIComponent(svg)}")`, size: `${S}px ${S}px` }
}
