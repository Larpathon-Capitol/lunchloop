import * as THREE from 'three'
import type { BuiltFood, Paint, Place } from '../build'
import type { Component, FoodId } from '../items'
import { ball, dice, extrude, Kit, lathe, puff, range, rng, toon, toonRamp, warp } from '../build'
import { FOOD as C } from '../palette'

/*
 * Fruit. Chunky soft-toy pieces that fill the fruit well (about 1.2 wide, 1 deep): a heaped fruit cup,
 * a pile of mandarin crescents, fanned apple wedges, and spooned bananas. Glossy skins use the
 * 'soft' material. No faces.
 */


/**
 * A lathe body bent into an arc, lying on its side along x. `len` is the full length, `w` the half
 * width in the plane of the bend, `h` the half height, `R` the bend radius. Used for banana
 * and mandarin crescents. The result rests with its lowest point near y = 0.
 */
function bent(profile: [number, number][], segments: number, len: number, w: number, h: number, R: number) {
  const g = lathe(profile, segments)
  const phiMax = len / 2 / R
  const sag = (R * (1 - Math.cos(phiMax))) / 2
  return warp(g, (p) => {
    const phi = (p.y * len) / 2 / R
    const rho = R - p.x * w
    p.set(rho * Math.sin(phi), p.z * h + h, R - rho * Math.cos(phi) - sag)
  })
}

type PaintFn = Extract<Paint, (...a: never[]) => unknown>

/** Slightly deeper, juicier versions of the palette fruit colors. */
const RICH = { mandarin: '#ff8412', mandarinTop: '#ffae3a', apple: '#e8334f', banana: '#ffc520', bananaTop: '#ffdf55', cherry: '#e0233f' }

const BODY: [number, number][] = [
  [0, -1],
  [0.45, -0.93],
  [0.8, -0.72],
  [0.97, -0.36],
  [1, 0],
  [0.97, 0.36],
  [0.8, 0.72],
  [0.45, 0.93],
  [0, 1],
]

/** A plump glossy mandarin segment. */
function segment(w: number, h: number, len: number) {
  return bent(BODY, 7, len, w, h, 0.2)
}

function mandarins(): BuiltFood {
  const k = new Kit()
  const r = rng(11)
  const paint = toonRamp(RICH.mandarin, RICH.mandarinTop, 0.0, 0.22, 0.1, 0.38)
  const len = 0.52
  const w = 0.115
  const h = 0.1
  // Floor layer: rows of crescents, a little rotated and flipped so they interlock.
  const cols = [-0.38, 0.0, 0.38]
  const rows = [-0.3, -0.0, 0.3]
  let n = 0
  for (const z of rows) {
    for (const x of cols) {
      const flip = n++ % 2
      const yaw = range(r, -0.35, 0.35) + (flip ? Math.PI : 0)
      k.add(segment(w, h, len), paint, {
        position: [x + range(r, -0.04, 0.04), 0, z + range(r, -0.03, 0.03)],
        rotation: [0, yaw, 0],
        material: 'soft',
      })
    }
  }
  // Top layer: a smaller heap resting on the gaps between the first ones.
  const top: [number, number, number][] = [
    [-0.3, -0.18, 0.3],
    [0.3, -0.12, 2.9],
    [0.34, 0.2, 3.3],
    [-0.38, 0.2, 2.6],
  ]
  for (const [x, z, yaw] of top) {
    k.add(segment(w * 1.02, h * 1.02, len * 0.96), paint, {
      position: [x, 0.14, z],
      rotation: [range(r, -0.1, 0.1), yaw, range(r, -0.1, 0.1)],
      material: 'soft',
    })
  }
  // One whole mandarin on top, with a little green leaf, so it reads as mandarins.
  k.add(ball(2), toonRamp(RICH.mandarin, RICH.mandarinTop, 0.0, 0.8, 0.1, 0.38), {
    position: [-0.02, 0.2, 0.0],
    scale: [0.24, 0.19, 0.24],
    material: 'soft',
  })
  k.add(puff(4, 0.05, 1), toon(C.leaf, 0.2, 0.3), {
    position: [-0.02, 0.385, 0.0],
    rotation: [0, 0.7, 0.2],
    scale: [0.09, 0.02, 0.05],
    material: 'soft',
  })
  return k.build()
}

/** A half-moon apple wedge lying cut face up. Red skin all round, with a creamy cut face on top. */
function wedge(k: Kit, radius: number, thick: number, place: Place) {
  const bevel = 0.035
  const make = (rad: number, drop: number, height: number) => {
    const s = new THREE.Shape()
    s.absarc(0, drop, rad, 0, Math.PI, false)
    s.lineTo(rad, drop)
    const g = extrude(s, height - bevel * 2, bevel, 6, 1)
    g.rotateX(-Math.PI / 2)
    g.translate(0, bevel, 0)
    return g
  }
  const skin = toon(RICH.apple, 0.12, 0.36) as PaintFn
  const flesh = toon(C.appleFlesh, 0.1, 0.2) as PaintFn
  // Skin body: flat cut side is creamy, the rest red.
  k.add(make(radius, 0, thick), (p, n, out) => (p.z > -0.02 ? flesh : skin)(p, n, out), place)
  // Cut face: a smaller moon floating a hair above the skin, so the rim stays red.
  const inset = make(radius * 0.8, 0.0, thick + 0.012)
  inset.translate(0, 0, -0.012)
  k.add(inset, flesh, place)
}

function appleSlices(): BuiltFood {
  const k = new Kit()
  const r = rng(5)
  const R = 0.26
  const t = 0.15
  // Floor layer: two columns of three, curved edges alternating front and back.
  const cols = [-0.3, 0.3]
  const rows = [-0.28, 0.0, 0.28]
  let n = 0
  for (const z of rows) {
    for (const x of cols) {
      const flip = n++ % 2
      wedge(k, R, t, {
        position: [x + range(r, -0.03, 0.03), 0, z + range(r, -0.03, 0.03) + (flip ? -0.07 : 0.07)],
        rotation: [0, range(r, -0.14, 0.34) + (flip ? Math.PI : 0), 0],
        material: 'soft',
      })
    }
  }
  // Top layer: a fan of wedges leaning on the ones below.
  const top: [number, number, number][] = [
    [-0.28, -0.12, 0.35],
    [0.2, 0.02, 2.9],
    [-0.12, 0.28, 3.4],
  ]
  for (const [x, z, yaw] of top) {
    wedge(k, R * 0.96, t, {
      position: [x, t * 0.9, z],
      rotation: [0, yaw, 0],
      material: 'soft',
    })
  }
  return k.build()
}

/** A banana: pentagon-ish lathe bent into an arc, with a green neck and brown ends. */
function bananaGeo(len: number, thick: number) {
  const profile: [number, number][] = [
    [0, -1.06],
    [0.28, -1.03],
    [0.55, -0.9],
    [0.86, -0.62],
    [1, -0.25],
    [1, 0.15],
    [0.9, 0.55],
    [0.66, 0.8],
    [0.46, 0.93],
    [0.4, 1.04],
    [0, 1.06],
  ]
  return bent(profile, 7, len, thick, thick * 0.95, 0.85)
}

function bananaPaint(len: number): Paint {
  const body = toonRamp(RICH.banana, RICH.bananaTop, 0.0, 0.3, 0.08, 0.4) as PaintFn
  const neck = toon(C.bananaGreen, 0.12, 0.3) as PaintFn
  const tip = toon(C.bananaTip, 0.1, 0.2) as PaintFn
  const half = len / 2
  return (p, n, out) => {
    const f = p.x / half
    if (f < -0.93) tip(p, n, out)
    else if (f > 0.97) tip(p, n, out)
    else if (f > 0.82) neck(p, n, out)
    else body(p, n, out)
  }
}

function banana(): BuiltFood {
  const k = new Kit()
  const len = 1.2
  const th = 0.17
  const paint = bananaPaint(len)
  // Back banana, flat on the floor; a second one spooned in front of it, tips swapped.
  k.add(bananaGeo(len, th), paint, { position: [0.0, 0, -0.18], rotation: [0, 0, 0], material: 'soft' })
  k.add(bananaGeo(len * 0.96, th * 0.95), paint, { position: [0.0, 0, 0.2], rotation: [0, Math.PI, 0], material: 'soft' })
  // Thick banana coins tucked on top in the middle.
  const r = rng(8)
  const coin = toonRamp(C.bananaLight, C.appleFlesh, 0, 0.12, 0.35, 0.25) as PaintFn
  const rim = toon(RICH.banana, 0.1, 0.38) as PaintFn
  const spots: [number, number, number][] = [
    [-0.2, 0.0, 0.17],
    [0.08, 0.0, 0.17],
    [0.35, 0.02, 0.17],
    [-0.04, -0.01, 0.31],
  ]
  for (const [x, z, y] of spots) {
    const g = lathe(
      [
        [0, 0],
        [0.15, 0],
        [0.18, 0.025],
        [0.18, 0.1],
        [0.15, 0.125],
        [0, 0.125],
      ],
      12,
    )
    k.add(g, (p, n, out) => (n.y > 0.7 ? coin(p, n, out) : rim(p, n, out)), {
      position: [x, y - 0.02, z],
      rotation: [range(r, -0.12, 0.12), range(r, 0, 3), range(r, -0.12, 0.12)],
      material: 'soft',
    })
  }
  return k.build()
}

/** Cube colors for the fruit cup. */
const CUBES = [C.peach, C.pear, C.pineapple, C.peach, C.pear, C.grape, C.pineapple]

function fruitCup(): BuiltFood {
  const k = new Kit()
  const r = rng(29)
  const cx = -0.2
  const H = 0.36
  const r0 = 0.3
  const r1 = 0.43
  const rad = (y: number) => r0 + ((r1 - r0) * y) / H
  let n = 0
  const cube = (x: number, y: number, z: number, s = 0.085) => {
    const color = CUBES[n++ % CUBES.length]
    k.add(dice(1, 0.88), toon(color, 0.14, 0.34), {
      position: [x, y, z],
      rotation: [range(r, -0.5, 0.5), range(r, 0, 3), range(r, -0.5, 0.5)],
      scale: s * range(r, 0.95, 1.1),
      material: 'soft',
    })
  }
  const ring = (y: number, count: number, inset: number, phase: number) => {
    for (let i = 0; i < count; i++) {
      const a = phase + (i / count) * Math.PI * 2
      const d = rad(y) - inset
      cube(cx + Math.cos(a) * d, y, Math.sin(a) * d)
    }
  }
  // Cubes packed inside the cup, bottom to top, then a dome above the rim.
  cube(cx, 0.09, 0)
  cube(cx, 0.2, 0)
  ring(0.2, 6, 0.1, 0.9)
  ring(0.31, 6, 0.11, 0.1)
  cube(cx, 0.31, 0)
  ring(0.4, 5, 0.19, 0.6)
  cube(cx, 0.43, 0)
  // Cherry on top.
  k.add(ball(2), toon(RICH.cherry, 0.14, 0.34), { position: [cx + 0.02, 0.5, 0.01], scale: [0.09, 0.085, 0.09], material: 'soft' })
  k.add(lathe([[0, 0], [0.012, 0], [0.012, 0.12], [0, 0.12]], 5), toon(C.leaf, 0.1, 0.2), {
    position: [cx + 0.02, 0.54, 0.01],
    rotation: [0.5, 0, -0.4],
  })

  // Loose cubes spilling out to the right, in two layers, so the well looks full.
  const loose: [number, number, number][] = [
    [0.4, -0.3, 0.085],
    [0.55, -0.12, 0.085],
    [0.52, 0.2, 0.085],
    [0.3, 0.24, 0.085],
    [0.48, -0.36, 0.085],
    [0.47, 0.07, 0.19],
    [0.36, -0.2, 0.19],
  ]
  for (const [x, z, y] of loose) cube(x, y, z, 0.08)

  // Clear cup with a rolled rim.
  const wall = 0.012
  const cup = lathe(
    [
      [0, 0],
      [r0 - 0.03, 0],
      [r0, 0.02],
      [r1, H],
      [r1 - wall, H],
      [r0 - wall, 0.02 + wall],
      [0, 0.02 + wall],
    ],
    20,
  )
  k.add(cup, C.cup, { position: [cx, 0, 0], material: 'clear' })
  const rim = new THREE.TorusGeometry(r1, 0.02, 5, 20)
  rim.rotateX(Math.PI / 2)
  k.add(rim, C.cup, { position: [cx, H, 0], material: 'clear' })
  return k.build()
}

/** Generic fruit: two plump red apples and a cut half showing creamy flesh. */
function genericFruit(): BuiltFood {
  const k = new Kit()
  const r = rng(3)
  const appleProfile: [number, number][] = [
    [0, 0],
    [0.2, 0.012],
    [0.3, 0.08],
    [0.35, 0.22],
    [0.33, 0.37],
    [0.25, 0.44],
    [0.1, 0.43],
    [0, 0.37],
  ]
  const apple = (x: number, z: number, color: string, yaw: number, s = 1) => {
    k.add(lathe(appleProfile, 14), toonRamp(color, '#f2506a', 0.0, 0.5, 0.1, 0.38), {
      position: [x, 0, z],
      rotation: [0, yaw, range(r, -0.06, 0.06)],
      scale: s,
      material: 'soft',
    })
    k.add(lathe([[0, 0], [0.025, 0], [0.025, 0.12], [0, 0.12]], 5), toon(C.stem, 0.1, 0.2), {
      position: [x, 0.36 * s, z],
      rotation: [0.2, 0, 0.15],
      scale: s,
    })
  }
  apple(-0.3, -0.2, RICH.apple, 0.3, 0.92)
  apple(0.32, 0.0, RICH.cherry, 1.1, 0.88)
  // Leaf
  k.add(puff(2, 0.05, 1), toon(C.leaf, 0.25, 0.3), {
    position: [-0.1, 0.4, -0.2],
    rotation: [0, 0.6, 0.35],
    scale: [0.13, 0.025, 0.07],
    material: 'soft',
  })
  // Cut half in front, flesh up.
  const half = lathe(
    [
      [0, 0],
      [0.2, 0.01],
      [0.31, 0.07],
      [0.35, 0.16],
      [0.33, 0.235],
      [0.3, 0.255],
      [0.2, 0.26],
      [0, 0.26],
    ],
    14,
  )
  const skin = toon(RICH.apple, 0.12, 0.36) as PaintFn
  const flesh = toon(C.appleFlesh, 0.2, 0.2) as PaintFn
  k.add(ball(1), '#f3d79a', { position: [-0.28, 0.262, 0.27], scale: [0.07, 0.012, 0.07], material: 'soft' })
  k.add(half, (p, n, out) => (p.y > 0.245 && Math.hypot(p.x, p.z) < 0.31 ? flesh(p, n, out) : skin(p, n, out)), {
    position: [-0.28, 0, 0.27],
    material: 'soft',
  })
  // A second whole fruit tucked at the back right, so the well reads full.
  apple(0.32, -0.3, RICH.apple, 2.2, 0.7)
  return k.build()
}

/** New-style builders, keyed by food id. Anything missing falls back to the old model in items.ts. */
export const MODELS: Partial<Record<FoodId, () => BuiltFood>> = {
  fruit_cup: fruitCup,
  mandarin_oranges: mandarins,
  apple_slices: appleSlices,
  banana,
}

/** Fallback models for unknown items, keyed by compartment. */
export const FALLBACKS: Partial<Record<Component, () => BuiltFood>> = {
  fruit: genericFruit,
}
