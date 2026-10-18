// Small line drawings for the game backdrop, written as SVG strings so they can be packed into
// a CSS background tile. Every motif is drawn around (0, 0), roughly 64 px across, and takes
// its colors from a Palette so the same drawing works in all three worlds.

export interface Palette {
  /** Line color for outlines. */
  line: string
  /** Soft fill for shapes. */
  fill: string
  /** The world's first accent, as a pale tint. */
  a: string
  /** The world's second accent, as a pale tint. */
  b: string
  /** Pale leaf green. */
  leaf: string
  /** The page ground, used to punch holes in filled shapes. */
  ground: string
}

const W = 3

/** Places a motif: move, turn, scale. */
export function at(x: number, y: number, body: string, rot = 0, scale = 1): string {
  return `<g transform='translate(${x} ${y}) rotate(${rot}) scale(${scale})'>${body}</g>`
}

function stroke(p: Palette, w = W) {
  return `fill='none' stroke='${p.line}' stroke-width='${w}' stroke-linecap='round' stroke-linejoin='round'`
}

function polygon(n: number, r: number, offset = 0): string {
  const pts: string[] = []
  for (let i = 0; i < n; i++) {
    const t = offset + (i * Math.PI * 2) / n
    pts.push(`${(Math.cos(t) * r).toFixed(2)},${(Math.sin(t) * r).toFixed(2)}`)
  }
  return pts.join(' ')
}

function star(points: number, outer: number, inner: number): string {
  const pts: string[] = []
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner
    const t = -Math.PI / 2 + (i * Math.PI) / points
    pts.push(`${(Math.cos(t) * r).toFixed(2)},${(Math.sin(t) * r).toFixed(2)}`)
  }
  return pts.join(' ')
}

/* ---------- Shared bits ---------- */

/** Four-point sparkle, filled. */
export const sparkle = (c: string, r = 9) =>
  `<path d='M0 ${-r}C${r * 0.12} ${-r * 0.12} ${r * 0.12} ${-r * 0.12} ${r} 0C${r * 0.12} ${r * 0.12} ${r * 0.12} ${r * 0.12} 0 ${r}C${-r * 0.12} ${r * 0.12} ${-r * 0.12} ${r * 0.12} ${-r} 0C${-r * 0.12} ${-r * 0.12} ${-r * 0.12} ${-r * 0.12} 0 ${-r}Z' fill='${c}'/>`

export const dot = (c: string, r = 3) => `<circle r='${r}' fill='${c}'/>`

/* ---------- Tray: cutlery and a tablecloth ---------- */

export const fork = (p: Palette) =>
  `<g ${stroke(p)}><path d='M0 30V-4M-9 -30V-15Q-9 -4 0 -4Q9 -4 9 -15V-30M-3 -30V-15M3 -30V-15'/></g>`

export const spoon = (p: Palette) =>
  `<ellipse cx='0' cy='-17' rx='9' ry='13' fill='${p.fill}' stroke='${p.line}' stroke-width='${W}'/><path d='M0 -4V30' ${stroke(p)}/>`

export const knife = (p: Palette) =>
  `<path d='M-2 -31Q10 -22 6 -1H-2Z' fill='${p.fill}' stroke='${p.line}' stroke-width='${W}' stroke-linejoin='round'/><path d='M1 -1V30' ${stroke(p, 5)}/>`

/** A plate seen from above. `center` is drawn in the middle (a world ornament, scaled down). */
export const plate = (p: Palette, center = '') =>
  `<circle r='30' fill='${p.ground}' stroke='${p.line}' stroke-width='${W}'/><circle r='21' fill='none' stroke='${p.line}' stroke-width='1.6' stroke-dasharray='0.1 5' stroke-linecap='round'/>${center ? at(0, 0, center, 0, 0.42) : ''}`

/** A square of gingham tablecloth. */
export const gingham = (p: Palette, c: string) => {
  const s = 11
  let cells = ''
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 4; j++) {
      if ((i + j) % 2 === 0) cells += `<rect x='${-22 + i * s}' y='${-22 + j * s}' width='${s}' height='${s}' fill='${c}'/>`
    }
  return `${cells}<rect x='-22' y='-22' width='44' height='44' fill='none' stroke='${p.line}' stroke-width='1.6'/>`
}

/* ---------- Vote: ballots and confetti ---------- */

export const ballot = (p: Palette, tick: string) =>
  `<rect x='-17' y='-23' width='34' height='46' rx='3' fill='${p.ground}' stroke='${p.line}' stroke-width='${W}'/><path d='M-9 -12H9M-9 -4H5' ${stroke(p, 2)}/><path d='M-8 8L-2 14L10 0' fill='none' stroke='${tick}' stroke-width='4' stroke-linecap='round' stroke-linejoin='round'/>`

export const ballotBox = (p: Palette, c: string) =>
  `<rect x='-11' y='-30' width='22' height='26' rx='2' fill='${p.ground}' stroke='${p.line}' stroke-width='${W}' transform='rotate(-8)'/><rect x='-25' y='-6' width='50' height='34' rx='4' fill='${c}' stroke='${p.line}' stroke-width='${W}'/><path d='M-12 2H12' ${stroke(p, 4)}/>`

export const tick = (c: string) => `<path d='M-10 0L-3 8L11 -9' fill='none' stroke='${c}' stroke-width='5' stroke-linecap='round' stroke-linejoin='round'/>`

export const confetti = (p: Palette) =>
  [
    at(-14, -8, `<rect x='-5' y='-2' width='10' height='4' rx='1' fill='${p.a}'/>`, 30),
    at(10, -14, `<rect x='-5' y='-2' width='10' height='4' rx='1' fill='${p.b}'/>`, -40),
    at(4, 10, `<rect x='-5' y='-2' width='10' height='4' rx='1' fill='${p.leaf}'/>`, 70),
    at(-8, 14, dot(p.line, 2.6)),
    at(16, 4, dot(p.a, 2.6)),
    at(-18, 6, `<path d='M-4 0q2 -4 4 0t4 0' ${stroke(p, 2)}/>`, 20),
  ].join('')

/* ---------- Call it: stars, moon, a crystal ball ---------- */

export const star5 = (c: string, r = 14) => `<polygon points='${star(5, r, r * 0.45)}' fill='${c}'/>`

export const moon = (p: Palette, c: string) =>
  `<path d='M8 -22A23 23 0 1 0 8 22A17 17 0 1 1 8 -22Z' fill='${c}' stroke='${p.line}' stroke-width='${W}' stroke-linejoin='round'/>`

export const crystal = (p: Palette, c: string) =>
  `<circle cy='-6' r='19' fill='${c}' stroke='${p.line}' stroke-width='${W}'/><path d='M-9 -14Q-6 -20 1 -21' ${stroke(p, 2.2)}/><path d='M-15 12H15L19 24H-19Z' fill='${p.ground}' stroke='${p.line}' stroke-width='${W}' stroke-linejoin='round'/>`

/** A shooting star: a filled star with three trailing streaks. */
export const comet = (p: Palette, c: string) =>
  `<path d='M-30 22L-6 6M-26 8L-8 0M-18 30L-2 12' ${stroke(p, 2.4)}/><polygon points='${star(5, 15, 7)}' transform='translate(8 -6) rotate(18)' fill='${c}' stroke='${p.line}' stroke-width='2' stroke-linejoin='round'/>`

/* ---------- Stamps: a passport page ---------- */

/** A postage stamp with a perforated edge; `inner` is drawn small in the middle. */
export const postage = (p: Palette, c: string, inner = '') =>
  `<rect x='-21' y='-27' width='42' height='54' fill='${p.ground}' stroke='${p.line}' stroke-width='4.5' stroke-dasharray='0.1 6.2' stroke-linecap='round'/><rect x='-15' y='-21' width='30' height='42' fill='${c}' stroke='${p.line}' stroke-width='1.6'/>${inner ? at(0, -2, inner, 0, 0.36) : ''}`

/** A round postmark with wavy cancel lines trailing off to the right. */
export const postmark = (p: Palette) =>
  `<circle r='21' fill='none' stroke='${p.line}' stroke-width='${W}'/><circle r='15' fill='none' stroke='${p.line}' stroke-width='1.4' stroke-dasharray='3 3'/><path d='M24 -10q5 -4 10 0t10 0t10 0M24 0q5 -4 10 0t10 0t10 0M24 10q5 -4 10 0t10 0t10 0' ${stroke(p, 2)}/>`

/** A passport visa block: a rounded box with ruled lines. */
export const visa = (p: Palette, c: string) =>
  `<rect x='-28' y='-18' width='56' height='36' rx='6' fill='none' stroke='${c}' stroke-width='3'/><path d='M-20 -7H8M-20 2H16M-20 11H0' ${stroke(p, 2)}/>`

/* ---------- Americas: talavera, papel picado ---------- */

export const talavera = (p: Palette) => {
  const petals = [0, 90, 180, 270].map((r) => `<ellipse cx='0' cy='-9' rx='5' ry='9' fill='${p.a}' transform='rotate(${r + 45})'/>`).join('')
  const corners = [
    [-24, -24, 0],
    [24, -24, 90],
    [24, 24, 180],
    [-24, 24, 270],
  ]
    .map(([x, y, r]) => `<path d='M0 0H10A10 10 0 0 1 0 10Z' fill='${p.b}' transform='translate(${x} ${y}) rotate(${r})'/>`)
    .join('')
  return `<rect x='-24' y='-24' width='48' height='48' rx='2' fill='${p.ground}'/>${corners}${petals}<circle r='4.5' fill='${p.b}' stroke='${p.line}' stroke-width='1.4'/><rect x='-24' y='-24' width='48' height='48' rx='2' fill='none' stroke='${p.line}' stroke-width='${W}'/>`
}

/** One papel picado flag on its string, with cut-out holes. */
export const picado = (p: Palette, c: string) => {
  let zig = 'M-22 -24H22V18'
  for (let i = 0; i < 4; i++) zig += `l-5.5 7l-5.5 -7`
  zig += 'Z'
  return `<path d='M-30 -24H30' ${stroke(p, 1.6)}/><path d='${zig}' fill='${c}'/><path d='M0 -14L7 -4L0 6L-7 -4Z' fill='${p.ground}'/><circle cx='-12' cy='-12' r='2.6' fill='${p.ground}'/><circle cx='12' cy='-12' r='2.6' fill='${p.ground}'/><circle cx='-12' cy='5' r='2.6' fill='${p.ground}'/><circle cx='12' cy='5' r='2.6' fill='${p.ground}'/>`
}

/* ---------- East Asia: seigaiha, asanoha, sakura ---------- */

export const seigaiha = (p: Palette) => {
  const scale = (x: number, y: number) =>
    `<circle cx='${x}' cy='${y}' r='14' fill='${p.ground}'/>` +
    [13, 9, 5].map((r) => `<circle cx='${x}' cy='${y}' r='${r}' fill='none' stroke='${p.a}' stroke-width='1.8'/>`).join('')
  return [scale(-14, -6), scale(14, -6), scale(0, 6), scale(-28, 6), scale(28, 6)].join('') + `<rect x='-42' y='6' width='84' height='14' fill='${p.ground}'/>`
}

export const asanoha = (p: Palette) => {
  const hex = polygon(6, 24, -Math.PI / 2)
  const verts = hex.split(' ').map((s) => s.split(',').map(Number))
  let lines = ''
  verts.forEach(([x, y], i) => {
    lines += `M0 0L${x} ${y}`
    const [nx, ny] = verts[(i + 1) % 6]
    // Each wedge gets three lines to its centroid: the hemp-leaf star.
    const cx = (x + nx) / 3
    const cy = (y + ny) / 3
    lines += `M${cx.toFixed(2)} ${cy.toFixed(2)}L0 0M${cx.toFixed(2)} ${cy.toFixed(2)}L${x} ${y}M${cx.toFixed(2)} ${cy.toFixed(2)}L${nx} ${ny}`
  })
  return `<polygon points='${hex}' fill='${p.ground}' stroke='${p.line}' stroke-width='${W}' stroke-linejoin='round'/><path d='${lines}' fill='none' stroke='${p.a}' stroke-width='1.6' stroke-linecap='round'/>`
}

export const sakura = (p: Palette) => {
  const petal = `<path d='M0 -2C-9 -7 -10 -18 -4 -23L0 -19L4 -23C10 -18 9 -7 0 -2Z' fill='${p.b}' stroke='${p.line}' stroke-width='1.4' stroke-linejoin='round'/>`
  return [0, 72, 144, 216, 288].map((r) => `<g transform='rotate(${r})'>${petal}</g>`).join('') + `<circle r='4' fill='${p.ground}' stroke='${p.line}' stroke-width='1.4'/>`
}

/* ---------- Mediterranean: zellige, arches, olives ---------- */

export const zellige = (p: Palette) =>
  `<polygon points='${star(8, 26, 26 * 0.7654)}' fill='${p.a}' stroke='${p.line}' stroke-width='${W}' stroke-linejoin='round'/><polygon points='${polygon(8, 12, Math.PI / 8)}' fill='${p.ground}' stroke='${p.line}' stroke-width='1.6'/><circle r='4' fill='${p.b}'/>`

export const arch = (p: Palette) =>
  `<path d='M-20 30V-2Q-20 -28 0 -34Q20 -28 20 -2V30Z' fill='${p.ground}' stroke='${p.line}' stroke-width='${W}' stroke-linejoin='round'/><path d='M-12 30V0Q-12 -18 0 -23Q12 -18 12 0V30' fill='${p.a}'/><path d='M-26 30H26' ${stroke(p)}/>`

export const olive = (p: Palette) => {
  const leaf = (x: number, y: number, r: number) => `<ellipse cx='${x}' cy='${y}' rx='3.6' ry='10' fill='${p.leaf}' stroke='${p.line}' stroke-width='1.2' transform='rotate(${r} ${x} ${y})'/>`
  return `<path d='M-26 22Q-2 6 26 -22' ${stroke(p, 2)}/>${leaf(-14, 6, -95)}${leaf(-8, 20, -10)}${leaf(4, -6, -85)}${leaf(10, 6, 5)}${leaf(18, -20, -70)}<ellipse cx='-2' cy='14' rx='5' ry='6.5' fill='${p.b}' stroke='${p.line}' stroke-width='1.2' transform='rotate(-30 -2 14)'/><ellipse cx='16' cy='-6' rx='5' ry='6.5' fill='${p.b}' stroke='${p.line}' stroke-width='1.2' transform='rotate(-30 16 -6)'/>`
}
