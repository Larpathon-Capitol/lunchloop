// Procedural geometry and small canvas textures for Lafa, the shawarma wrap.
// The body is a rolled flatbread: a tapered tube whose outer layer spirals up and ends in a
// raised seam. A sheet of printed paper wraps the lower half, cut on a slant, with its end
// corner folded over. Everything is built once by the model and disposed when it unmounts.
import * as THREE from 'three'

const TAU = Math.PI * 2

/** Wrap an angle into [0, 2PI). */
function wrapAngle(a: number): number {
  return ((a % TAU) + TAU) % TAU
}

/** Bottom of the bread tube (hidden inside the paper). */
const BREAD_BOTTOM = 0.12
/** Average height of the open top of the roll. */
const RIM_Y = 0.835
/** Thickness of the bread wall seen at the open top. */
const BREAD_WALL = 0.034

/** Radius of the bread roll at height y, before the spiral: tapers toward the bottom and flares a little at the top. */
export function breadRadius(y: number): number {
  const t = THREE.MathUtils.clamp(y / RIM_Y, 0, 1)
  // The bottom end narrows like a folded wrap end, not a cup base.
  const tuck = 0.07 * (1 - THREE.MathUtils.smoothstep(y, 0.0, 0.42))
  return 0.255 + 0.055 * t + 0.014 * Math.sin(Math.PI * t) + 0.018 * THREE.MathUtils.smoothstep(y, 0.66, 0.86) - tuck
}

/** Height of the open top at angle phi (0 is the front, +PI/2 the right side): a little lower at the front, softly wavy. */
export function rimHeight(phi: number): number {
  // The loose end of the outer layer rises into a soft corner just before the seam.
  const u = wrapAngle(phi - seamAngle(RIM_Y)) / TAU
  const corner = 0.045 * THREE.MathUtils.smoothstep(u, 0.6, 0.97) * (1 - THREE.MathUtils.smoothstep(u, 0.975, 1))
  return RIM_Y - 0.024 * Math.cos(phi) + 0.01 * Math.sin(3 * phi + 0.7) + corner
}

// The outer edge of the flatbread climbs around the roll as a helix: seam angle = A + K * y.
const SEAM_A = -2.9
const SEAM_K = 4.1
/** How far the outer layer stands proud of the one under it, right at the seam. */
const SEAM_STEP = 0.03

/**
 * A layer that wraps once around and ends in a rounded, slightly raised edge.
 * u runs 0 (just past the edge, on the layer underneath) to 1 (the edge itself).
 */
function layerOffset(u: number, step: number, edge: number): number {
  let o = step * u
  if (u > 1 - edge) {
    const q = (u - (1 - edge)) / edge
    o = step * (1 - edge) * Math.sqrt(Math.max(0, 1 - q * q))
  }
  const lip = (u - (1 - edge * 1.7)) / (edge * 0.7)
  return o + step * 0.22 * Math.exp(-lip * lip)
}

/** Seam angle at height y. */
export function seamAngle(y: number): number {
  return SEAM_A + SEAM_K * y
}

/** Extra radius from the rolled layers at angle phi and height y. */
export function spiralOffset(phi: number, y: number): number {
  return layerOffset(wrapAngle(phi - seamAngle(y)) / TAU, SEAM_STEP, 0.02)
}

// Paper: the top edge is a slanted plane cut (low on the left, high on the right). The sheet
// ends on the right of the face at PAPER_END with its corner folded down, and the layer
// underneath dips lower just past that end, so it reads as paper wrapped by hand.
const CUT_Y = 0.52
const CUT_TILT = 0.125
export const PAPER_END = 0.86
const FOLD_A = 0.3
const FOLD_B = 0.1
const DROP = 0.065
const DROP_W = 1.4
/** Gap between paper and bread. */
const PAPER_GAP = 0.011
/** Height the paper texture spans, so the canvas maps straight onto paper height. */
const PAPER_TEX_SPAN = 0.7

function planeCut(phi: number): number {
  return CUT_Y + CUT_TILT * Math.sin(phi)
}

const CORNER_Y = planeCut(PAPER_END)

/** Signed angle from a to b, in (-PI, PI]. */
function angleDiff(b: number, a: number): number {
  const d = wrapAngle(b - a)
  return d > Math.PI ? d - TAU : d
}

/** Height of the paper's top edge at angle phi, including the folded corner and the dip past the end. */
export function paperCut(phi: number): number {
  const plane = planeCut(phi)
  const d = angleDiff(phi, PAPER_END)
  if (d > 0 && d < DROP_W) return plane - DROP * (1 - THREE.MathUtils.smoothstep(d, 0, DROP_W))
  if (d <= 0 && d > -FOLD_A) {
    // Along the fold line from A (on the edge) down to B (on the sheet's end).
    const t = (d + FOLD_A) / FOLD_A
    const fold = planeCut(PAPER_END - FOLD_A) + (CORNER_Y - FOLD_B - planeCut(PAPER_END - FOLD_A)) * t
    return Math.min(plane, fold)
  }
  return plane
}

/** Angle where the paper sheet ends at height y: the end edge leans as it goes down. */
function paperEndAngle(y: number): number {
  return PAPER_END + (CORNER_Y - y) * 0.9
}

/** Bread surface offset: full spiral above the paper, eased flat a little way under it. */
function breadOffset(phi: number, y: number, cut: number): number {
  if (y >= cut) return spiralOffset(phi, y)
  return spiralOffset(phi, cut) * THREE.MathUtils.smoothstep(y, cut - 0.1, cut - 0.02)
}

/** Outer radius of the paper at angle phi and height y (wall part, above the foot). */
export function paperRadius(phi: number, y: number): number {
  const cut = paperCut(phi)
  const hug = spiralOffset(phi, cut) * THREE.MathUtils.smoothstep(y, cut - 0.14, cut - 0.06)
  const sheet = layerOffset(wrapAngle(phi - paperEndAngle(y)) / TAU, 0.006, 0.03) * THREE.MathUtils.smoothstep(y, 0.1, 0.2)
  return breadRadius(y) + PAPER_GAP + hug + sheet
}
/** d(radius)/dy of the paper at the front, for tilting face parts onto the surface. */
export function paperSlope(phi: number, y: number): number {
  return (paperRadius(phi, y + 0.005) - paperRadius(phi, y - 0.005)) / 0.01
}

interface Ring {
  r: number
  y: number
  v: number
  /** Angle of this point around the body (0 is the front, +PI/2 the right side). */
  a: number
}

/**
 * Revolve a profile that may change around the body. `rings(u)` returns the profile points
 * (bottom to top) for column u in [0, 1], each with its own angle, so a grid can follow a
 * helix. With `weld`, the first and last columns meet smoothly; without it they keep a crease.
 */
function revolve(cols: number, weld: boolean, rings: (u: number) => Ring[]): THREE.BufferGeometry {
  const pos: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  let rows = 0
  for (let i = 0; i <= cols; i++) {
    const u = i / cols
    const ring = rings(u)
    rows = ring.length
    for (const p of ring) {
      pos.push(Math.sin(p.a) * p.r, p.y, Math.cos(p.a) * p.r)
      uv.push(u, p.v)
    }
  }
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows - 1; j++) {
      const a = i * rows + j
      const b = a + rows
      idx.push(a, b, a + 1, b, b + 1, a + 1)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  if (weld) {
    const n = g.attributes.normal as THREE.BufferAttribute
    const last = cols * rows
    for (let j = 0; j < rows; j++) {
      const x = n.getX(j) + n.getX(last + j)
      const y = n.getY(j) + n.getY(last + j)
      const z = n.getZ(j) + n.getZ(last + j)
      const l = Math.hypot(x, y, z) || 1
      n.setXYZ(j, x / l, y / l, z / l)
      n.setXYZ(last + j, x / l, y / l, z / l)
    }
  }
  return g
}

/** Bread v coordinate: outer wall below 0.9, toasted lip 0.9 to 0.95, pale inside above. */
const breadV = (y: number) => THREE.MathUtils.clamp((y / 0.88) * 0.9, 0, 0.9)

/** Wrap an angle into (-PI, PI]. */
function normAngle(a: number): number {
  const w = wrapAngle(a)
  return w > Math.PI ? w - TAU : w
}

/**
 * The rolled flatbread: outer wall with the spiral seam, a rounded lip over the open top,
 * and a short inner wall going back down so the filling sits inside the roll. The grid is
 * sheared along the seam helix (u = 0 and u = 1 are the two sides of the seam), so the
 * raised edge stays crisp instead of stair-stepping across columns.
 */
export function breadGeometry(): THREE.BufferGeometry {
  return revolve(160, false, (u) => {
    const at = (y: number) => normAngle(seamAngle(y) + u * TAU)
    const top = rimHeight(at(RIM_Y))
    const out: Ring[] = []
    const NW = 46
    for (let j = 0; j <= NW; j++) {
      const y = BREAD_BOTTOM + (top - 0.016 - BREAD_BOTTOM) * (j / NW)
      const a = at(y)
      out.push({ r: breadRadius(y) + breadOffset(a, y, paperCut(a)), y, v: breadV(y), a })
    }
    const cy = top - 0.016
    const aTop = at(cy)
    const off = spiralOffset(aTop, cy)
    const rOut = breadRadius(cy) + off
    for (let k = 1; k <= 8; k++) {
      const t = (k / 8) * Math.PI
      const r = rOut - BREAD_WALL / 2 + (Math.cos(t) * BREAD_WALL) / 2
      out.push({ r, y: cy + Math.sin(t) * 0.02, v: 0.9 + 0.05 * (k / 8), a: aTop })
    }
    for (let k = 1; k <= 4; k++) {
      const y = cy - (k / 4) * 0.2
      out.push({ r: breadRadius(y) + off - BREAD_WALL, y, v: 0.95 + 0.05 * (k / 4), a: aTop })
    }
    return out
  })
}

/** Ripple weight per paper vertex: 0 at the foot and near the top edge so the paper never parts from the bread. */
export const RIPPLE_WEIGHT = 'rippleWeight'

/**
 * The paper wrap: a rounded foot, a wall that hugs the bread, and a thin edge that tucks in
 * against the bread along the slanted cut.
 */
export function paperGeometry(): THREE.BufferGeometry {
  const weights: number[] = []
  const g = revolve(128, true, (u) => {
    const phi = normAngle(Math.PI + u * TAU)
    const cut = paperCut(phi)
    const out: Ring[] = []
    const FOOT = 0.15
    const rFoot = paperRadius(phi, FOOT)
    for (let k = 0; k <= 12; k++) {
      const a = (k / 12) * (Math.PI / 2)
      const y = FOOT - Math.cos(a) * FOOT
      out.push({ r: Math.sin(a) * rFoot, y, v: y / PAPER_TEX_SPAN, a: phi })
    }
    const NW = 36
    for (let j = 1; j <= NW; j++) {
      const y = FOOT + (cut - FOOT) * Math.pow(j / NW, 0.85)
      out.push({ r: paperRadius(phi, y), y, v: y / PAPER_TEX_SPAN, a: phi })
    }
    const inner = breadRadius(cut) + breadOffset(phi, cut, cut) + 0.0015
    const rc = paperRadius(phi, cut)
    out.push({ r: (rc + inner) / 2, y: cut + 0.0035, v: cut / PAPER_TEX_SPAN, a: phi })
    out.push({ r: inner, y: cut - 0.001, v: cut / PAPER_TEX_SPAN, a: phi })
    out.push({ r: breadRadius(cut - 0.03) + breadOffset(phi, cut - 0.03, cut) + 0.0015, y: cut - 0.03, v: cut / PAPER_TEX_SPAN, a: phi })
    for (const p of out) {
      const below = cut - p.y
      const nearCorner = 1 - THREE.MathUtils.smoothstep(Math.abs(angleDiff(phi, PAPER_END - 0.1)), 0.15, 0.4)
      weights.push(
        THREE.MathUtils.smoothstep(p.y, 0.05, 0.18) * THREE.MathUtils.smoothstep(below, 0.02, 0.1) * (1 - nearCorner * THREE.MathUtils.smoothstep(0.2 - below, 0, 0.1)),
      )
    }
    return out
  })
  g.userData[RIPPLE_WEIGHT] = Float32Array.from(weights)
  return g
}

/**
 * The folded-down corner of the paper sheet: the triangle cut away by the fold line,
 * mirrored over it so it lies on the sheet, with its free tip curling off a little.
 */
export function paperFlapGeometry(): THREE.BufferGeometry {
  const R = paperRadius(PAPER_END, CORNER_Y)
  // Work flat in (arc length, height), then wrap onto the paper.
  const A = new THREE.Vector2((PAPER_END - FOLD_A) * R, planeCut(PAPER_END - FOLD_A))
  const B = new THREE.Vector2(PAPER_END * R, CORNER_Y - FOLD_B)
  const C = new THREE.Vector2(PAPER_END * R, CORNER_Y)
  const dir = B.clone().sub(A).normalize()
  const ac = C.clone().sub(A)
  const foot = A.clone().add(dir.clone().multiplyScalar(ac.dot(dir)))
  const Cm = foot.clone().multiplyScalar(2).sub(C)
  const n = 6
  const pos: number[] = []
  const idx: number[] = []
  const id = (i: number, j: number) => {
    // Row i has n - i + 1 points.
    let k = 0
    for (let r = 0; r < i; r++) k += n - r + 1
    return k + j
  }
  for (let i = 0; i <= n; i++) {
    for (let j = 0; j <= n - i; j++) {
      const wc = i / n
      const wb = j / n
      const p = A.clone()
        .add(B.clone().sub(A).multiplyScalar(wb))
        .add(Cm.clone().sub(A).multiplyScalar(wc))
      const phi = p.x / R
      const r = paperRadius(phi, p.y) + 0.0035 + 0.014 * wc * wc
      pos.push(Math.sin(phi) * r, p.y, Math.cos(phi) * r)
    }
  }
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n - i; j++) {
      idx.push(id(i, j), id(i, j + 1), id(i + 1, j))
      if (j < n - i - 1) idx.push(id(i, j + 1), id(i + 1, j + 1), id(i + 1, j))
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

/** A cupped lettuce leaf with a ruffled edge, base at the origin, growing up +y. */
export function lettuceGeometry(): THREE.BufferGeometry {
  const nu = 22
  const nv = 12
  const L = 0.24
  const verts: number[] = []
  const uvs: number[] = []
  const idx: number[] = []
  for (let i = 0; i <= nu; i++) {
    const u = i / nu
    const half = Math.sin(Math.PI * Math.pow(u, 0.75)) * 0.085 + 0.01
    for (let j = 0; j <= nv; j++) {
      const v = (j / nv) * 2 - 1
      const edge = v * v
      const x = v * half
      const ruffle = Math.sin(u * 34 + v * 3) * 0.018 * edge * (0.4 + u)
      const z = -0.04 * edge + ruffle + Math.sin(u * Math.PI) * 0.02
      verts.push(x, u * L + ruffle * 0.4, z)
      uvs.push((v + 1) / 2, u)
    }
  }
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < nv; j++) {
      const a = i * (nv + 1) + j
      const b = a + nv + 1
      idx.push(a, b, a + 1, b, b + 1, a + 1)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

/** Shrink a tube toward its curve so it tapers from `from` to `to` times its radius. */
function taperTube(g: THREE.TubeGeometry, curve: THREE.Curve<THREE.Vector3>, from: number, to: number) {
  const { tubularSegments, radialSegments } = g.parameters
  const pos = g.attributes.position as THREE.BufferAttribute
  const c = new THREE.Vector3()
  const p = new THREE.Vector3()
  for (let i = 0; i <= tubularSegments; i++) {
    const t = i / tubularSegments
    curve.getPointAt(t, c)
    const s = from + (to - from) * Math.pow(t, 1.2)
    for (let j = 0; j <= radialSegments; j++) {
      const k = i * (radialSegments + 1) + j
      p.fromBufferAttribute(pos, k).sub(c).multiplyScalar(s).add(c)
      pos.setXYZ(k, p.x, p.y, p.z)
    }
  }
  g.computeVertexNormals()
}

/** The garlic sauce curl on top, like a hair curl. Local origin where it leaves the filling. */
export function sauceGeometry(): THREE.TubeGeometry {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.05, -0.01),
    new THREE.Vector3(0.0, 0.03, 0.0),
    new THREE.Vector3(0.015, 0.1, 0.01),
    new THREE.Vector3(0.06, 0.145, 0.015),
    new THREE.Vector3(0.11, 0.13, 0.02),
    new THREE.Vector3(0.125, 0.085, 0.025),
    new THREE.Vector3(0.1, 0.055, 0.03),
    new THREE.Vector3(0.07, 0.07, 0.035),
    new THREE.Vector3(0.072, 0.095, 0.038),
  ])
  const g = new THREE.TubeGeometry(curve, 72, 0.029, 14, false)
  taperTube(g, curve, 1, 0.42)
  return g
}

/** Mouth curve with three shapes as morph targets: 0 flat, 1 big grin. Base is a small smile. */
export function mouthGeometry(): THREE.TubeGeometry {
  const make = (depth: number, lift: number) =>
    new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.045, lift, -0.006),
      new THREE.Vector3(-0.022, -depth * 0.7, 0),
      new THREE.Vector3(0, -depth, 0.002),
      new THREE.Vector3(0.022, -depth * 0.7, 0),
      new THREE.Vector3(0.045, lift, -0.006),
    ])
  const seg = 24
  const rad = 8
  const base = new THREE.TubeGeometry(make(0.016, 0.004), seg, 0.0085, rad, false)
  const flat = new THREE.TubeGeometry(make(0.002, 0.0), seg, 0.0085, rad, false)
  const grin = new THREE.TubeGeometry(make(0.03, 0.01), seg, 0.0085, rad, false)
  base.morphAttributes.position = [flat.attributes.position, grin.attributes.position]
  base.morphAttributes.normal = [flat.attributes.normal, grin.attributes.normal]
  flat.dispose()
  grin.dispose()
  return base
}

/** A flat four-point twinkle for the sauce sparkle. */
export function sparkleGeometry(): THREE.ShapeGeometry {
  const s = new THREE.Shape()
  const R = 0.05
  const r = 0.012
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 2
    const rr = i % 2 === 0 ? R : r
    const x = Math.cos(a) * rr
    const y = Math.sin(a) * rr
    if (i === 0) s.moveTo(x, y)
    else s.lineTo(x, y)
  }
  s.closePath()
  return new THREE.ShapeGeometry(s)
}

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')
  if (!ctx) throw new Error('2d canvas unavailable')
  return [c, ctx]
}

function star8(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  // Two overlapping squares, one turned 45 degrees: the khatam star.
  ctx.beginPath()
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 - Math.PI / 2
    const rr = i % 2 === 0 ? r : r * 0.72
    const x = cx + Math.cos(a) * rr
    const y = cy + Math.sin(a) * rr
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
}

/** Angle around the body for a texture column u (the lathe seam sits at the back). */
function angleAtU(u: number): number {
  const a = Math.PI + u * TAU
  return a > Math.PI ? a - TAU : a
}
/** Texture column u for an angle. */
function uAtAngle(phi: number): number {
  return wrapAngle(phi - Math.PI) / TAU
}

/**
 * Paper print: warm white with a band of 8-point stars near the foot, a pink trim that
 * follows the slanted top edge, and a soft shadow line where the sheet ends.
 */
export function paperTexture(): THREE.CanvasTexture {
  const W = 1024
  const H = 512
  const [c, ctx] = canvas(W, H)
  const yAt = (h: number) => H - (h / PAPER_TEX_SPAN) * H
  ctx.fillStyle = '#fff4ec'
  ctx.fillRect(0, 0, W, H)
  // Faint paper creases.
  ctx.strokeStyle = 'rgba(214, 170, 160, 0.22)'
  ctx.lineWidth = 2
  for (const fx of [0.08, 0.27, 0.36, 0.62, 0.71, 0.93]) {
    ctx.beginPath()
    ctx.moveTo(fx * W, yAt(0.06))
    ctx.lineTo(fx * W + 26, yAt(0.62))
    ctx.stroke()
  }
  // Star band.
  const b0 = yAt(0.195)
  const b1 = yAt(0.095)
  ctx.fillStyle = '#ffb3c6'
  ctx.fillRect(0, b0, W, b1 - b0)
  ctx.fillStyle = '#0a6c70'
  ctx.fillRect(0, b0 - 8, W, 5)
  ctx.fillRect(0, b1 + 3, W, 5)
  const n = 14
  const mid = (b0 + b1) / 2
  const sr = (b1 - b0) * 0.36
  for (let i = 0; i < n; i++) {
    const cx = ((i + 0.5) / n) * W
    star8(ctx, cx, mid, sr)
    ctx.fillStyle = i % 2 === 0 ? '#0a6c70' : '#6b2145'
    ctx.fill()
    ctx.beginPath()
    ctx.arc(cx, mid, sr * 0.28, 0, Math.PI * 2)
    ctx.fillStyle = '#fb6f92'
    ctx.fill()
    const dx = cx + W / n / 2
    ctx.beginPath()
    ctx.moveTo(dx, mid - sr * 0.45)
    ctx.lineTo(dx + sr * 0.3, mid)
    ctx.lineTo(dx, mid + sr * 0.45)
    ctx.lineTo(dx - sr * 0.3, mid)
    ctx.closePath()
    ctx.fillStyle = '#fff4ec'
    ctx.fill()
  }
  // Trim following the slanted top edge: a pink stripe and a row of teal dots.
  const edge = (u: number) => paperCut(angleAtU(u))
  ctx.strokeStyle = '#ff8fab'
  ctx.lineWidth = 9
  ctx.beginPath()
  for (let x = 0; x <= W; x += 4) {
    const y = yAt(edge(x / W) - 0.024)
    if (x === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.stroke()
  ctx.fillStyle = '#0a6c70'
  for (let x = 10; x < W; x += 28) {
    ctx.beginPath()
    ctx.arc(x, yAt(edge(x / W) - 0.048), 3.6, 0, Math.PI * 2)
    ctx.fill()
  }
  // Soft shadow along the end of the sheet.
  ctx.strokeStyle = 'rgba(170, 110, 100, 0.28)'
  ctx.lineWidth = 6
  ctx.filter = 'blur(2px)'
  ctx.beginPath()
  for (let k = 0; k <= 20; k++) {
    const y = 0.1 + (CORNER_Y - 0.1) * (k / 20)
    const x = uAtAngle(paperEndAngle(y) + 0.035) * W
    if (k === 0) ctx.moveTo(x, yAt(y))
    else ctx.lineTo(x, yAt(y))
  }
  ctx.stroke()
  ctx.filter = 'none'
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

/**
 * Toasted flatbread: golden with soft grill marks, darker toasty spots, a browned outer edge
 * along the seam, a toasted rim and a paler inside. Columns follow the sheared bread grid:
 * u = 1 is the loose outer edge of the roll.
 */
export function breadTexture(): THREE.CanvasTexture {
  const W = 1024
  const H = 512
  const [c, ctx] = canvas(W, H)
  const yAtV = (v: number) => (1 - v) * H
  const wallTop = yAtV(0.9)
  const grad = ctx.createLinearGradient(0, yAtV(0), 0, wallTop)
  grad.addColorStop(0, '#d8914a')
  grad.addColorStop(0.55, '#e9a85f')
  grad.addColorStop(0.9, '#e09a52')
  grad.addColorStop(1, '#c97b3c')
  ctx.fillStyle = grad
  ctx.fillRect(0, wallTop, W, yAtV(0) - wallTop)
  // Toasted lip, then the pale inside.
  ctx.fillStyle = '#cf8443'
  ctx.fillRect(0, yAtV(0.95), W, wallTop - yAtV(0.95))
  ctx.fillStyle = '#f3d3a0'
  ctx.fillRect(0, 0, W, yAtV(0.95))

  ctx.save()
  ctx.beginPath()
  ctx.rect(0, wallTop, W, yAtV(0) - wallTop)
  ctx.clip()
  // Grill marks: straight in the world, leaning against the seam. Map each line into the
  // sheared texture and break it where it wraps around.
  ctx.filter = 'blur(3px)'
  ctx.strokeStyle = 'rgba(140, 62, 22, 0.32)'
  ctx.lineCap = 'round'
  ctx.lineWidth = 12
  for (let i = 0; i < 11; i++) {
    const c0 = (i / 11) * TAU
    let prev = -1
    ctx.beginPath()
    for (let k = 0; k <= 60; k++) {
      const y = 0.15 + 0.72 * (k / 60)
      const x = (wrapAngle(c0 - 1.6 * y - seamAngle(y)) / TAU) * W
      const py = yAtV(breadV(y))
      if (prev < 0 || Math.abs(x - prev) > W / 2) ctx.moveTo(x, py)
      else ctx.lineTo(x, py)
      prev = x
    }
    ctx.stroke()
  }
  // Toasty spots (fixed positions so every load looks the same).
  ctx.filter = 'blur(3px)'
  const spots = [
    [60, 0.62, 16, 9], [170, 0.74, 10, 7], [250, 0.5, 20, 11], [330, 0.8, 12, 8], [410, 0.66, 9, 6],
    [470, 0.78, 18, 9], [520, 0.56, 11, 7], [600, 0.71, 22, 12], [690, 0.83, 10, 6], [760, 0.58, 14, 8],
    [840, 0.75, 19, 10], [930, 0.64, 12, 8], [120, 0.85, 9, 5], [380, 0.86, 14, 6], [560, 0.86, 16, 6],
    [300, 0.6, 7, 5], [650, 0.52, 8, 5], [880, 0.84, 8, 5],
  ] as const
  spots.forEach(([x, v, rx, ry], k) => {
    ctx.fillStyle = k % 3 === 0 ? 'rgba(118, 50, 16, 0.5)' : 'rgba(140, 64, 22, 0.36)'
    ctx.beginPath()
    ctx.ellipse(x, yAtV(v), rx, ry, 0.5, 0, Math.PI * 2)
    ctx.fill()
  })
  ctx.filter = 'none'
  // Browned loose edge of the flatbread, right along the seam.
  const edge = ctx.createLinearGradient(W * 0.93, 0, W, 0)
  edge.addColorStop(0, 'rgba(150, 70, 26, 0)')
  edge.addColorStop(0.7, 'rgba(150, 70, 26, 0.45)')
  edge.addColorStop(1, 'rgba(120, 52, 18, 0.7)')
  ctx.fillStyle = edge
  ctx.fillRect(W * 0.93, 0, W * 0.07, H)
  ctx.restore()
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}
