import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import type { BuiltFood } from '../build'
import type { Component, FoodId } from '../items'
import { alignUp, ball, dice, heap as rawHeap, Kit, lathe, mix, puff, range, rng, smoothstep, toon, toonRamp, warp } from '../build'
import { FOOT } from '../fit'
import { FOOD as C } from '../palette'

/*
 * Vegetables: carrots, broccoli, side salad, black beans, corn, and the generic green beans.
 * Chunky soft-toy pieces, heaped so a full portion fills FOOT.vegetable (about 1.2 x 1).
 */

const [W, D] = FOOT.vegetable

/** The shared heap, shifted so its spots sit centered on the compartment (the raw grid leans toward the back). */
function heap(opts: Parameters<typeof rawHeap>[0]) {
  const spots = rawHeap(opts)
  if (!spots.length) return spots
  const zs = spots.map((s) => s.z)
  const xs = spots.map((s) => s.x)
  const dz = (Math.min(...zs) + Math.max(...zs)) / 2
  const dx = (Math.min(...xs) + Math.max(...xs)) / 2
  return spots.map((s) => ({ ...s, x: s.x - dx, z: s.z - dz }))
}

/** Half-dome (lathe) of footprint radius `a` and height `b`, with a flat floor. */
function mound(a: number, b: number, segments = 16, rings = 6) {
  const prof: [number, number][] = [[0, 0]]
  for (let i = rings; i >= 0; i--) {
    const phi = (i / rings) * (Math.PI / 2)
    prof.push([a * Math.sin(phi), b * Math.cos(phi)])
  }
  return lathe(prof, segments)
}

/** Heap spots over an ellipse W x D, sitting on the surface of a dome of height `b`. */
function domeSpots(count: number, b: number, seed: number, w = W, d = D, inset = 0.95) {
  const a = (w / 2) * inset
  const bb = (d / 2) * inset
  return heap({ w, d, count, seed, height: 0.1, square: 2, jitter: 0.25 }).map((s) => {
    const u = s.x / a
    const v = s.z / bb
    const q = Math.max(0, 1 - u * u - v * v)
    const y = b * Math.sqrt(q)
    const root = Math.max(Math.sqrt(q), 0.15)
    const normal = new THREE.Vector3((b * u) / a / root, 1, (b * v) / bb / root).normalize()
    return { ...s, y, normal }
  })
}

/** A coin with soft edges: radius `r`, thickness `h`, a lighter core on both faces. */
function coin(r: number, h: number, rim = 0.04) {
  return lathe(
    [
      [0, 0],
      [r * 0.6, 0],
      [r * 0.72, 0],
      [r - rim, 0],
      [r, rim],
      [r, h - rim],
      [r - rim, h],
      [r * 0.72, h],
      [r * 0.6, h],
      [0, h],
    ],
    10,
  )
}

// ---------------------------------------------------------------- carrots

function carrots(): BuiltFood {
  const k = new Kit()
  const r = rng(12)
  const rad = 0.245
  const h = 0.16
  const paint = (p: THREE.Vector3, n: THREE.Vector3, out: THREE.Color) => {
    const core = (1 - smoothstep(0.62 * rad, 0.72 * rad, Math.hypot(p.x, p.z))) * smoothstep(0.5, 0.9, Math.abs(n.y))
    mix(out, '#fb7a22', '#ffb54f', core)
    // plum shading, lighter on top
    if (n.y < 0) out.lerp(new THREE.Color('#5c2236'), smoothstep(0, -1, n.y) * 0.3)
    else out.lerp(new THREE.Color('#fff8ec'), smoothstep(0.15, 1, n.y) * 0.12)
  }
  const place = (x: number, y: number, z: number, tilt: number, normal: THREE.Vector3) => {
    const q = alignUp(normal, r() * Math.PI)
    q.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(range(r, -tilt, tilt), 0, range(r, -tilt, tilt))))
    k.add(coin(rad, h), paint, { quaternion: q, position: [x, y, z] })
  }
  for (const s of heap({ w: W - 0.22, d: D - 0.2, count: 9, seed: 5, height: 0.08, square: 3.2 })) {
    place(s.x, s.y + h * 0.5 + 0.02, s.z, 0.28, s.normal)
  }
  for (const s of heap({ w: W * 0.5, d: D * 0.45, count: 5, seed: 8, height: 0.06, square: 2 })) {
    place(s.x, s.y + 0.15 + h * 0.4, s.z, 0.5, s.normal)
  }
  return k.build()
}

// ---------------------------------------------------------------- broccoli

function floret(k: Kit, r: () => number, x: number, y: number, z: number, size: number, lean: THREE.Vector3) {
  const q = alignUp(lean, r() * Math.PI)
  const at = (v: [number, number, number]) => new THREE.Vector3(...v).applyQuaternion(q).multiplyScalar(size)
  const base = new THREE.Vector3(x, y, z)
  const put = (geo: THREE.BufferGeometry, paint: Parameters<Kit['add']>[1], off: [number, number, number], scale: [number, number, number]) => {
    const o = at(off)
    k.add(geo, paint, { position: [base.x + o.x, base.y + o.y, base.z + o.z], quaternion: q, scale: scale.map((v) => v * size) as [number, number, number] })
  }
  // Short pale stalk
  put(
    lathe(
      [
        [0, -0.02],
        [0.1, 0],
        [0.075, 0.2],
        [0.11, 0.34],
        [0, 0.36],
      ],
      8,
    ),
    toonRamp(C.stalk, C.broccoliLight, 0.05, 0.3),
    [0, 0, 0],
    [1, 1, 1],
  )
  const green = toonRamp(C.broccoli, '#7cc84e', -0.6, 0.9, 0.12, 0.34)
  // Big center puff plus a few side puffs
  put(puff(r() * 99, 0.12, 2), green, [0, 0.56, 0], [0.34, 0.27, 0.34])
  const n = 3
  const a0 = r() * 6
  for (let i = 0; i < n; i++) {
    const a = a0 + (i / n) * Math.PI * 2
    put(puff(r() * 99, 0.1, 1), green, [Math.cos(a) * 0.27, 0.48 + 0.03 * i, Math.sin(a) * 0.27], [0.19, 0.16, 0.19])
  }
}

function broccoli(): BuiltFood {
  const k = new Kit()
  const r = rng(31)
  const floor = heap({ w: W * 0.86, d: D * 0.86, count: 6, seed: 3, height: 0.04, square: 3, jitter: 0.2 })
  for (const s of floor) {
    const lean = new THREE.Vector3(s.x * 1.2 + range(r, -0.3, 0.3), 1, s.z * 1.2 + range(r, -0.3, 0.3))
    floret(k, r, s.x, 0.0, s.z, range(r, 0.6, 0.68), lean)
  }
  floret(k, r, 0.0, 0.1, 0.0, 0.62, new THREE.Vector3(0.1, 1, -0.1))
  return k.build()
}

// ---------------------------------------------------------------- side salad

/** A fat, ruffled lettuce leaf about 1 wide: puffy pillow, cupped, with a wavy edge. Lies on y = 0. */
function lettuceLeaf(seed: number, ruffle = 0.22) {
  const g = ball(2)
  const ph = seed * 1.7
  return warp(g, (p) => {
    const rr = Math.hypot(p.x, p.z)
    const th = Math.atan2(p.z, p.x)
    const wave = Math.sin(th * 5 + ph) * 0.5 + Math.sin(th * 3 - ph) * 0.5
    const edge = rr * rr
    // flatten into a pillow, lift the rim into a cup, ruffle the edge up and down
    const top = p.y >= 0 ? 1 : 0.5
    const flat = 0.2 * top * p.y
    p.set(p.x * (1 + 0.1 * wave * rr), flat + 0.8 * edge * 0.45 + ruffle * wave * edge * rr + 0.1, p.z * (1 + 0.1 * wave * rr))
  })
}

function sideSalad(): BuiltFood {
  const k = new Kit()
  const r = rng(77)
  const leafPaint = (p: THREE.Vector3, n: THREE.Vector3, out: THREE.Color) => {
    const rr = Math.hypot(p.x, p.z)
    mix(out, C.lettuceDeep, C.lettuce, smoothstep(0.25, 1.0, rr))
    if (n.y >= 0) out.lerp(new THREE.Color('#fff8ec'), smoothstep(0.15, 1, n.y) * 0.07)
    else out.lerp(new THREE.Color('#5c2236'), smoothstep(0, -1, n.y) * 0.3)
  }
  // Floor leaves
  for (const s of heap({ w: W * 0.62, d: D * 0.5, count: 6, seed: 2, height: 0.03, square: 3, jitter: 0.12 })) {
    const sc = range(r, 0.36, 0.4)
    k.add(lettuceLeaf(r() * 50), leafPaint, {
      position: [s.x, s.y, s.z],
      rotation: [range(r, -0.1, 0.1), range(r, 0, Math.PI * 2), range(r, -0.1, 0.1)],
      scale: [sc * 1.2, sc * 1.1, sc * 0.9],
    })
  }
  // Top leaves, higher and smaller
  for (const s of heap({ w: W * 0.5, d: D * 0.5, count: 3, seed: 6, height: 0.03, square: 2, jitter: 0.1 })) {
    const sc = range(r, 0.3, 0.34)
    k.add(lettuceLeaf(r() * 50 + 9), leafPaint, {
      position: [s.x, s.y + 0.13, s.z],
      rotation: [range(r, -0.2, 0.2), range(r, 0, Math.PI * 2), range(r, -0.2, 0.2)],
      scale: [sc * 1.2, sc * 1.1, sc * 0.9],
    })
  }
  // Cherry tomatoes
  const tomatoes: [number, number, number][] = [
    [-0.16, 0.34, -0.12],
    [0.3, 0.3, 0.12],
    [-0.38, 0.3, 0.22],
  ]
  for (const [x, y, z] of tomatoes) {
    k.add(ball(1), toon(C.tomato, 0.3, 0.3), { position: [x, y, z], scale: [0.13, 0.12, 0.13], material: 'soft' })
    k.add(puff(3, 0, 1), toon(C.herb), { position: [x, y + 0.115, z], scale: [0.05, 0.015, 0.05] })
  }
  // Cucumber coins
  const cukePaint = (p: THREE.Vector3, n: THREE.Vector3, out: THREE.Color) => {
    const edge = smoothstep(0.55 * 0.15, 0.15 * 0.95, Math.hypot(p.x, p.z))
    mix(out, C.cucumberFlesh, C.cucumber, edge)
    if (n.y < 0) out.lerp(new THREE.Color('#5c2236'), smoothstep(0, -1, n.y) * 0.3)
  }
  const cukes: [number, number, number, number, number][] = [
    [0.1, 0.3, -0.2, 0.3, 0.2],
    [-0.12, 0.34, 0.15, -0.3, 0.5],
    [0.45, 0.2, -0.18, 0.2, 1.1],
  ]
  for (const [x, y, z, tx, tz] of cukes) {
    k.add(coin(0.15, 0.065, 0.025), cukePaint, { position: [x, y, z], rotation: [tx, 0, tz] })
  }
  return k.build()
}

// ---------------------------------------------------------------- black beans

function blackBeans(): BuiltFood {
  const k = new Kit()
  const r = rng(41)
  const b = 0.3
  k.add(mound((W / 2) * 0.96, b * 0.96, 20, 7), toon(C.blackBean, 0.1, 0.4), { scale: [1, 1, D / W] })
  const kidney = () =>
    warp(ball(1), (p) => {
      p.z += 0.3 * p.x * p.x
    })
  const paint = (shade: number) => (_p: THREE.Vector3, n: THREE.Vector3, out: THREE.Color) => {
    mix(out, C.blackBean, C.blackBeanLight, smoothstep(0.3, 1, n.y) * 0.45 + shade)
    if (n.y < 0) out.lerp(new THREE.Color('#2a1a30'), smoothstep(0, -1, n.y) * 0.4)
  }
  for (const s of domeSpots(26, b, 7)) {
    const sc = range(r, 0.95, 1.12)
    const q = alignUp(s.normal, r() * Math.PI * 2)
    k.add(kidney(), paint(range(r, 0, 0.1)), {
      quaternion: q,
      position: [s.x, s.y + 0.02, s.z],
      scale: [0.13 * sc, 0.085 * sc, 0.085 * sc],
      material: 'soft',
    })
  }
  // Herb sprinkle
  for (const s of domeSpots(7, b + 0.075, 19, W * 0.8, D * 0.8)) {
    k.add(ball(0), toon(C.herb, 0.2, 0.2), {
      quaternion: alignUp(s.normal, r() * 6),
      position: [s.x, s.y + 0.015, s.z],
      scale: [0.055, 0.02, 0.03],
    })
  }
  return k.build()
}

// ---------------------------------------------------------------- seasoned corn

function seasonedCorn(): BuiltFood {
  const k = new Kit()
  const r = rng(53)
  const b = 0.3
  k.add(mound((W / 2) * 0.88, b * 0.9, 16, 6), toon(C.cornDeep, 0.1, 0.35), { scale: [1, 1, D / W] })
  const shades = [C.corn, C.corn, C.cornDeep, C.corn, C.cornLight]
  for (const s of domeSpots(26, b, 11)) {
    const shade = shades[Math.floor(r() * shades.length)]
    const sc = range(r, 0.92, 1.1)
    k.add(dice(1, 0.6), toon(shade, 0.1, 0.3), {
      quaternion: alignUp(s.normal, r() * Math.PI * 2),
      position: [s.x, s.y + 0.02, s.z],
      scale: [0.115 * sc, 0.095 * sc, 0.115 * sc],
      material: 'soft',
    })
  }
  // Butter pat and herb flecks
  k.add(new RoundedBoxGeometry(0.3, 0.1, 0.24, 2, 0.04), toon('#fff6c4', 0.15, 0.25), {
    position: [0.05, b + 0.07, 0.0],
    rotation: [0.05, 0.4, 0.04],
    material: 'soft',
  })
  for (const s of domeSpots(7, b + 0.05, 23, W * 0.75, D * 0.75)) {
    if (Math.hypot(s.x - 0.05, s.z) < 0.22) continue
    k.add(ball(0), toon(C.herb, 0.2, 0.2), {
      quaternion: alignUp(s.normal, r() * 6),
      position: [s.x, s.y + 0.015, s.z],
      scale: [0.05, 0.02, 0.03],
    })
  }
  return k.build()
}

// ---------------------------------------------------------------- generic green beans

function greenBeans(): BuiltFood {
  const k = new Kit()
  const r = rng(63)
  const greens = [C.bean, C.beanLight, C.bean, C.broccoliLight]
  const bean = () =>
    warp(new THREE.CapsuleGeometry(0.08, 0.34, 2, 6), (p) => {
      p.z += 1.2 * p.y * p.y
    })
  const put = (x: number, y: number, z: number) => {
    const yaw = r() * Math.PI
    k.add(bean(), toon(greens[Math.floor(r() * greens.length)], 0.25, 0.3), {
      position: [x, y, z],
      rotation: [0, yaw, Math.PI / 2 + range(r, -0.15, 0.15)],
      scale: range(r, 0.92, 1.12),
      material: 'soft',
    })
  }
  for (const s of heap({ w: W * 0.94, d: D * 0.9, count: 22, seed: 4, height: 0.06, square: 3.2, jitter: 0.35 })) {
    put(s.x, 0.075 + s.y * 0.5, s.z)
  }
  for (const s of heap({ w: W * 0.62, d: D * 0.56, count: 11, seed: 9, height: 0.06, square: 2.5, jitter: 0.35 })) {
    put(s.x, 0.2 + s.y * 0.5, s.z)
  }
  return k.build()
}

/** New-style builders, keyed by food id. Anything missing falls back to the old model in items.ts. */
export const MODELS: Partial<Record<FoodId, () => BuiltFood>> = {
  steamed_carrots: carrots,
  broccoli,
  side_salad: sideSalad,
  black_beans: blackBeans,
  seasoned_corn: seasonedCorn,
}

/** Fallback models for unknown items, keyed by compartment. */
export const FALLBACKS: Partial<Record<Component, () => BuiltFood>> = {
  vegetable: greenBeans,
}
