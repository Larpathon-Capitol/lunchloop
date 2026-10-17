// Chispa's shapes, built once in code: the drumette body (a lathe), the glaze cap with its
// drips, the pleated paper frill and the wing tip. Angles go around the y axis with 0 facing
// the camera (+z) and positive turning toward +x, the same way LatheGeometry sweeps.
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// Half-silhouette of the body as (radius, height): a fat round bottom tapering to a neck.
const PROFILE: [number, number][] = [
  [0, 0],
  [0.17, 0.008],
  [0.3, 0.045],
  [0.375, 0.12],
  [0.405, 0.215],
  [0.408, 0.3],
  [0.388, 0.395],
  [0.35, 0.49],
  [0.295, 0.58],
  [0.225, 0.66],
  [0.165, 0.735],
  [0.135, 0.8],
  [0.125, 0.84],
  [0.07, 0.865],
  [0, 0.872],
]

const OUTLINE = new THREE.SplineCurve(PROFILE.map(([r, y]) => new THREE.Vector2(r, y))).getPoints(80)
for (const p of OUTLINE) p.x = Math.max(0, p.x)

/** Body radius at height y, read off the sampled outline. */
export function radiusAt(y: number): number {
  for (let i = 1; i < OUTLINE.length; i++) {
    const a = OUTLINE[i - 1]
    const b = OUTLINE[i]
    if (y <= b.y) {
      const t = THREE.MathUtils.clamp((y - a.y) / (b.y - a.y || 1), 0, 1)
      return a.x + (b.x - a.x) * t
    }
  }
  return 0
}

/** Outward surface normal at an angle and height. */
function normalAt(theta: number, y: number): THREE.Vector3 {
  const dr = (radiusAt(y + 0.004) - radiusAt(y - 0.004)) / 0.008
  return new THREE.Vector3(Math.sin(theta), -dr, Math.cos(theta)).normalize()
}

/** A point on the skin plus a rotation whose +z is the surface normal and +y stays upright. */
export function onSurface(theta: number, y: number, lift = 0) {
  const r = radiusAt(y)
  const n = normalAt(theta, y)
  const position = new THREE.Vector3(r * Math.sin(theta), y, r * Math.cos(theta)).addScaledVector(n, lift)
  const x = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), n).normalize()
  const up = new THREE.Vector3().crossVectors(n, x)
  const quaternion = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, up, n))
  return { position, quaternion }
}

/** The body, with vertex colors that toast slightly toward the bottom. */
export function buildBody(): THREE.BufferGeometry {
  const geo = new THREE.LatheGeometry(OUTLINE, 72, Math.PI, Math.PI * 2)
  const pos = geo.getAttribute('position')
  const colors = new Float32Array(pos.count * 3)
  const honey = new THREE.Color('#f7bb57')
  const toast = new THREE.Color('#df9238')
  const light = new THREE.Color('#fbcf78')
  const c = new THREE.Color()
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i)
    if (y < 0.3) c.copy(toast).lerp(honey, THREE.MathUtils.smoothstep(y, 0, 0.3))
    else c.copy(honey).lerp(light, THREE.MathUtils.smoothstep(y, 0.3, 0.7))
    c.toArray(colors, i * 3)
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return geo
}

function angleDiff(a: number, b: number) {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b))
}

// Where the glaze runs down: angle, extra length. The front stays clear for the face.
const DRIPS = [
  { a: -0.8, d: 0.09 },
  { a: 0.95, d: 0.17 },
  { a: 2.3, d: 0.11 },
  { a: -2.1, d: 0.2 },
  { a: 0.22, d: 0.06 },
  { a: -1.45, d: 0.035 },
  { a: 3.0, d: 0.07 },
]
const DRIP_WIDTH = 0.15

/** Height of the glaze's bottom edge at an angle. */
function glazeEdge(theta: number) {
  let e = 0.635 + 0.014 * Math.sin(theta * 3 + 0.7) + 0.008 * Math.sin(theta * 7)
  for (const d of DRIPS) {
    const k = angleDiff(theta, d.a) / DRIP_WIDTH
    e -= d.d * Math.exp(-k * k)
  }
  return e
}

/** The pink glaze shell over the shoulders, with a rolled lip and round drops at each drip. */
export function buildGlaze(): THREE.BufferGeometry {
  const U = 112
  const V = 22
  const top = 0.805
  const verts: number[] = []
  const uvs: number[] = []
  const index: number[] = []
  const rows = V + 3
  for (let i = 0; i <= U; i++) {
    const theta = Math.PI + (i / U) * Math.PI * 2
    const edge = glazeEdge(theta)
    for (let j = 0; j < rows; j++) {
      let y: number
      let lift: number
      if (j <= V) {
        const s = j / V
        y = top + (edge - top) * s
        lift = 0.012 + 0.007 * THREE.MathUtils.smoothstep(s, 0.75, 1)
      } else if (j === V + 1) {
        y = edge - 0.009
        lift = 0.01
      } else {
        y = edge - 0.012
        lift = -0.004
      }
      const r = radiusAt(y)
      const n = normalAt(theta, y)
      verts.push(r * Math.sin(theta) + n.x * lift, y + n.y * lift, r * Math.cos(theta) + n.z * lift)
      uvs.push(i / U, j / (rows - 1))
    }
  }
  for (let i = 0; i < U; i++) {
    for (let j = 0; j < rows - 1; j++) {
      const a = i * rows + j
      const b = (i + 1) * rows + j
      index.push(a, a + 1, b, b, a + 1, b + 1)
    }
  }
  const shell = new THREE.BufferGeometry()
  shell.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3))
  shell.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  shell.setIndex(index)
  shell.computeVertexNormals()

  const parts: THREE.BufferGeometry[] = [shell]
  for (const d of DRIPS) {
    if (d.d < 0.07) continue
    const y = glazeEdge(d.a) - 0.004
    const { position, quaternion } = onSurface(d.a, y, 0.008)
    const r = 0.014 + d.d * 0.08
    const drop = new THREE.SphereGeometry(1, 20, 14)
    drop.applyMatrix4(new THREE.Matrix4().compose(position, quaternion, new THREE.Vector3(r, r * 1.15, r * 0.6)))
    parts.push(drop)
  }
  const merged = mergeGeometries(parts)
  for (const p of parts) p.dispose()
  return merged ?? shell
}

/** Per-vertex rest data for the frill, so the rustle and fluff can be recomputed each frame. */
export interface FrillRest {
  theta: Float32Array
  h: Float32Array
  fold: Float32Array
  y: Float32Array
  r: Float32Array
}

const FRILL_PLEATS = 16
const FRILL_ROWS = 4

/** A pleated paper cuff: a flared cone that zigzags in and out, two pinks on alternate faces. */
export function buildFrill(): { geometry: THREE.BufferGeometry; rest: FrillRest } {
  const cols = FRILL_PLEATS * 2
  const quads = cols * FRILL_ROWS
  const n = quads * 6
  const pos = new Float32Array(n * 3)
  const col = new Float32Array(n * 3)
  const rest: FrillRest = {
    theta: new Float32Array(n),
    h: new Float32Array(n),
    fold: new Float32Array(n),
    y: new Float32Array(n),
    r: new Float32Array(n),
  }
  const lightPink = new THREE.Color('#ffb3c6')
  const deepPink = new THREE.Color('#fb6f92')
  let v = 0
  const put = (k: number, row: number, c: THREE.Color) => {
    const theta = Math.PI + (k / cols) * Math.PI * 2
    const h = row / FRILL_ROWS
    const outer = k % 2 === 0
    const fold = outer ? 1 : 0.84
    // Outer folds stand a little taller so the top edge reads as points.
    const y = 0.722 + h * 0.16 + (outer ? h * h * 0.02 : 0)
    const r = 0.13 + 0.09 * Math.pow(h, 1.4)
    rest.theta[v] = theta
    rest.h[v] = h
    rest.fold[v] = fold
    rest.y[v] = y
    rest.r[v] = r
    pos[v * 3] = r * fold * Math.sin(theta)
    pos[v * 3 + 1] = y
    pos[v * 3 + 2] = r * fold * Math.cos(theta)
    c.toArray(col, v * 3)
    v++
  }
  for (let k = 0; k < cols; k++) {
    const c = k % 2 === 0 ? lightPink : deepPink
    for (let row = 0; row < FRILL_ROWS; row++) {
      put(k, row, c)
      put(k + 1, row, c)
      put(k, row + 1, c)
      put(k, row + 1, c)
      put(k + 1, row, c)
      put(k + 1, row + 1, c)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(col, 3))
  geometry.computeVertexNormals()
  return { geometry, rest }
}

/** The flat wing tip: a soft paddle with three rounded lobes at the end, pivot at the origin, reaching along +x. */
export function buildWing(): THREE.BufferGeometry {
  const s = new THREE.Shape()
  s.moveTo(0, 0.05)
  s.bezierCurveTo(0.07, 0.078, 0.14, 0.074, 0.185, 0.05)
  s.quadraticCurveTo(0.232, 0.04, 0.224, 0.008)
  s.quadraticCurveTo(0.246, -0.018, 0.218, -0.038)
  s.quadraticCurveTo(0.222, -0.068, 0.182, -0.062)
  s.bezierCurveTo(0.12, -0.062, 0.05, -0.052, 0, -0.042)
  s.closePath()
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: 0.03,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.018,
    bevelSegments: 5,
    curveSegments: 18,
  })
  geo.translate(0, 0, -0.015)
  geo.computeVertexNormals()
  return geo
}

/** The closed mouth curve, with morph targets for a flat line, a wide grin and a sideways pout. */
export function buildSmile(): THREE.BufferGeometry {
  const tube = (a: [number, number], b: [number, number], c: [number, number]) =>
    new THREE.TubeGeometry(
      new THREE.QuadraticBezierCurve3(new THREE.Vector3(a[0], a[1], 0), new THREE.Vector3(b[0], b[1], 0), new THREE.Vector3(c[0], c[1], 0)),
      24,
      0.0085,
      8,
      false,
    )
  const base = tube([-0.042, 0.012], [0, -0.03], [0.042, 0.012])
  const flat = tube([-0.028, 0], [0, -0.004], [0.028, 0])
  const grin = tube([-0.064, 0.02], [0, -0.05], [0.064, 0.02])
  const pout = tube([-0.012, -0.008], [0.016, 0.014], [0.036, -0.004])
  base.morphAttributes.position = [flat, grin, pout].map((g) => g.getAttribute('position'))
  base.morphAttributes.normal = [flat, grin, pout].map((g) => g.getAttribute('normal'))
  for (const g of [flat, grin, pout]) g.dispose()
  return base
}

/** The open mouth: a D shape (flat-ish top, round bottom), and the tongue that sits in it. */
export function buildMouth(): { mouth: THREE.BufferGeometry; tongue: THREE.BufferGeometry } {
  const m = new THREE.Shape()
  m.moveTo(-0.06, 0.016)
  m.quadraticCurveTo(0, 0.028, 0.06, 0.016)
  m.bezierCurveTo(0.062, -0.062, -0.062, -0.062, -0.06, 0.016)
  const mouth = new THREE.ExtrudeGeometry(m, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.005, bevelSegments: 3, curveSegments: 24 })
  const t = new THREE.Shape()
  t.absellipse(0, -0.029, 0.034, 0.016, 0, Math.PI * 2, false, 0)
  const tongue = new THREE.ExtrudeGeometry(t, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.003, bevelSegments: 2, curveSegments: 24 })
  return { mouth, tongue }
}

/** A four-point sparkle for the glaze shine. */
export function buildSparkle(): THREE.BufferGeometry {
  const s = new THREE.Shape()
  const R = 1
  const r = 0.22
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 2
    const rad = i % 2 === 0 ? R : r
    if (i === 0) s.moveTo(Math.cos(a) * rad, Math.sin(a) * rad)
    else s.lineTo(Math.cos(a) * rad, Math.sin(a) * rad)
  }
  s.closePath()
  return new THREE.ShapeGeometry(s)
}

/** Fixed spots for the darker crispy flecks, away from the face and under the glaze line. */
export function fleckSpots(): { theta: number; y: number; s: number }[] {
  const spots: { theta: number; y: number; s: number }[] = []
  let seed = 7
  const rand = () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
  while (spots.length < 16) {
    const theta = (rand() * 2 - 1) * Math.PI
    const y = 0.08 + rand() * 0.42
    // Keep the face (front, mid height) clean.
    if (Math.abs(theta) < 0.95 && y > 0.16) continue
    spots.push({ theta, y, s: 0.6 + rand() * 0.6 })
  }
  return spots
}
