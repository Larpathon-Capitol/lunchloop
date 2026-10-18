import * as THREE from 'three'
import type { BuiltFood, Paint } from '../build'
import type { Component, FoodId } from '../items'
import { ball, blob, heap, Kit, lathe, puff, range, rng, toon, toonRamp, warp } from '../build'
import { FOOT } from '../fit'
import { FOOD as C } from '../palette'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

const GLAZE = new THREE.Color(C.teriyaki)

type PaintFn = (p: THREE.Vector3, n: THREE.Vector3, out: THREE.Color) => void
/** toon / toonRamp always return a function; this narrows the Paint union so it can be called. */
const fn = (paint: Paint) => paint as PaintFn

/*
 * Bowl-style entrees and the generic entree. Chunky soft-toy pieces, toon() shading, and each
 * portion fills FOOT.meat_alternate (about 1.6 wide, 1 deep), sitting straight in the tray well.
 */

const [W, D] = FOOT.meat_alternate

/** A low dome with a flat bottom: unit ball cut at y = 0 and squashed. Scale it into place. */
function dome(detail = 2, seed = 0, lump = 0.06) {
  return warp(lump > 0 ? blob(detail, seed, lump) : ball(detail), (p) => {
    if (p.y < 0) p.y *= 0.04
  })
}

/** A flat puddle of sauce with a rounded rim, radius 1 and about 1 tall before scaling. */
function puddle(seed: number, wobble = 0.07, segments = 28) {
  const g = lathe(
    [
      [0, 0],
      [0.9, 0],
      [0.97, 0.05],
      [1, 0.4],
      [0.94, 0.78],
      [0.75, 0.96],
      [0, 1],
    ],
    segments,
  )
  return warp(g, (p) => {
    const a = Math.atan2(p.z, p.x)
    const w = 1 + wobble * Math.sin(a * 3 + seed) + wobble * 0.6 * Math.sin(a * 5 + seed * 2)
    p.x *= w
    p.z *= w
  })
}

/** A soft rice cushion: rounded-rectangle footprint (radius 1 before scaling), gently domed top. */
function cushion(square = 4) {
  const g = lathe(
    [
      [0, 0],
      [0.88, 0],
      [0.97, 0.12],
      [1, 0.42],
      [0.94, 0.78],
      [0.62, 0.96],
      [0, 1],
    ],
    28,
  )
  return warp(g, (p) => {
    const a = Math.atan2(p.z, p.x)
    const c = Math.abs(Math.cos(a))
    const sn = Math.abs(Math.sin(a))
    const k = Math.pow(Math.pow(c, square) + Math.pow(sn, square), -1 / square)
    p.x *= k
    p.z *= k
  })
}

/** A small leaf (herb) lying flat: a squashed ball pinched to a point at +x. */
function leaf() {
  return warp(ball(1), (p) => {
    const t = (p.x + 1) / 2
    p.z *= 1 - t * 0.55
    p.y *= 0.25
  })
}

/** Chunky little broccoli floret: a puffy crown on a short pale stalk. */
function floret(k: Kit, x: number, y: number, z: number, s: number, seed: number, tilt = 0) {
  const stalk = new THREE.CylinderGeometry(0.42, 0.55, 1, 8, 1)
  k.add(stalk, toon(C.stalk), { position: [x, y + 0.35 * s, z], rotation: [tilt, 0, tilt * 0.5], scale: s })
  const r = rng(seed)
  const crown: [number, number, number, number][] = [
    [0, 0.95, 0, 0.7],
    [0.42, 0.78, 0.15, 0.48],
    [-0.38, 0.8, 0.22, 0.48],
    [0.05, 0.8, -0.42, 0.5],
  ]
  for (const [cx, cy, cz, cr] of crown) {
    k.add(puff(seed * 7 + cx * 10, 0.1, 1), toonRamp(C.broccoliDeep, C.broccoliLight, -0.6, 0.8), {
      position: [x + cx * s, y + cy * s, z + cz * s],
      rotation: [range(r, 0, 3), range(r, 0, 3), 0],
      scale: [cr * s, cr * 0.82 * s, cr * s],
    })
  }
}

/** A short scallion ring, lying flat. */
function scallion(k: Kit, x: number, y: number, z: number, s: number, rot = 0) {
  k.add(new THREE.TorusGeometry(1, 0.42, 4, 8), toon(C.scallion, 0.3, 0.2), {
    position: [x, y, z],
    rotation: [Math.PI / 2 + 0.2, rot, 0],
    scale: [s, s, s * 1.1],
  })
}

/** A tiny sesame seed lying on a surface. */
function sesame(k: Kit, x: number, y: number, z: number, rot: number) {
  k.add(new THREE.IcosahedronGeometry(1, 0), toon(C.sesame, 0.1, 0.25), {
    position: [x, y, z],
    rotation: [0, rot, 0],
    scale: [0.032, 0.015, 0.019],
  })
}

/** Soft rice paint: bright white on top, a creamy shade toward the floor. */
const ricePaint: Paint = toonRamp('#f3e2c2', C.whiteRice, 0.0, 0.8, 0.25, 0.45)

/** A rice mound: a flat-bottomed dome with soft, cloudlike bumps (no single grains). */
function riceMound(seed: number) {
  return warp(blob(3, seed, 0.06, 0.035, 5), (p) => {
    if (p.y < 0) p.y *= 0.04
  })
}

/** Chickpea curry with rice: a big rice dome on the left, a glossy curry pool full of chickpeas on the right. */
export function chickpeaCurryRice() {
  const k = new Kit()
  const r = rng(31)
  // Curry pool, right two thirds, tucked under the rice
  const poolX = 0.2
  const poolA = W * 0.36
  const poolB = D * 0.44
  const poolH = 0.08
  k.add(puddle(2, 0.05), toonRamp(C.curryDeep, '#ff9424', 0.2, 1, 0.06, 0.3), {
    position: [poolX, 0, 0],
    scale: [poolA, poolH, poolB],
    material: 'soft',
  })
  // Rice dome on the left
  const riceX = -W * 0.26
  k.add(riceMound(5), ricePaint, { position: [riceX, 0, -0.02], scale: [0.43, 0.29, 0.44] })
  // Chickpeas heaped in the pool, a floor layer and a few on top
  const layers = [
    heap({ w: poolA * 1.55, d: poolB * 1.6, count: 13, seed: 8, height: 0.02, square: 2.2 }),
    heap({ w: poolA * 0.8, d: poolB * 0.8, count: 4, seed: 3, height: 0.0, square: 2 }).map((s) => ({ ...s, y: s.y + 0.07 })),
  ]
  const peaPaint = toonRamp(C.chickpeaDeep, C.chickpea, -0.7, 0.7, 0.22, 0.4)
  layers.forEach((layer, li) => {
    for (const s of layer) {
      const x = poolX + 0.05 + s.x
      if (x < riceX + 0.42) continue
      const size = range(r, 0.095, 0.108)
      k.add(blob(1, 40 + li * 20 + s.x * 30, 0.1), peaPaint, {
        position: [x, poolH * 0.75 + s.y + size * 0.55, s.z],
        rotation: [range(r, 0, 3), range(r, 0, 3), 0],
        scale: [size * 1.05, size * 0.92, size],
      })
    }
  })
  // Cilantro leaves: two on the curry, one on the rice
  const leaves: [number, number, number, number, number][] = [
    [0.36, 0.2, -0.2, 0.6, 0.11],
    [0.44, 0.19, -0.12, -0.9, 0.09],
    [riceX + 0.06, 0.3, -0.06, 2.4, 0.1],
  ]
  for (const [x, y, z, ry, s] of leaves) {
    k.add(leaf(), toon(C.herb, 0.12, 0.2), { position: [x, y, z], rotation: [0.15, ry, 0.1], scale: [s, s, s * 0.7] })
  }
  return k.build()
}

/** Teriyaki tofu bowl: a rice bed over the floor, glossy tofu cubes, broccoli, carrot coins, scallion. */
export function teriyakiTofuBowl() {
  const k = new Kit()
  const r = rng(12)
  // Rice bed: a soft cushion covering most of the well
  const bedH = 0.13
  k.add(cushion(4), ricePaint, { position: [0, 0, 0], scale: [W * 0.45, bedH, D * 0.44] })
  const top = bedH - 0.005
  // Teriyaki pool soaking the middle of the rice
  k.add(puddle(5, 0.08, 18), toon('#c4621f', 0.1, 0.3), { position: [-0.12, top - 0.02, 0.0], scale: [0.36, 0.035, 0.27], material: 'soft' })
  // Tofu cubes, glazed: golden sides, teriyaki tops
  const tofuBase = fn(toonRamp('#ffe2a0', C.teriyakiLight, -0.3, 0.9, 0.22, 0.22))
  const tofuPaint: Paint = (p, n, out) => {
    tofuBase(p, n, out)
    if (n.y > 0.55) out.lerp(GLAZE, Math.min(1, (n.y - 0.55) * 2.2) * 0.85)
  }
  const cubes: [number, number, number, number][] = [
    [-0.32, 0, -0.1, 0.3],
    [-0.12, 0, -0.16, -0.2],
    [0.06, 0, -0.1, 0.5],
    [-0.24, 0, 0.12, -0.4],
    [-0.04, 0, 0.08, 0.1],
    [-0.2, 1, -0.02, 0.7],
    [-0.02, 1, -0.05, -0.3],
  ]
  for (const [x, layer, z, ry] of cubes) {
    const s = range(r, 0.098, 0.106)
    k.add(new RoundedBoxGeometry(2, 2, 2, 1, 0.4), tofuPaint, {
      position: [x, top + s + layer * 0.15, z],
      rotation: [layer ? 0.25 : 0.04, ry, layer ? -0.2 : 0.03],
      scale: s,
      material: 'soft',
    })
  }
  // Broccoli on the right
  floret(k, 0.44, top - 0.02, -0.15, 0.17, 3, 0.15)
  floret(k, 0.56, top - 0.02, 0.12, 0.15, 7, -0.2)
  floret(k, 0.3, top - 0.02, 0.18, 0.13, 11, 0.1)
  // Carrot coins along the front left and back
  const coinCore = toon('#ffa04a', 0.05, 0.3)
  const coinSkin = toon('#ff7a1e', 0.05, 0.3)
  const coin = (x: number, z: number, tilt: number) => {
    k.add(new THREE.CylinderGeometry(1, 1, 0.38, 14, 1), (p, n, out) => {
      const rr = Math.hypot(p.x, p.z)
      fn(rr < 0.45 && Math.abs(n.y) > 0.5 ? coinCore : coinSkin)(p, n, out)
    }, { position: [x, top + 0.03, z], rotation: [tilt, 0, tilt * 0.6], scale: 0.075 })
  }
  coin(-0.56, 0.18, 0.15)
  coin(-0.6, -0.1, -0.12)
  coin(-0.42, 0.28, 0.2)
  coin(0.18, -0.3, 0.18)
  // Scallion and sesame over the tofu
  scallion(k, -0.14, top + 0.33, -0.05, 0.035, 0.3)
  scallion(k, -0.3, top + 0.22, 0.06, 0.03, 1.2)
  scallion(k, 0.05, top + 0.22, 0.02, 0.032, 2)
  scallion(k, -0.1, top + 0.22, 0.18, 0.03, 0.7)
  for (let i = 0; i < 6; i++) {
    sesame(k, range(r, -0.3, 0.06), top + 0.22 + 0.05 * r(), range(r, -0.14, 0.14), range(r, 0, 3))
  }
  return k.build()
}

/** Orange chicken: a big heap of glossy orange-glazed chunks with sesame and scallion. */
export function orangeChicken() {
  const k = new Kit()
  const r = rng(7)
  const paint = toonRamp('#d9481a', '#ff7a1c', -0.8, 0.5, 0.1, 0.3)
  const layers = [
    heap({ w: W * 0.98, d: D * 0.98, count: 13, seed: 2, height: 0.03, square: 3 }),
    heap({ w: W * 0.58, d: D * 0.55, count: 4, seed: 6, height: 0.04, square: 2 }).map((s) => ({ ...s, y: s.y + 0.14 })),
  ]
  const tops: { x: number; y: number; z: number }[] = []
  layers.forEach((layer, li) => {
    for (const s of layer) {
      const size = range(r, 0.95, 1.1)
      const h = 0.115 * size
      k.add(blob(2, r() * 100, 0.26, 0.05, 4), paint, {
        position: [s.x, s.y + h * 0.85, s.z],
        rotation: [range(r, -0.3, 0.3), range(r, 0, Math.PI), range(r, -0.3, 0.3)],
        scale: [0.21 * size, h, 0.18 * size],
        material: 'soft',
      })
      if (li === 1 || s.r < 0.45) tops.push({ x: s.x, y: s.y + h * 1.8, z: s.z })
    }
  })
  tops.forEach((t, i) => {
    for (let j = 0; j < 2; j++) sesame(k, t.x + range(r, -0.08, 0.08), t.y - 0.01, t.z + range(r, -0.06, 0.06), range(r, 0, 3))
    if (i % 2 === 0) scallion(k, t.x + range(r, -0.05, 0.05), t.y - 0.005, t.z + range(r, -0.05, 0.05), 0.045, r() * 3)
  })
  return k.build()
}

/** Generic entree: plump glossy meatballs in a little tomato sauce with a sprinkle of herbs. */
export function meatballs() {
  const k = new Kit()
  const r = rng(17)
  k.add(puddle(1, 0.06), toonRamp(C.glazeDeep, C.tomato, 0.2, 1, 0.06, 0.3), {
    position: [0, 0, 0],
    scale: [W * 0.47, 0.06, D * 0.46],
    material: 'soft',
  })
  const paint = toonRamp('#8e3c26', C.meatball, -0.8, 0.6, 0.14, 0.35)
  const layers = [
    heap({ w: W * 0.88, d: D * 0.86, count: 7, seed: 5, height: 0.02, square: 2.6 }),
    heap({ w: W * 0.42, d: D * 0.36, count: 2, seed: 9, height: 0, square: 2 }).map((s) => ({ ...s, y: s.y + 0.15 })),
  ]
  const tops: { x: number; y: number; z: number }[] = []
  for (const layer of layers) {
    for (const s of layer) {
      const rad = range(r, 0.16, 0.18)
      k.add(puff(r() * 50, 0.06, 2), paint, {
        position: [s.x, s.y + rad * 0.82, s.z],
        rotation: [range(r, 0, 3), range(r, 0, 3), 0],
        scale: [rad, rad * 0.92, rad],
        material: 'soft',
      })
      tops.push({ x: s.x, y: s.y + rad * 1.7, z: s.z })
    }
  }
  // Sauce dabs and herb flecks on top
  tops.forEach((t, i) => {
    if (i % 2 === 1) {
      k.add(dome(1, i, 0), toon(C.tomato, 0.1, 0.2), {
        position: [t.x, t.y - 0.035, t.z],
        scale: [0.08, 0.035, 0.07],
        material: 'soft',
      })
    } else {
      k.add(leaf(), toon(C.herb, 0.12, 0.2), {
        position: [t.x + 0.03, t.y - 0.005, t.z - 0.02],
        rotation: [0.1, r() * 6, 0.1],
        scale: [0.05, 0.05, 0.035],
      })
    }
  })
  return k.build()
}

/** New-style builders, keyed by food id. Anything missing falls back to the old model in items.ts. */
export const MODELS: Partial<Record<FoodId, () => BuiltFood>> = {
  chickpea_curry_rice: chickpeaCurryRice,
  teriyaki_tofu_bowl: teriyakiTofuBowl,
  orange_chicken: orangeChicken,
}

/** Fallback models for unknown items, keyed by compartment. */
export const FALLBACKS: Partial<Record<Component, () => BuiltFood>> = {
  meat_alternate: meatballs,
}
