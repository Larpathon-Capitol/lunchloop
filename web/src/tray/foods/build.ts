import * as THREE from 'three'
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/*
 * Small toolkit for procedural food. Every model is built from parts, each part gets baked vertex
 * colors, and the parts are merged into one geometry per material, so a whole food item is one or
 * two draw calls. Nothing here allocates per frame.
 */

/** Seeded random in [0, 1), so every build of an item comes out identical. */
export function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type Rand = ReturnType<typeof rng>

export const range = (r: Rand, lo: number, hi: number) => lo + (hi - lo) * r()

function hash(x: number, y: number, z: number, seed: number) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 2147483647) ^ Math.imul(seed, 1274126177)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

const fade = (t: number) => t * t * (3 - 2 * t)

/** Smooth 3D value noise in [-1, 1]. */
export function noise3(x: number, y: number, z: number, seed = 0) {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const zi = Math.floor(z)
  const u = fade(x - xi)
  const v = fade(y - yi)
  const w = fade(z - zi)
  const lerp = THREE.MathUtils.lerp
  const c = (dx: number, dy: number, dz: number) => hash(xi + dx, yi + dy, zi + dz, seed)
  const x00 = lerp(c(0, 0, 0), c(1, 0, 0), u)
  const x10 = lerp(c(0, 1, 0), c(1, 1, 0), u)
  const x01 = lerp(c(0, 0, 1), c(1, 0, 1), u)
  const x11 = lerp(c(0, 1, 1), c(1, 1, 1), u)
  return lerp(lerp(x00, x10, v), lerp(x01, x11, v), w) * 2 - 1
}

export const smoothstep = (a: number, b: number, x: number) => {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}

/** Weld vertices and recompute normals, so curved shapes shade smoothly instead of faceted. */
export function smooth(g: THREE.BufferGeometry, tolerance = 1e-4) {
  g.deleteAttribute('normal')
  g.deleteAttribute('uv')
  const welded = mergeVertices(g, tolerance)
  g.dispose()
  welded.computeVertexNormals()
  return welded
}

/** Move every vertex with `fn` (position in, position out), then recompute normals. */
export function warp(g: THREE.BufferGeometry, fn: (p: THREE.Vector3, n: THREE.Vector3) => void) {
  const pos = g.getAttribute('position') as THREE.BufferAttribute
  const nor = g.getAttribute('normal') as THREE.BufferAttribute | undefined
  const p = new THREE.Vector3()
  const n = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i)
    if (nor) n.fromBufferAttribute(nor, i)
    fn(p, n)
    pos.setXYZ(i, p.x, p.y, p.z)
  }
  pos.needsUpdate = true
  g.computeVertexNormals()
  return g
}

/** A smooth unit sphere (radius 1) with `detail` subdivisions, ready to be warped. */
export function ball(detail: number) {
  return smooth(new THREE.IcosahedronGeometry(1, detail))
}

/**
 * Unit sphere pushed along its normals by noise: `lump` for big irregular shape, `bump` for fine
 * surface texture (breading, florets). Seeds keep each piece unique.
 */
export function blob(detail: number, seed: number, lump = 0.12, bump = 0, bumpFreq = 6) {
  return warp(ball(detail), (p) => {
    const d =
      lump * noise3(p.x * 1.4 + 3.1, p.y * 1.4, p.z * 1.4, seed) +
      bump * noise3(p.x * bumpFreq, p.y * bumpFreq, p.z * bumpFreq, seed + 17)
    p.multiplyScalar(1 + d)
  })
}

/** Rounded dice-shaped cube, side about 2 (fits in [-1, 1]), from a sphere pushed toward a cube. */
export function dice(detail: number, square = 0.62) {
  return warp(ball(detail), (p) => {
    const m = Math.max(Math.abs(p.x), Math.abs(p.y), Math.abs(p.z))
    p.lerp(p.clone().divideScalar(m), square)
  })
}

/** Lathe from [radius, height] pairs, welded smooth. */
export function lathe(profile: [number, number][], segments = 32) {
  return smooth(new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), segments))
}

/** Extrude a flat shape and weld it, the same way the tray bevels its edges. */
export function extrude(shape: THREE.Shape, depth: number, bevel: number, curveSegments = 12, bevelSegments = 3) {
  return smooth(
    new THREE.ExtrudeGeometry(shape, {
      depth,
      curveSegments,
      bevelEnabled: bevel > 0,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments,
    }),
  )
}

export type MatKind = 'matte' | 'soft' | 'clear'

export type Paint = THREE.ColorRepresentation | ((p: THREE.Vector3, n: THREE.Vector3, out: THREE.Color) => void)

export interface Place {
  position?: [number, number, number]
  /** Euler angles in radians, XYZ order. */
  rotation?: [number, number, number]
  /** Overrides `rotation` when given. */
  quaternion?: THREE.Quaternion
  scale?: number | [number, number, number]
  material?: MatKind
}

const tmpP = new THREE.Vector3()
const tmpN = new THREE.Vector3()
const tmpC = new THREE.Color()

/** Mixes two colors into `out`: t = 0 gives a, t = 1 gives b. */
export function mix(out: THREE.Color, a: THREE.ColorRepresentation, b: THREE.ColorRepresentation, t: number) {
  out.set(a)
  return out.lerp(tmpC.set(b), THREE.MathUtils.clamp(t, 0, 1))
}

/** Collects colored parts and merges them per material. */
export class Kit {
  private parts: Record<MatKind, THREE.BufferGeometry[]> = { matte: [], soft: [], clear: [] }

  /**
   * Add a part. `paint` is a flat color or a function of the part's own (untransformed) vertex
   * position and normal. The geometry is consumed: pass a fresh one each time, or `.clone()`.
   */
  add(geometry: THREE.BufferGeometry, paint: Paint, place: Place = {}) {
    let g = geometry.index ? geometry.toNonIndexed() : geometry
    if (g !== geometry) geometry.dispose()
    for (const name of Object.keys(g.attributes)) {
      if (name !== 'position' && name !== 'normal') g.deleteAttribute(name)
    }
    if (!g.getAttribute('normal')) g.computeVertexNormals()

    const pos = g.getAttribute('position') as THREE.BufferAttribute
    const nor = g.getAttribute('normal') as THREE.BufferAttribute
    const colors = new Float32Array(pos.count * 3)
    const c = new THREE.Color()
    if (typeof paint !== 'function') c.set(paint)
    for (let i = 0; i < pos.count; i++) {
      if (typeof paint === 'function') {
        tmpP.fromBufferAttribute(pos, i)
        tmpN.fromBufferAttribute(nor, i)
        paint(tmpP, tmpN, c)
      }
      colors[i * 3] = c.r
      colors[i * 3 + 1] = c.g
      colors[i * 3 + 2] = c.b
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3))

    const m = new THREE.Matrix4()
    const q = place.quaternion ?? new THREE.Quaternion().setFromEuler(new THREE.Euler(...(place.rotation ?? [0, 0, 0])))
    const s = place.scale ?? 1
    const sv = typeof s === 'number' ? new THREE.Vector3(s, s, s) : new THREE.Vector3(...s)
    m.compose(new THREE.Vector3(...(place.position ?? [0, 0, 0])), q, sv)
    g.applyMatrix4(m)
    this.parts[place.material ?? 'matte'].push(g)
    return this
  }

  build(): BuiltFood {
    const out: BuiltFood = { triangles: 0 }
    for (const kind of ['matte', 'soft', 'clear'] as const) {
      const list = this.parts[kind]
      if (!list.length) continue
      const merged = mergeGeometries(list, false)
      for (const g of list) g.dispose()
      if (!merged) continue
      merged.computeBoundingBox()
      merged.computeBoundingSphere()
      out[kind] = merged
      out.triangles += merged.getAttribute('position').count / 3
    }
    return out
  }
}

export interface BuiltFood {
  matte?: THREE.BufferGeometry
  soft?: THREE.BufferGeometry
  clear?: THREE.BufferGeometry
  triangles: number
}

/** Quaternion that turns local +y to point along `normal`, then spins `spin` radians about it. */
export function alignUp(normal: THREE.Vector3, spin = 0) {
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal.clone().normalize())
  return q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), spin))
}

// ---------------------------------------------------------------- cute toolkit

const SHADE_LIGHT = new THREE.Color('#fff8ec')
/** Plum shadow tint (close to --ink), so every food's shadows lean the same warm way. */
const SHADE_DEEP = new THREE.Color('#5c2236')
const tmpBase = new THREE.Color()

/**
 * Soft-toy shading baked into vertex colors: the base color in the middle, a creamy highlight on
 * top and a warm plum shadow underneath. `light` and `deep` are how far to lean (0 to 1).
 * Uses the part's own normal, so it reads right for parts that sit roughly upright.
 */
export function toon(base: THREE.ColorRepresentation, light = 0.16, deep = 0.36): Paint {
  const b = new THREE.Color(base)
  return (_p, n, out) => {
    tmpBase.copy(b)
    if (n.y >= 0) out.copy(tmpBase.lerp(SHADE_LIGHT, smoothstep(0.15, 1, n.y) * light))
    else out.copy(tmpBase.lerp(SHADE_DEEP, smoothstep(0, -1, n.y) * deep))
  }
}

/** Like `toon`, but blends from `bottom` to `top` by local height between y0 and y1 first. */
export function toonRamp(
  bottom: THREE.ColorRepresentation,
  top: THREE.ColorRepresentation,
  y0: number,
  y1: number,
  light = 0.16,
  deep = 0.36,
): Paint {
  const a = new THREE.Color(bottom)
  const c = new THREE.Color(top)
  return (p, n, out) => {
    tmpBase.copy(a).lerp(c, smoothstep(y0, y1, p.y))
    if (n.y >= 0) out.copy(tmpBase.lerp(SHADE_LIGHT, smoothstep(0.15, 1, n.y) * light))
    else out.copy(tmpBase.lerp(SHADE_DEEP, smoothstep(0, -1, n.y) * deep))
  }
}

/** A squashed, slightly lumpy low-poly ball: the basic chunky food piece. Radius about 1. */
export function puff(seed: number, lump = 0.08, detail = 2) {
  return lump > 0 ? blob(detail, seed, lump) : ball(detail)
}

export interface Spot {
  x: number
  /** Height of the heap surface here. */
  y: number
  z: number
  /** 0 at the center of the heap, 1 at its edge. */
  r: number
  /** Surface normal of the heap here, for tilting pieces so they lie on it. */
  normal: THREE.Vector3
}

/**
 * Spots spread evenly over a rounded-rectangle footprint `w` by `d`, with heights on a dome
 * `height` tall (edge pieces sit lower, center pieces higher). `square` 2 = ellipse, 4+ = rounded
 * rectangle. Use it to heap nuggets, florets, corn and the like so they fill a compartment.
 */
export function heap(opts: { w: number; d: number; count: number; seed: number; height: number; square?: number; jitter?: number }) {
  const { w, d, count, seed, height } = opts
  const square = opts.square ?? 3
  const r = rng(seed)
  const a = w / 2
  const b = d / 2
  // Grid spacing so about `count` cells land inside the footprint.
  const fillRatio = square >= 4 ? 0.92 : square >= 3 ? 0.86 : 0.785
  const step = Math.sqrt((w * d * fillRatio) / count)
  const jitter = (opts.jitter ?? 0.3) * step
  const spots: Spot[] = []
  const rad = (x: number, z: number) => Math.pow(Math.pow(Math.abs(x / a), square) + Math.pow(Math.abs(z / b), square), 1 / square)
  const surf = (x: number, z: number) => height * (1 - Math.pow(Math.min(rad(x, z), 1), 2.2))
  let row = 0
  for (let z = -b + step / 2; z <= b; z += step * 0.88, row++) {
    for (let x = -a + step / 2 + (row % 2 ? step / 2 : 0); x <= a; x += step) {
      const jx = x + (r() - 0.5) * 2 * jitter
      const jz = z + (r() - 0.5) * 2 * jitter
      const rr = rad(jx, jz)
      if (rr > 0.9) continue
      const e = 0.01
      const normal = new THREE.Vector3(surf(jx - e, jz) - surf(jx + e, jz), 2 * e, surf(jx, jz - e) - surf(jx, jz + e)).normalize()
      spots.push({ x: jx, y: surf(jx, jz), z: jz, r: rr, normal })
    }
  }
  return spots
}
