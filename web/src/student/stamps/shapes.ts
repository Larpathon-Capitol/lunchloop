// Stamp outlines, each in a 100 by 100 box centered on 50,50, plus how wide a line of text
// can be inside each one. Every world draws the same outlines in its own colors.

export type ShapeId =
  | 'circle'
  | 'rosette'
  | 'burst'
  | 'postage'
  | 'hexagon'
  | 'ticket'
  | 'square'
  | 'shield'
  | 'arch'
  | 'octagon'
  | 'diamond'
  | 'star'

const f = (n: number) => n.toFixed(2)

/** A regular polygon with n corners at radius r, the first corner straight up (or rotated by `turn` degrees). */
function polygon(n: number, r: number, turn = 0) {
  let d = ''
  for (let i = 0; i < n; i++) {
    const a = ((i * 360) / n - 90 + turn) * (Math.PI / 180)
    d += `${i ? 'L' : 'M'}${f(50 + Math.cos(a) * r)} ${f(50 + Math.sin(a) * r)}`
  }
  return `${d}Z`
}

/** A star or burst: n points alternating between radius r1 (tips) and r0 (valleys). */
function burst(n: number, r0: number, r1: number) {
  let d = ''
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2
    const r = i % 2 ? r0 : r1
    d += `${i ? 'L' : 'M'}${f(50 + Math.cos(a) * r)} ${f(50 + Math.sin(a) * r)}`
  }
  return `${d}Z`
}

/** A ruffled rosette: n round bumps around a circle of radius r. */
function rosette(n: number, r: number, bump: number) {
  let d = ''
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2 - Math.PI / 2
    const a1 = ((i + 1) / n) * Math.PI * 2 - Math.PI / 2
    const x0 = 50 + Math.cos(a0) * r
    const y0 = 50 + Math.sin(a0) * r
    const x1 = 50 + Math.cos(a1) * r
    const y1 = 50 + Math.sin(a1) * r
    d += `${i ? '' : `M${f(x0)} ${f(y0)}`}A${bump} ${bump} 0 0 1 ${f(x1)} ${f(y1)}`
  }
  return `${d}Z`
}

/** A postage stamp: a rectangle whose edges are bitten by round perforations. */
function postage(x: number, y: number, w: number, h: number, hole: number) {
  const nx = Math.round(w / (hole * 3.2))
  const ny = Math.round(h / (hole * 3.2))
  let d = `M${f(x)} ${f(y)}`
  const edge = (fromX: number, fromY: number, dx: number, dy: number, n: number) => {
    const sx = dx / n
    const sy = dy / n
    let s = ''
    for (let i = 0; i < n; i++) {
      const cx = fromX + sx * (i + 0.5)
      const cy = fromY + sy * (i + 0.5)
      const ux = sx === 0 ? 0 : Math.sign(sx) * hole
      const uy = sy === 0 ? 0 : Math.sign(sy) * hole
      s += `L${f(cx - ux)} ${f(cy - uy)}A${hole} ${hole} 0 0 0 ${f(cx + ux)} ${f(cy + uy)}`
    }
    return `${s}L${f(fromX + dx)} ${f(fromY + dy)}`
  }
  d += edge(x, y, w, 0, nx)
  d += edge(x + w, y, 0, h, ny)
  d += edge(x + w, y + h, -w, 0, nx)
  d += edge(x, y + h, 0, -h, ny)
  return `${d}Z`
}

export const SHAPES: Record<ShapeId, { d: string; textWidth: number; textY?: number }> = {
  circle: { d: 'M50 4a46 46 0 1 1 0 92a46 46 0 1 1 0-92Z', textWidth: 64 },
  rosette: { d: rosette(18, 44, 8.6), textWidth: 60 },
  burst: { d: burst(16, 41, 48), textWidth: 60 },
  postage: { d: postage(10, 6, 80, 88, 3.4), textWidth: 62 },
  hexagon: { d: polygon(6, 48), textWidth: 62 },
  ticket: {
    d: 'M10 18h80a4 4 0 0 1 4 4v16a12 12 0 0 0 0 24v16a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4V62a12 12 0 0 0 0-24V22a4 4 0 0 1 4-4Z',
    textWidth: 66,
  },
  square: { d: 'M18 6h64a12 12 0 0 1 12 12v64a12 12 0 0 1-12 12H18A12 12 0 0 1 6 82V18A12 12 0 0 1 18 6Z', textWidth: 66 },
  shield: { d: 'M50 4l38 12v30c0 26-17 42-38 50C29 88 12 72 12 46V16Z', textWidth: 56, textY: 46 },
  arch: { d: 'M12 96V46a38 38 0 0 1 76 0v50Z', textWidth: 60, textY: 58 },
  octagon: { d: polygon(8, 48, 22.5), textWidth: 62 },
  diamond: { d: 'M50 3L97 50L50 97L3 50Z', textWidth: 50 },
  star: { d: burst(8, 36, 48), textWidth: 52 },
}

/** Split a label onto two lines at its middle space when it is long, and size it to fit. */
export function fitLabel(label: string, width: number, charWidth: number) {
  const words = label.split(' ')
  let lines = [label]
  if (label.length > 8 && words.length > 1) {
    let best = 1
    let bestLen = Infinity
    for (let i = 1; i < words.length; i++) {
      const len = Math.max(words.slice(0, i).join(' ').length, words.slice(i).join(' ').length)
      if (len < bestLen) {
        best = i
        bestLen = len
      }
    }
    lines = [words.slice(0, best).join(' '), words.slice(best).join(' ')]
  }
  const longest = Math.max(...lines.map((l) => l.length))
  const size = Math.min(lines.length > 1 ? 16 : 19, width / (longest * charWidth))
  return { lines, size }
}
