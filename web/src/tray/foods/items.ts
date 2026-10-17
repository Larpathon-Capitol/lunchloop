import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import {
  alignUp,
  ball,
  blob,
  dice,
  extrude,
  Kit,
  lathe,
  mix,
  noise3,
  range,
  rng,
  smooth,
  smoothstep,
  warp,
  type BuiltFood,
} from './build'
import type { Component } from '../../shared/api'
import { FOOD as C } from './palette'

/*
 * One builder per menu item. Units: each item fits a 1 by 1 footprint centered on the origin and
 * rests on y = 0. Shapes are drawn chunky on purpose: they have to read at phone size.
 */

/** Lays a shape-plane (XY) geometry flat on the floor: shape +y becomes world -z (away). */
const flat = (g: THREE.BufferGeometry) => g.rotateX(-Math.PI / 2)

// ---------------------------------------------------------------- entrees

function pizza() {
  const k = new Kit()
  const tipY = -0.42
  const R = 0.84
  const half = THREE.MathUtils.degToRad(27)
  const wedge = (inset: number, r: number, h: number) => {
    const s = new THREE.Shape()
    s.moveTo(0, tipY + inset)
    s.absarc(0, tipY, r, Math.PI / 2 - h, Math.PI / 2 + h, false)
    s.lineTo(0, tipY + inset)
    return s
  }
  // Dough base
  const dough = flat(extrude(wedge(0, R - 0.02, half), 0.04, 0.016, 24))
  k.add(dough, C.crust, { position: [0, 0.016, 0] })
  // Melted cheese, inset from the edge, with softly rounded sides
  const cheese = flat(extrude(wedge(0.05, R - 0.07, half - 0.03), 0.02, 0.014, 24))
  k.add(cheese, C.cheese, { position: [0, 0.07, 0] })
  // Crust lip: a puffy partial torus along the arc
  const arc = half * 2 + 0.06
  const lip = new THREE.TorusGeometry(R - 0.06, 0.055, 12, 36, arc)
  lip.rotateZ(Math.PI / 2 - half - 0.03)
  lip.scale(1, 1, 1.25)
  lip.translate(0, tipY, 0.07)
  k.add(flat(smooth(lip)), (_p, n, out) => mix(out, C.crust, C.crustDeep, smoothstep(0.1, 0.9, n.y) * 0.85))
  // Bubbles and toasty spots on the cheese
  const r = rng(11)
  const spots: [number, number][] = [
    [-0.05, 0.16],
    [0.09, 0.02],
    [-0.02, -0.14],
    [0.12, -0.22],
    [-0.13, -0.2],
    [0.02, -0.3],
    [0.0, 0.3],
  ]
  spots.forEach(([x, z], i) => {
    const s = range(r, 0.035, 0.06)
    k.add(blob(2, 40 + i, 0.15), (p, _n, out) => mix(out, C.cheese, C.cheeseDeep, smoothstep(0.3, 1, p.y) * 0.7), {
      position: [x, 0.105, z],
      scale: [s, s * 0.4, s * 0.9],
    })
    if (i % 3 === 1) {
      k.add(ball(1), C.cheeseToast, { position: [x + 0.05, 0.103, z + 0.04], scale: [0.022, 0.006, 0.018] })
    }
  })
  // Two cheese drips over the side
  for (const [x, z] of [
    [0.19, 0.0],
    [-0.12, 0.2],
  ] as const) {
    k.add(ball(2), C.cheese, { position: [x, 0.07, z], scale: [0.03, 0.05, 0.03] })
  }
  return k.build()
}

function nachos() {
  const k = new Kit()
  const r = rng(7)
  const chipShape = (() => {
    const s = new THREE.Shape()
    const pts = [0, 1, 2].map((i) => {
      const a = Math.PI / 2 + (i * Math.PI * 2) / 3
      return new THREE.Vector2(Math.cos(a) * 0.17, Math.sin(a) * 0.17)
    })
    const round = 0.22
    for (let i = 0; i < 3; i++) {
      const a = pts[i]
      const b = pts[(i + 1) % 3]
      const c = pts[(i + 2) % 3]
      const start = a.clone().lerp(b, round)
      const end = b.clone().lerp(a, round)
      if (i === 0) s.moveTo(start.x, start.y)
      else s.lineTo(start.x, start.y)
      s.lineTo(end.x, end.y)
      const next = b.clone().lerp(c, round)
      s.quadraticCurveTo(b.x, b.y, next.x, next.y)
    }
    return s
  })()
  const chip = () =>
    warp(flat(extrude(chipShape, 0.012, 0.007, 4, 1)), (p) => {
      p.y += -0.6 * (p.x * p.x * 0.6 + p.z * p.z) + 0.02
    })

  const H = 0.24
  const Rd = 0.43
  const dome = (x: number, z: number) => H * Math.max(0, 1 - (x * x + z * z) / (Rd * Rd))
  const domeNormal = (x: number, z: number) =>
    new THREE.Vector3((2 * H * x) / (Rd * Rd), 1, (2 * H * z) / (Rd * Rd)).normalize()
  const spots: [number, number][] = [[0, 0]]
  for (let i = 0; i < 3; i++) spots.push([Math.cos((i / 3) * Math.PI * 2 + 1) * 0.07, Math.sin((i / 3) * Math.PI * 2 + 1) * 0.07])
  for (let i = 0; i < 5; i++) spots.push([Math.cos((i / 5) * Math.PI * 2 + 0.4) * 0.17, Math.sin((i / 5) * Math.PI * 2 + 0.4) * 0.17])
  for (let i = 0; i < 9; i++) spots.push([Math.cos((i / 9) * Math.PI * 2) * 0.33, Math.sin((i / 9) * Math.PI * 2) * 0.33])
  spots.forEach(([x, z], i) => {
    const n = domeNormal(x, z).lerp(new THREE.Vector3(range(r, -0.4, 0.4), 1, range(r, -0.4, 0.4)).normalize(), 0.45).normalize()
    const tint = range(r, 0, 1)
    k.add(chip(), (p, _n, out) => mix(out, C.chip, C.chipDeep, tint * 0.6 + smoothstep(0.1, 0.17, Math.hypot(p.x, p.z)) * 0.4), {
      position: [x, dome(x, z) - 0.035 + (i === 0 ? 0.02 : 0), z],
      quaternion: alignUp(n, range(r, 0, Math.PI * 2)),
      scale: range(r, 0.92, 1.12),
    })
  })
  // Cheese drizzle: two zigzag ribbons laid across the pile
  for (const [seed, turn] of [
    [3, 0.5],
    [5, -0.9],
  ] as const) {
    const pts: THREE.Vector3[] = []
    const cos = Math.cos(turn)
    const sin = Math.sin(turn)
    for (let i = 0; i <= 40; i++) {
      const t = i / 40
      const u = (t - 0.5) * 0.62
      const v = 0.2 * Math.sin(t * Math.PI * 4.5) * Math.sin(t * Math.PI) + 0.02 * noise3(t * 8, 0, 0, seed)
      const x = u * cos - v * sin
      const z = u * sin + v * cos
      pts.push(new THREE.Vector3(x, dome(x, z) + 0.004, z))
    }
    const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 90, 0.019, 6, false)
    k.add(smooth(tube), C.cheeseDeep)
  }
  k.add(blob(3, 9, 0.2), C.cheeseDeep, { position: [0.02, dome(0, 0) + 0.02, 0.02], scale: [0.09, 0.035, 0.08] })
  // Beef crumbles
  for (let i = 0; i < 10; i++) {
    const a = range(r, 0, Math.PI * 2)
    const d = range(r, 0, 0.3)
    const x = Math.cos(a) * d
    const z = Math.sin(a) * d
    const s = range(r, 0.028, 0.042)
    k.add(blob(1, 60 + i, 0.3), (p, _n, out) => mix(out, C.beef, C.patty, smoothstep(-0.5, 0.5, noise3(p.x * 3, p.y * 3, p.z * 3, i))), {
      position: [x, dome(x, z) + 0.035, z],
      scale: [s, s * 0.75, s],
      rotation: [range(r, 0, 3), range(r, 0, 3), 0],
    })
  }
  return k.build()
}

function friedPaint(seed: number) {
  return (p: THREE.Vector3, n: THREE.Vector3, out: THREE.Color) => {
    const speck = noise3(p.x * 9, p.y * 9, p.z * 9, seed)
    mix(out, C.fry, C.fryLight, smoothstep(0.1, 0.9, n.y) * 0.55)
    out.lerp(new THREE.Color(C.fryDeep), smoothstep(0.25, 0.75, speck) * 0.55)
  }
}

function nuggets() {
  const k = new Kit()
  const r = rng(21)
  const spots: [number, number, number, number][] = [
    [-0.22, 0.12, 0.3, 0],
    [0.04, 0.2, 1.4, 0],
    [0.26, 0.04, 2.6, 0],
    [-0.08, -0.16, 0.9, 0],
    [0.12, -0.12, 2.0, 0.09],
  ]
  spots.forEach(([x, z, ry, lift], i) => {
    const g = blob(6, 100 + i, 0.2, 0.035, 7)
    k.add(g, friedPaint(i), {
      position: [x, 0.07 + lift, z],
      rotation: [lift ? 0.35 : 0, ry, lift ? 0.2 : 0],
      scale: [range(r, 0.15, 0.18), 0.075, range(r, 0.115, 0.135)],
    })
  })
  return k.build()
}

function popcornChicken() {
  const k = new Kit()
  const r = rng(33)
  const spots: [number, number, number][] = []
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.3
    spots.push([Math.cos(a) * 0.26, 0, Math.sin(a) * 0.24])
  }
  spots.push([0.02, 0.07, 0.05], [-0.1, 0.08, -0.06], [0.11, 0.08, -0.05], [0.0, 0.14, -0.01])
  spots.forEach(([x, y, z], i) => {
    const s = range(r, 0.085, 0.105)
    k.add(blob(4, 200 + i, 0.3, 0.07, 8), friedPaint(i + 50), {
      position: [x + range(r, -0.03, 0.03), s * 0.8 + y, z + range(r, -0.03, 0.03)],
      rotation: [range(r, 0, 3), range(r, 0, 3), range(r, 0, 3)],
      scale: [s * 1.1, s * 0.85, s],
    })
  })
  return k.build()
}

/** Bun pair shared by the burger and the sandwich. Returns the height where the top bun starts. */
function bun(k: Kit, top: number, radius: number, color: { top: string; side: string }, seeds: boolean) {
  const bottom = lathe(
    [
      [0, 0],
      [radius - 0.04, 0],
      [radius - 0.01, 0.015],
      [radius, 0.05],
      [radius - 0.015, 0.085],
      [radius - 0.03, 0.09],
      [0, 0.09],
    ],
    40,
  )
  k.add(bottom, (p, n, out) => mix(out, color.side, C.crumb, smoothstep(0.6, 0.9, n.y) * (p.y > 0.08 ? 1 : 0)))
  // Top bun: half an ellipsoid with a soft tucked lip
  const prof: [number, number][] = []
  const b = 0.2
  for (let i = 0; i <= 12; i++) {
    const phi = (i / 12) * THREE.MathUtils.degToRad(96)
    prof.push([radius * Math.sin(phi), 0.02 + b * Math.cos(phi)])
  }
  prof.push([radius - 0.02, 0], [0, 0])
  const dome = lathe(prof.reverse(), 44)
  k.add(dome, (p, _n, out) => mix(out, color.side, color.top, smoothstep(0.02, 0.12, p.y)), {
    position: [0, top, 0],
    material: 'soft',
  })
  if (seeds) {
    const r = rng(5)
    for (let i = 0; i < 18; i++) {
      const phi = Math.sqrt(range(r, 0.02, 0.5)) * 1.25
      const th = range(r, 0, Math.PI * 2)
      const x = radius * Math.sin(phi) * Math.cos(th)
      const z = radius * Math.sin(phi) * Math.sin(th)
      const y = 0.02 + b * Math.cos(phi)
      const n = new THREE.Vector3(x / (radius * radius), y / (b * b), z / (radius * radius)).normalize()
      k.add(ball(1), C.sesame, {
        position: [x, top + y + 0.002, z],
        quaternion: alignUp(n, range(r, 0, 3)),
        scale: [0.019, 0.008, 0.011],
      })
    }
  }
}

function burger() {
  const k = new Kit()
  const R = 0.3
  bun(k, 0.215, R, { top: C.bunTop, side: C.bunSide }, true)
  // Patty with a seared, uneven edge
  const patty = warp(
    lathe(
      [
        [0, 0],
        [R + 0.01, 0],
        [R + 0.035, 0.02],
        [R + 0.04, 0.045],
        [R + 0.025, 0.07],
        [0, 0.075],
      ],
      44,
    ),
    (p) => {
      const a = Math.atan2(p.z, p.x)
      const d = 1 + 0.035 * noise3(Math.cos(a) * 3, Math.sin(a) * 3, p.y * 6, 4)
      p.x *= d
      p.z *= d
    },
  )
  k.add(patty, (p, _n, out) => mix(out, C.patty, C.pattyLight, smoothstep(-0.3, 0.6, noise3(p.x * 14, p.y * 14, p.z * 14, 2)) * 0.6), {
    position: [0, 0.088, 0],
  })
  // Cheese slice, turned 45 degrees so its corners droop over the patty
  const slice = new THREE.BoxGeometry(0.6, 0.016, 0.6, 14, 1, 14)
  warp(slice, (p) => {
    const d = Math.hypot(p.x, p.z)
    const over = Math.max(0, d - R + 0.02)
    p.y -= over * over * 7 + over * 0.3
  })
  k.add(smooth(slice), C.cheese, { position: [0, 0.168, 0], rotation: [0, Math.PI / 4, 0] })
  // Lettuce frill
  const lettuce = warp(
    lathe(
      [
        [0, 0],
        [R + 0.03, 0],
        [R + 0.05, 0.008],
        [R + 0.03, 0.016],
        [0, 0.016],
      ],
      72,
    ),
    (p) => {
      const a = Math.atan2(p.z, p.x)
      const d = Math.hypot(p.x, p.z) / (R + 0.05)
      p.y += 0.022 * Math.sin(a * 11) * d * d * d
    },
  )
  k.add(lettuce, C.lettuce, { position: [0, 0.188, 0] })
  return k.build()
}

const tmpGlaze = new THREE.Color()
const tmpGlazeHi = new THREE.Color()

function spicySandwich() {
  const k = new Kit()
  const R = 0.27
  bun(k, 0.2, R, { top: C.brioche, side: C.bunSide }, false)
  // Crispy fillet, wider than the bun so it pokes out on both sides
  const fillet = blob(6, 77, 0.22, 0.09, 9)
  k.add(
    fillet,
    (p, n, out) => {
      const crisp = noise3(p.x * 11, p.y * 11, p.z * 11, 3)
      // Golden fried crust on the sides, red-orange glaze pooled on top
      mix(out, C.fry, C.fryDeep, smoothstep(0.1, 0.7, crisp) * 0.6)
      const glazed = smoothstep(0.15, 0.6, n.y + 0.25 * noise3(p.x * 4, p.y * 4, p.z * 4, 8))
      out.lerp(tmpGlaze.set(C.glaze).lerp(tmpGlazeHi.set(C.glazeLight), smoothstep(0.8, 1, n.y) * 0.5), glazed)
      out.lerp(tmpGlazeHi.set(C.glazeDeep), smoothstep(0.3, 0.8, crisp) * glazed * 0.4)
    },
    { position: [0.03, 0.15, 0], rotation: [0, 0.35, 0], scale: [0.38, 0.1, 0.27], material: 'soft' },
  )
  // Pickle chips peeking out
  for (const [x, z, a] of [
    [-0.13, 0.17, 0.2],
    [0.1, 0.2, -0.15],
  ] as const) {
    const pickle = lathe(
      [
        [0, 0],
        [0.065, 0],
        [0.07, 0.006],
        [0.065, 0.012],
        [0, 0.012],
      ],
      24,
    )
    k.add(pickle, (p, n, out) => mix(out, C.pickle, C.stalk, smoothstep(0.03, 0.05, Math.hypot(p.x, p.z)) * (n.y > 0.5 ? 0.6 : 0)), {
      position: [x, 0.196, z],
      rotation: [a, 0, 0.1],
    })
  }
  return k.build()
}

function meatballs() {
  const k = new Kit()
  const spots: [number, number, number][] = [
    [-0.17, 0.08, 0.13],
    [0.17, 0.06, 0.12],
    [0.0, -0.15, 0.135],
  ]
  spots.forEach(([x, z, s], i) => {
    k.add(
      blob(5, 300 + i, 0.08, 0.03, 8),
      (p, n, out) => {
        mix(out, C.meatball, C.glazeLight, smoothstep(0.6, 1, n.y) * 0.25)
        out.lerp(new THREE.Color(C.patty), 0.35 + smoothstep(0.2, 0.8, noise3(p.x * 5, p.y * 5, p.z * 5, i)) * 0.35)
      },
      { position: [x, s * 0.92, z], scale: [s, s * 0.92, s], material: 'soft' },
    )
  })
  const r = rng(9)
  for (let i = 0; i < 12; i++) {
    const [x, z, s] = spots[i % 3]
    const a = range(r, 0, Math.PI * 2)
    const phi = range(r, 0.1, 0.8)
    const n = new THREE.Vector3(Math.sin(phi) * Math.cos(a), Math.cos(phi), Math.sin(phi) * Math.sin(a))
    k.add(ball(1), C.sesame, {
      position: [x + n.x * s, s * 0.92 + n.y * s * 0.92, z + n.z * s],
      quaternion: alignUp(n, range(r, 0, 3)),
      scale: [0.016, 0.007, 0.01],
    })
  }
  return k.build()
}

// ---------------------------------------------------------------- grains

function dinnerRolls() {
  const k = new Kit()
  const roll = (seed: number) =>
    warp(blob(6, seed, 0.06), (p) => {
      if (p.y < 0) p.y *= 0.35
      // Gentle split across the top
      p.y -= 0.12 * Math.exp(-((p.x / 0.12) ** 2)) * smoothstep(0.3, 0.9, p.y)
    })
  const paint = (p: THREE.Vector3, _n: THREE.Vector3, out: THREE.Color) =>
    mix(out, C.rollBase, C.rollTop, smoothstep(0.05, 0.6, p.y) * (1 - 0.35 * Math.exp(-((p.x / 0.1) ** 2))))
  k.add(roll(1), paint, { position: [-0.17, 0.06, 0.08], rotation: [0, 0.5, 0], scale: [0.22, 0.17, 0.19], material: 'soft' })
  k.add(roll(2), paint, { position: [0.18, 0.06, -0.08], rotation: [0, -0.3, 0], scale: [0.21, 0.16, 0.18], material: 'soft' })
  return k.build()
}

function brownRice() {
  const k = new Kit()
  const a = 0.36
  const b = 0.2
  const prof: [number, number][] = []
  for (let i = 0; i <= 16; i++) {
    const phi = (i / 16) * (Math.PI / 2)
    prof.push([a * Math.sin(phi) * (1 + 0.08 * Math.sin(phi * 2)), b * Math.cos(phi)])
  }
  prof.push([0, 0])
  k.add(lathe(prof, 40), C.rice)
  // Grains scattered evenly over the dome (golden-angle spiral)
  const r = rng(13)
  const count = 190
  const shades = [C.riceLight, C.rice, C.riceLight, C.rice, C.riceDeep, C.riceLight]
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count
    const phi = Math.acos(1 - t * 0.98)
    const th = i * 2.39996
    const x = a * Math.sin(phi) * Math.cos(th)
    const z = a * Math.sin(phi) * Math.sin(th)
    const y = b * Math.cos(phi)
    const n = new THREE.Vector3(x / (a * a), y / (b * b), z / (a * a)).normalize()
    const shade = shades[Math.floor(r() * shades.length)]
    k.add(ball(0), shade, {
      position: [x * 1.02, y + 0.004, z * 1.02],
      quaternion: alignUp(n, range(r, 0, Math.PI * 2)),
      scale: [0.036, 0.014, 0.016],
    })
  }
  return k.build()
}

function breadSlices() {
  const k = new Kit()
  const loaf = (s: number) => {
    const sh = new THREE.Shape()
    sh.moveTo(-0.17 * s, -0.2 * s)
    sh.lineTo(0.17 * s, -0.2 * s)
    sh.quadraticCurveTo(0.2 * s, -0.2 * s, 0.2 * s, -0.17 * s)
    sh.lineTo(0.2 * s, 0.07 * s)
    sh.absarc(0.12 * s, 0.11 * s, 0.11 * s, -0.4, Math.PI * 0.95, false)
    sh.absarc(-0.12 * s, 0.11 * s, 0.11 * s, Math.PI * 0.05, Math.PI + 0.4, false)
    sh.lineTo(-0.2 * s, -0.17 * s)
    sh.quadraticCurveTo(-0.2 * s, -0.2 * s, -0.17 * s, -0.2 * s)
    return sh
  }
  for (const [x, z, ry, y] of [
    [-0.07, 0.06, 0.25, 0],
    [0.08, -0.06, -0.2, 0.05],
  ] as const) {
    k.add(flat(extrude(loaf(1.1), 0.03, 0.012, 7, 2)), C.breadCrust, { position: [x, y + 0.012, z], rotation: [0, ry, 0] })
    k.add(flat(extrude(loaf(0.98), 0.03, 0.01, 7, 2)), C.bread, { position: [x, y + 0.02, z], rotation: [0, ry, 0] })
  }
  return k.build()
}

// ---------------------------------------------------------------- vegetables

function carrots() {
  const k = new Kit()
  const R = 0.085
  const h = 0.02
  const core = R * 0.5
  const coin = () =>
    smooth(
      new THREE.LatheGeometry(
        (
          [
            [0, -h],
            [core - 0.002, -h],
            [core + 0.002, -h],
            [R - 0.012, -h],
            [R, -h + 0.008],
            [R + 0.002, 0],
            [R, h - 0.008],
            [R - 0.012, h],
            [core + 0.002, h],
            [core - 0.002, h],
            [0, h],
          ] as const
        ).map(([x, y]) => new THREE.Vector2(x, y)),
        16,
      ),
      1e-5,
    )
  const paint = (p: THREE.Vector3, n: THREE.Vector3, out: THREE.Color) => {
    const rad = Math.hypot(p.x, p.z)
    out.set(Math.abs(n.y) > 0.5 && rad < core + 0.0005 ? C.carrotCore : C.carrot)
    if (Math.abs(n.y) < 0.5) out.lerp(new THREE.Color(C.cheeseToast), 0.15)
  }
  const r = rng(3)
  const H = 0.13
  const Rd = 0.36
  const spots: [number, number][] = [[0, 0]]
  for (let i = 0; i < 6; i++) spots.push([Math.cos(i + 0.3) * 0.14, Math.sin(i + 0.3) * 0.14])
  for (let i = 0; i < 9; i++) spots.push([Math.cos((i / 9) * 6.28) * 0.27, Math.sin((i / 9) * 6.28) * 0.27])
  spots.forEach(([x, z]) => {
    const d2 = (x * x + z * z) / (Rd * Rd)
    const y = H * Math.max(0, 1 - d2) + h
    const n = new THREE.Vector3(x * 0.8, 1, z * 0.8).normalize().lerp(new THREE.Vector3(range(r, -1, 1), 1, range(r, -1, 1)).normalize(), 0.5)
    k.add(coin(), paint, { position: [x, y, z], quaternion: alignUp(n.normalize(), 0), scale: range(r, 0.9, 1.1) })
  })
  return k.build()
}

function floret(k: Kit, seed: number, place: { x: number; z: number; tilt: number; turn: number; s: number }) {
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(place.x, 0, place.z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(place.tilt, place.turn, 0, 'YXZ')),
    new THREE.Vector3(place.s, place.s, place.s),
  )
  const stalk = lathe(
    [
      [0, 0],
      [0.05, 0],
      [0.056, 0.012],
      [0.045, 0.1],
      [0.06, 0.17],
      [0.09, 0.2],
      [0, 0.2],
    ],
    14,
  )
  stalk.applyMatrix4(m)
  k.add(stalk, (p, _n, out) => mix(out, C.stalk, C.broccoliLight, smoothstep(0.05, 0.2, p.y)))
  const crown: [number, number, number, number][] = [
    [0, 0.31, 0, 0.11],
    [0.09, 0.26, 0.04, 0.085],
    [-0.08, 0.26, 0.06, 0.085],
    [0.02, 0.25, -0.09, 0.085],
    [-0.05, 0.28, -0.04, 0.08],
  ]
  crown.forEach(([x, y, z, s], i) => {
    const g = blob(3, seed * 10 + i, 0.1, 0.16, 5)
    g.scale(s, s * 0.85, s)
    g.translate(x, y, z)
    g.applyMatrix4(m)
    k.add(g, (p, _n, out) => {
      const v = noise3(p.x * 40, p.y * 40, p.z * 40, seed + i)
      mix(out, C.broccoliDeep, C.broccoli, smoothstep(-0.6, 0.4, v))
      out.lerp(new THREE.Color(C.broccoliLight), smoothstep(0.35, 0.8, v) * 0.6)
    })
  })
}

function broccoli() {
  const k = new Kit()
  floret(k, 1, { x: 0.02, z: -0.15, tilt: -0.15, turn: 0.2, s: 1.15 })
  floret(k, 2, { x: -0.2, z: 0.13, tilt: 0.45, turn: -0.9, s: 0.95 })
  floret(k, 3, { x: 0.22, z: 0.14, tilt: 0.5, turn: 0.9, s: 0.95 })
  return k.build()
}

function greenBeans() {
  const k = new Kit()
  const r = rng(17)
  for (let i = 0; i < 8; i++) {
    const bean = warp(smooth(new THREE.CapsuleGeometry(0.03, 0.36, 4, 10)), (p) => {
      p.x += 0.25 * (p.y * p.y - 0.04) * (i % 2 ? 1 : -1)
      // Little bumps where the seeds sit
      p.z += 0.004 * Math.sin(p.y * 40) * Math.max(0, p.z / 0.03)
    })
    const y = i < 5 ? 0.03 : 0.08
    k.add(bean, (_p, n, out) => mix(out, C.bean, C.beanLight, smoothstep(0, 1, n.x * 0.5 + n.y) * 0.5), {
      position: [range(r, -0.2, 0.2), y, range(r, -0.2, 0.2)],
      rotation: [Math.PI / 2, 0, range(r, -0.6, 0.6) + (i % 3) * 1.2],
    })
  }
  return k.build()
}

// ---------------------------------------------------------------- fruit

function fruitCup() {
  const k = new Kit()
  const H = 0.36
  const r0 = 0.2
  const r1 = 0.28
  const radiusAt = (y: number) => r0 + ((r1 - r0) * y) / H
  // Diced fruit first, so it is drawn before the clear cup
  const r = rng(29)
  const fruits = [C.peach, C.pear, C.peach, C.pineapple, C.cherry, C.pear, C.grape, C.peach]
  let n = 0
  for (let layer = 0; layer < 4; layer++) {
    const y = 0.05 + layer * 0.085
    const count = layer === 3 ? 7 : 6
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + layer * 0.7
      const d = layer === 3 && i === 0 ? 0 : radiusAt(y) - 0.07
      const color = fruits[n++ % fruits.length]
      const isRound = color === C.cherry || color === C.grape
      const s = isRound ? 0.042 : 0.045
      k.add(isRound ? ball(2) : dice(2), color, {
        position: [Math.cos(a) * d, y, Math.sin(a) * d],
        rotation: [range(r, 0, 1), range(r, 0, 3), range(r, 0, 1)],
        scale: isRound ? s * 1.05 : s,
      })
    }
  }
  // A cherry on top
  k.add(ball(3), C.cherry, { position: [0.02, 0.37, 0.02], scale: 0.05 })
  // Clear plastic cup with a rolled rim
  const wall = 0.008
  const cup = lathe(
    [
      [0, 0],
      [r0 - 0.02, 0],
      [r0, 0.012],
      [r1, H],
      [r1 - wall, H],
      [r0 - wall, 0.012 + wall],
      [0, 0.012 + wall],
    ],
    36,
  )
  k.add(cup, C.cup, { material: 'clear' })
  const rim = new THREE.TorusGeometry(r1, 0.012, 6, 36)
  rim.rotateX(Math.PI / 2)
  rim.translate(0, H, 0)
  k.add(smooth(rim), C.cup, { material: 'clear' })
  return k.build()
}

function mandarins() {
  const k = new Kit()
  const segment = (seed: number) => {
    const Rb = 0.13
    return warp(ball(5), (p) => {
      // Ellipsoid: plump outer back (-z), slimmer inner edge (+z), flatter underneath
      const taper = 1 - 0.35 * p.x * p.x
      let x = p.x * 0.15
      let y = p.y * (p.y < 0 ? 0.035 : 0.08) * taper
      let z = p.z * (p.z < 0 ? 0.085 : 0.04) * taper
      const lump = 1 + 0.03 * noise3(p.x * 4, p.y * 4, p.z * 4, seed)
      x *= lump
      y *= lump
      z *= lump
      // Bend into a crescent around a center on the +z side
      const a = x / Rb
      p.set((Rb - z) * Math.sin(a), y, Rb - (Rb - z) * Math.cos(a))
    })
  }
  const paint = (p: THREE.Vector3, n: THREE.Vector3, out: THREE.Color) => {
    mix(out, C.mandarin, C.mandarinLight, smoothstep(0.3, 1, n.y) * 0.5 + smoothstep(-0.01, 0.05, p.z) * 0.35)
    // A faint pale vein along the ridge
    out.lerp(new THREE.Color(C.mandarinLight), Math.exp(-(((p.z + 0.03) / 0.008) ** 2)) * smoothstep(0.03, 0.06, p.y) * 0.6)
  }
  const count = 6
  for (let i = 0; i < count; i++) {
    const a = THREE.MathUtils.degToRad(-80 + (160 * i) / (count - 1))
    // Segments sit side by side like a fan, each turned a little more than the last
    const dir = new THREE.Vector3(Math.sin(a), 0, -Math.cos(a))
    const center = new THREE.Vector3(0, 0, 0.16).addScaledVector(dir, 0.24)
    k.add(segment(i), paint, {
      position: [center.x, 0.035 + (i % 2) * 0.01, center.z],
      rotation: [0, Math.PI / 2 - a, (i % 2 ? 1 : -1) * 0.05],
    })
  }
  return k.build()
}

function apple() {
  const k = new Kit()
  const prof: [number, number][] = []
  for (let i = 0; i <= 20; i++) {
    const t = i / 20
    const ang = t * Math.PI
    const rr = 0.25 * Math.sin(ang) * (1 + 0.12 * Math.sin(ang * 1.2 - 0.3))
    let y = 0.26 * (1 - Math.cos(ang))
    // Dimples at the top and bottom
    if (t < 0.12) y += 0.04 * (1 - t / 0.12)
    if (t > 0.88) y -= 0.05 * (1 - (1 - t) / 0.12)
    prof.push([rr, y])
  }
  prof[0][0] = 0
  prof[prof.length - 1][0] = 0
  k.add(lathe(prof, 40), (p, _n, out) => mix(out, C.apple, C.appleBlush, smoothstep(-0.1, 0.25, p.x + p.z * 0.5) * 0.6), {
    material: 'soft',
  })
  const stem = new THREE.CylinderGeometry(0.012, 0.016, 0.12, 8)
  stem.translate(0, 0.06, 0)
  k.add(smooth(stem), C.stem, { position: [0, 0.44, 0], rotation: [0, 0, -0.25] })
  const leaf = warp(ball(3), (p) => {
    p.set(p.x * 0.09, p.y * 0.012 + 0.03 * p.x * p.x, p.z * 0.04)
  })
  k.add(leaf, C.leaf, { position: [0.09, 0.51, 0], rotation: [0, 0.3, 0.35] })
  return k.build()
}

// ---------------------------------------------------------------- milk

function carton(panel: string, accent: string, plain = false) {
  const k = new Kit()
  const W = 0.44
  const Hb = 0.5
  const body = new RoundedBoxGeometry(W, Hb, W, 3, 0.03)
  k.add(smooth(body), C.carton, { position: [0, Hb / 2, 0] })
  // Printed panel wrapping the lower body
  const band = new RoundedBoxGeometry(W + 0.012, 0.3, W + 0.012, 3, 0.036)
  k.add(smooth(band), panel, { position: [0, 0.2, 0] })
  // Gable roof
  const roofH = 0.15
  const tri = new THREE.Shape()
  tri.moveTo(-W / 2 + 0.01, 0)
  tri.lineTo(W / 2 - 0.01, 0)
  tri.lineTo(0, roofH)
  tri.lineTo(-W / 2 + 0.01, 0)
  const roof = extrude(tri, W - 0.04, 0.012, 1, 2)
  roof.translate(0, 0, -(W - 0.04) / 2)
  roof.rotateY(Math.PI / 2)
  k.add(roof, (_p, n, out) => mix(out, C.carton, C.cartonShade, Math.abs(n.x) > 0.5 ? 0.6 : 0), {
    position: [0, Hb - 0.012, 0],
  })
  // Top fin
  const fin = new RoundedBoxGeometry(W - 0.03, 0.07, 0.035, 2, 0.012)
  k.add(smooth(fin), plain ? C.carton : panel, { position: [0, Hb + roofH + 0.02, 0] })
  // Milk drop on the front and side panels
  const drop = new THREE.Shape()
  drop.moveTo(0, 0.065)
  drop.quadraticCurveTo(0.045, 0.005, 0.045, -0.018)
  drop.absarc(0, -0.018, 0.045, 0, Math.PI, true)
  drop.quadraticCurveTo(-0.045, 0.005, 0, 0.065)
  const dropGeo = () => extrude(drop, 0.006, 0.004, 12, 1)
  k.add(dropGeo(), accent, { position: [0, 0.2, W / 2 + 0.006] })
  k.add(dropGeo(), accent, { position: [W / 2 + 0.006, 0.2, 0], rotation: [0, Math.PI / 2, 0] })
  return k.build()
}

// ---------------------------------------------------------------- shared pieces for the newer items

/**
 * A slab of thickness `t` resting on y = 0, built from a grid so its top face has inner vertices
 * that paint can freckle. `map` turns grid coordinates u, v in [-0.5, 0.5] into floor x, z.
 */
function sheet(nx: number, nz: number, t: number, map: (u: number, v: number) => [number, number], ny = 1) {
  const g = new THREE.BoxGeometry(1, t, 1, nx, ny, nz)
  g.translate(0, t / 2, 0)
  warp(g, (p) => {
    const [x, z] = map(p.x, p.z)
    p.x = x
    p.z = z
  })
  return smooth(g)
}

/** Grid square to a round disc of radius R (elliptical mapping keeps the grid even). */
const toDisc = (R: number) => (u: number, v: number): [number, number] => {
  const x = 2 * u
  const z = 2 * v
  return [R * x * Math.sqrt(1 - (z * z) / 2), R * z * Math.sqrt(1 - (x * x) / 2)]
}

/** Folds the half of a flat slab with z > 0 back over its top, around a bend of radius `rho` at z = 0. */
function fold(g: THREE.BufferGeometry, t: number, rho: number) {
  const y0 = t / 2
  const arc = Math.PI * rho
  return warp(g, (p) => {
    if (p.z <= 0) return
    const h = p.y - y0
    if (p.z < arc) {
      const th = p.z / rho
      p.z = (rho - h) * Math.sin(th)
      p.y = y0 + rho - (rho - h) * Math.cos(th)
    } else {
      p.z = -(p.z - arc)
      p.y = y0 + 2 * rho - h
    }
  })
}

/** Whole wheat flatbread: toasty freckles and bran flecks over a warm base. */
function flatbreadPaint(base: string, light: string, spot: string, seed: number) {
  const spotColor = new THREE.Color(spot)
  return (p: THREE.Vector3, _n: THREE.Vector3, out: THREE.Color) => {
    mix(out, base, light, smoothstep(-0.3, 0.6, noise3(p.x * 5, p.y * 5, p.z * 5, seed)) * 0.7)
    out.lerp(spotColor, smoothstep(0.25, 0.6, noise3(p.x * 13, p.y * 13, p.z * 13, seed + 3)) * 0.85)
    out.lerp(spotColor, smoothstep(0.55, 0.85, noise3(p.x * 40, p.y * 40, p.z * 40, seed + 9)) * 0.3)
  }
}

/** A cupped, ruffled leaf about 1 long, for salads and wraps. Scale it evenly. */
function leaf(seed: number, cup = 0.25) {
  return warp(
    sheet(6, 5, 0.03, (u, v) => {
      const w = Math.sqrt(Math.max(0, 1 - 4 * u * u))
      return [u, v * 0.72 * (0.25 + 0.75 * w)]
    }),
    (p) => {
      const d = Math.hypot(p.x * 2, p.z * 2.6)
      p.y += cup * d * d * 0.5 + 0.035 * noise3(p.x * 6, p.z * 6, 0, seed) * d * d
    },
  )
}

const leafPaint = (light: string, deep: string) => (p: THREE.Vector3, _n: THREE.Vector3, out: THREE.Color) =>
  mix(out, light, deep, smoothstep(0.1, 0.45, Math.hypot(p.x, p.z * 1.4)))

/** A bean: a small ball bent into a kidney shape. */
const kidney = () =>
  warp(ball(1), (p) => {
    p.z += 0.28 * p.x * p.x
  })

/** Small rounded sauce mound, so loose toppings have something to sit on. */
function mound(a: number, b: number, segments = 24, rings = 8) {
  const prof: [number, number][] = []
  for (let i = 0; i <= rings; i++) {
    const phi = (i / rings) * (Math.PI / 2)
    prof.push([a * Math.sin(phi), b * Math.cos(phi)])
  }
  prof.push([0, 0])
  return lathe(prof, segments)
}

/** Points spread evenly over a dome of radius a and height b (golden-angle spiral). */
function domeSpots(count: number, a: number, b: number, reach = 0.95) {
  const out: { pos: THREE.Vector3; n: THREE.Vector3 }[] = []
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count
    const phi = Math.acos(1 - t * reach)
    const th = i * 2.39996
    const x = a * Math.sin(phi) * Math.cos(th)
    const z = a * Math.sin(phi) * Math.sin(th)
    const y = b * Math.cos(phi)
    out.push({ pos: new THREE.Vector3(x, y, z), n: new THREE.Vector3(x / (a * a), y / (b * b), z / (a * a)).normalize() })
  }
  return out
}

// ---------------------------------------------------------------- newer entrees

/** One burrito half: axis along local +y, flat cut face at y = 0 showing the filling. */
function burritoHalf(r: number, L: number) {
  const prof: [number, number][] = [
    [0, 0],
    [r * 0.4, 0],
    [r * 0.72, 0],
    [r - 0.022, 0],
    [r - 0.019, 0],
    [r - 0.004, 0],
    [r, 0.008],
    [r * 1.02, L * 0.45],
  ]
  for (let i = 0; i <= 6; i++) {
    const th = (i / 6) * (Math.PI / 2)
    prof.push([r * Math.cos(th), L - r * 0.85 + r * 0.85 * Math.sin(th)])
  }
  prof[prof.length - 1][0] = 0
  return lathe(prof, 28)
}

function beanCheeseBurrito() {
  const k = new Kit()
  const r = 0.13
  const L = 0.42
  const shell = flatbreadPaint(C.tortilla, C.tortillaLight, C.tortillaSpot, 4)
  const cheese = new THREE.Color(C.cheese)
  for (const [x, ry, seed] of [
    [-0.145, 0.14, 1],
    [0.145, -0.1, 2],
  ] as const) {
    const place = { position: [x, r, 0.2] as [number, number, number], rotation: [-Math.PI / 2, ry, 0] as [number, number, number] }
    k.add(
      burritoHalf(r, L),
      (p, n, out) => {
        const rad = Math.hypot(p.x, p.z)
        if (p.y < 0.001 && rad < r - 0.02) {
          // Refried beans with melted cheese swirled through
          mix(out, C.refried, C.pattyLight, smoothstep(-0.4, 0.6, noise3(p.x * 30, 0, p.z * 30, seed)) * 0.5)
          out.lerp(cheese, smoothstep(0.1, 0.5, noise3(p.x * 18, 1, p.z * 18, seed + 5)) * 0.9)
        } else if (p.y < 0.001) {
          out.set(C.tortillaLight)
        } else shell(p, n, out)
      },
      place,
    )
    // Cheese pulling out of the cut
    k.add(blob(1, 30 + seed, 0.2), C.cheese, { position: [x + 0.03 * seed - 0.045, r * 0.75, 0.205], scale: [0.04, 0.025, 0.02] })
  }
  return k.build()
}

function veggieBurger() {
  const k = new Kit()
  const R = 0.3
  bun(k, 0.215, R, { top: C.crustDeep, side: C.bunSide }, false)
  // Rolled oats on the whole wheat bun
  const r = rng(41)
  for (let i = 0; i < 16; i++) {
    const phi = Math.sqrt(range(r, 0.02, 0.5)) * 1.25
    const th = range(r, 0, Math.PI * 2)
    const x = R * Math.sin(phi) * Math.cos(th)
    const z = R * Math.sin(phi) * Math.sin(th)
    const y = 0.02 + 0.2 * Math.cos(phi)
    const n = new THREE.Vector3(x / (R * R), y / 0.04, z / (R * R)).normalize()
    k.add(ball(1), C.oat, { position: [x, 0.215 + y + 0.002, z], quaternion: alignUp(n, range(r, 0, 3)), scale: [0.022, 0.007, 0.016] })
  }
  // Patty speckled with peas, carrot and corn
  const patty = lathe(
    [
      [0, 0],
      [R + 0.01, 0],
      [R + 0.03, 0.018],
      [R + 0.035, 0.04],
      [R + 0.03, 0.062],
      [R + 0.01, 0.072],
      [0, 0.075],
    ],
    36,
  )
  const pea = new THREE.Color(C.pea)
  const carrot = new THREE.Color(C.carrot)
  const corn = new THREE.Color(C.corn)
  k.add(
    patty,
    (p, _n, out) => {
      mix(out, C.veggiePatty, C.veggiePattyLight, smoothstep(-0.3, 0.6, noise3(p.x * 12, p.y * 12, p.z * 12, 6)) * 0.7)
      const f = noise3(p.x * 22, p.y * 22, p.z * 22, 8)
      if (f > 0.3) out.lerp(pea, 0.9)
      else if (f < -0.38) out.lerp(carrot, 0.85)
      else if (Math.abs(f) < 0.04) out.lerp(corn, 0.8)
    },
    { position: [0, 0.088, 0] },
  )
  // Tomato slice poking out under the lettuce
  const tomato = lathe(
    [
      [0, 0],
      [R + 0.03, 0],
      [R + 0.045, 0.012],
      [R + 0.03, 0.024],
      [R * 0.55, 0.024],
      [0, 0.024],
    ],
    28,
  )
  k.add(tomato, (p, n, out) => mix(out, C.tomato, C.tomatoLight, n.y > 0.5 ? smoothstep(R * 0.4, R * 0.6, Math.hypot(p.x, p.z)) * 0.6 : 0), {
    position: [0, 0.163, 0],
  })
  const lettuce = warp(
    lathe(
      [
        [0, 0],
        [R + 0.03, 0],
        [R + 0.05, 0.008],
        [R + 0.03, 0.016],
        [0, 0.016],
      ],
      45,
    ),
    (p) => {
      const a = Math.atan2(p.z, p.x)
      const d = Math.hypot(p.x, p.z) / (R + 0.05)
      p.y += 0.022 * Math.sin(a * 9) * d * d * d
    },
  )
  k.add(lettuce, C.lettuce, { position: [0, 0.19, 0], rotation: [0, 0.3, 0], scale: [0.94, 1, 0.94] })
  return k.build()
}

function blackBeanQuesadilla() {
  const k = new Kit()
  const R = 0.36
  const half = THREE.MathUtils.degToRad(28)
  const sector = (Rr: number) => (u: number, v: number): [number, number] => {
    const a = u * 2 * half
    const d = (v + 0.5) * Rr
    return [Math.sin(a) * d, -Math.cos(a) * d]
  }
  const shell = flatbreadPaint(C.tortilla, C.tortillaLight, C.tortillaSpot, 11)
  const r = rng(12)
  const wedges: [number, number, number][] = [
    [-0.2, 0.12, 0.35],
    [0.0, -0.06, 0.0],
    [0.2, 0.12, -0.35],
  ]
  wedges.forEach(([x, z, ry], i) => {
    const place = { position: [x, 0, z] as [number, number, number], rotation: [0, ry, 0] as [number, number, number] }
    // Each layer is built tip at the origin, then shifted so the wedge turns about its middle
    const base = sheet(7, 6, 0.014, sector(R))
    base.translate(0, 0, R / 2)
    k.add(base, shell, place)
    const filling = sheet(5, 4, 0.034, sector(R - 0.025))
    filling.translate(0, 0.012, R / 2 + 0.006)
    k.add(filling, (p, _n, out) => mix(out, C.cheese, C.cheeseDeep, smoothstep(0.1, 0.6, noise3(p.x * 20, p.y * 20, p.z * 20, i)) * 0.6), place)
    const top = warp(sheet(7, 6, 0.014, sector(R)), (p) => {
      p.y += 0.018 * Math.sin(Math.PI * smoothstep(-R, 0, p.z))
    })
    top.translate(0, 0.044, R / 2)
    k.add(top, shell, place)
    // Black beans and cheese peeking from the cut sides
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(1, 1, 1))
    for (let j = 0; j < 3; j++) {
      const side = j % 2 ? 1 : -1
      const d = range(r, 0.08, 0.26)
      const a = side * (half - 0.04)
      const pos = new THREE.Vector3(Math.sin(a) * d, 0.03, R / 2 - Math.cos(a) * d).applyMatrix4(m)
      const isBean = j < 2
      k.add(
        isBean ? kidney() : blob(1, 70 + i * 3 + j, 0.2),
        isBean ? C.blackBean : C.cheese,
        {
          position: [pos.x, pos.y, pos.z],
          rotation: [0, ry + range(r, -0.5, 0.5), 0],
          scale: isBean ? [0.03, 0.02, 0.021] : [0.03, 0.02, 0.03],
          material: isBean ? 'soft' : 'matte',
        },
      )
    }
  })
  return k.build()
}

function chickpeaCurryRice() {
  const k = new Kit()
  // Curry pool on the right, wavy at the edge
  const pool = warp(mound(0.27, 0.06, 32, 7), (p) => {
    const a = Math.atan2(p.z, p.x)
    const d = Math.hypot(p.x, p.z) / 0.27
    const w = 1 + 0.06 * Math.sin(a * 5 + 1) * d
    p.x *= w
    p.z *= w
  })
  k.add(
    pool,
    (p, _n, out) => {
      mix(out, C.curry, C.curryLight, smoothstep(0, 0.6, noise3(p.x * 8, p.y * 8, p.z * 8, 2)) * 0.6)
      out.lerp(tmpGlaze.set(C.curryDeep), smoothstep(0.2, 0.27, Math.hypot(p.x, p.z)) * 0.5)
    },
    { position: [0.12, 0, 0.02], material: 'soft' },
  )
  const r = rng(51)
  domeSpots(12, 0.2, 0.05, 0.9).forEach(({ pos }, i) => {
    const s = range(r, 0.034, 0.04)
    k.add(blob(1, 90 + i, 0.12), (p, n, out) => mix(out, C.chickpea, C.chickpeaDeep, smoothstep(0.2, -0.6, n.y) * 0.6 + smoothstep(0.4, 0.9, p.x) * 0.2), {
      position: [0.12 + pos.x, pos.y + s * 0.6, 0.02 + pos.z],
      rotation: [range(r, 0, 3), range(r, 0, 3), 0],
      scale: s,
    })
  })
  // Scoop of white rice on the left
  const a = 0.21
  const b = 0.15
  k.add(mound(a, b, 28, 10), C.whiteRice, { position: [-0.17, 0, -0.04] })
  const shades = [C.whiteRice, C.white, C.whiteRiceShade, C.white]
  domeSpots(70, a, b).forEach(({ pos, n }, i) => {
    k.add(ball(0), shades[i % shades.length], {
      position: [-0.17 + pos.x * 1.02, pos.y + 0.004, -0.04 + pos.z * 1.02],
      quaternion: alignUp(n, range(r, 0, Math.PI * 2)),
      scale: [0.034, 0.013, 0.015],
    })
  })
  // Cilantro on top
  for (const [x, z, ry] of [
    [0.1, -0.02, 0.4],
    [0.2, 0.1, 2.1],
  ] as const) {
    k.add(leaf(5, 0.1), C.herb, { position: [x, 0.085, z], rotation: [0, ry, 0], scale: 0.08 })
  }
  return k.build()
}

/**
 * A rolled flatbread lying on the tray with its open end tipped toward the viewer, half wrapped in
 * a paper sleeve. Returns the placement shared by every part, so fillings can be built in the
 * wrap's own frame: axis along +y, open mouth at y = L, local -z is the upper side.
 */
function wrapBody(k: Kit, opts: { r: number; L: number; tilt: number; turn: number; at: [number, number]; paper: string; band: string; seed: number }) {
  const { r, L, tilt, turn, at, paper, band, seed } = opts
  const sl = r + 0.012
  const q = new THREE.Quaternion()
    .setFromEuler(new THREE.Euler(0, turn, 0))
    .multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2 - tilt, 0, 0)))
  const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(q)
  const lift = sl - r * Math.sin(tilt)
  const pos = new THREE.Vector3(at[0], lift, at[1]).addScaledVector(axis, -L / 2)
  pos.y = lift
  const place = { position: pos.toArray() as [number, number, number], quaternion: q }

  const bread: [number, number][] = []
  for (let i = 0; i <= 6; i++) {
    const th = (i / 6) * (Math.PI / 2)
    bread.push([r * Math.sin(th), r * (1 - Math.cos(th))])
  }
  for (let i = 1; i <= 6; i++) bread.push([r * (1 + 0.02 * Math.sin((i / 7) * Math.PI)), r + ((L - 0.01 - r) * i) / 7])
  bread.push([r, L - 0.01], [r - 0.012, L + 0.002], [r - 0.022, L - 0.01], [r - 0.024, L - 0.07], [0, L - 0.07])
  bread[0][0] = 0
  const shell = flatbreadPaint(C.tortilla, C.tortillaLight, C.tortillaSpot, seed)
  k.add(lathe(bread, 28), (p, n, out) => {
    shell(p, n, out)
    if (Math.hypot(p.x, p.z) < r - 0.02) out.lerp(tmpGlaze.set(C.pocket), 0.35)
  }, place)

  // Paper sleeve with a printed band
  const top = L * 0.52
  const sleeve: [number, number][] = []
  for (let i = 0; i <= 6; i++) {
    const th = (i / 6) * (Math.PI / 2)
    sleeve.push([sl * Math.sin(th), r - sl * Math.cos(th)])
  }
  for (const f of [0.6, 0.62, 0.8, 0.82]) sleeve.push([sl, top * f])
  sleeve.push([sl, top], [sl + 0.004, top + 0.004], [sl - 0.006, top + 0.002], [sl - 0.008, top - 0.03])
  sleeve[0][0] = 0
  const bandColor = new THREE.Color(band)
  k.add(lathe(sleeve, 28), (p, _n, out) => {
    out.set(paper)
    const y = p.y / top
    if (y > 0.61 && y < 0.81) out.lerp(bandColor, 1)
  }, place)
  return place
}

/** Falafel crust: deep fried, darker in the crags. */
function falafelPaint(seed: number) {
  return (p: THREE.Vector3, n: THREE.Vector3, out: THREE.Color) => {
    mix(out, C.falafel, C.falafelLight, smoothstep(0, 1, n.y) * 0.5)
    out.lerp(tmpGlaze.set(C.patty), smoothstep(0.2, 0.7, noise3(p.x * 9, p.y * 9, p.z * 9, seed)) * 0.4)
  }
}

function falafelWrap() {
  const k = new Kit()
  const r = 0.13
  const L = 0.56
  const place = wrapBody(k, { r, L, tilt: 0.28, turn: 1.0, at: [-0.1, -0.08], paper: C.kraft, band: C.leaf, seed: 21 })
  const rnd = rng(61)
  // Falafel in the mouth, with lettuce, tomato and a ribbon of tahini
  const balls: [number, number, number][] = [
    [-0.048, L + 0.015, 0.03],
    [0.052, L + 0.01, 0.025],
    [0.0, L + 0.03, -0.04],
  ]
  balls.forEach(([x, y, z], i) => {
    const g = blob(2, 400 + i, 0.12, 0.09, 9)
    g.scale(0.064, 0.064, 0.064)
    g.translate(x, y, z)
    k.add(g, falafelPaint(i), place)
  })
  for (const [x, z, ry] of [
    [-0.06, -0.07, 0.6],
    [0.06, -0.075, -0.5],
  ] as const) {
    const g = leaf(7 + x * 10, 0.3)
    g.scale(0.13, 0.13, 0.1)
    g.rotateZ(Math.PI / 2)
    g.rotateY(ry)
    g.translate(x, L - 0.01, z)
    k.add(g, leafPaint(C.lettuceLight, C.lettuceDeep), place)
  }
  for (const [x, z] of [
    [0.07, -0.02],
    [-0.075, 0.0],
  ] as const) {
    const g = dice(1)
    g.scale(0.026, 0.026, 0.026)
    g.translate(x, L + 0.02, z)
    k.add(g, C.tomato, place)
  }
  const drizzle = new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.07, L + 0.03, -0.05),
      new THREE.Vector3(-0.02, L + 0.06, -0.075),
      new THREE.Vector3(0.03, L + 0.06, -0.06),
      new THREE.Vector3(0.07, L + 0.04, -0.075),
    ]),
    16,
    0.012,
    5,
    false,
  )
  k.add(smooth(drizzle), C.tahini, place)
  // Two loose falafel beside the wrap, one broken open to show the green herb center
  k.add(blob(3, 410, 0.12, 0.09, 9), falafelPaint(5), { position: [0.3, 0.064, -0.16], scale: 0.068, rotation: [range(rnd, 0, 3), 0, 0] })
  const halfProf: [number, number][] = [
    [0, 0],
    [0.025, 0],
    [0.045, 0],
    [0.058, 0],
    [0.066, 0.004],
  ]
  for (let i = 1; i <= 6; i++) {
    const th = (i / 6) * (Math.PI / 2)
    halfProf.push([0.066 * Math.cos(th), 0.004 + 0.06 * Math.sin(th)])
  }
  halfProf[halfProf.length - 1][0] = 0
  const inside = new THREE.Color(C.falafelInside)
  const crust = falafelPaint(6)
  k.add(
    warp(lathe(halfProf, 20), (p) => {
      const a = Math.atan2(p.z, p.x)
      const d = 1 + 0.06 * noise3(Math.cos(a) * 2, p.y * 8, Math.sin(a) * 2, 3)
      p.x *= d
      p.z *= d
    }),
    (p, n, out) => {
      if (p.y < 0.001 && Math.hypot(p.x, p.z) < 0.06) {
        out.copy(inside).lerp(tmpGlazeHi.set(C.herb), smoothstep(-0.2, 0.6, noise3(p.x * 50, 0, p.z * 50, 2)) * 0.6)
      } else crust(p, n, out)
    },
    { position: [0.2, 0.064, 0.3], rotation: [Math.PI + 0.3, 0.4, 0] },
  )
  return k.build()
}

function chickenShawarmaWrap() {
  const k = new Kit()
  const r = 0.135
  const L = 0.58
  const place = wrapBody(k, { r, L, tilt: 0.28, turn: -0.95, at: [0.04, -0.06], paper: C.wrapPaper, band: C.bowlBand, seed: 33 })
  const rnd = rng(71)
  // Spiced chicken strips fanned out of the mouth
  const charred = (seed: number) => (p: THREE.Vector3, n: THREE.Vector3, out: THREE.Color) => {
    mix(out, C.shawarma, C.shawarmaLight, smoothstep(0.2, 1, -n.z) * 0.5)
    out.lerp(tmpGlaze.set(C.shawarmaDeep), smoothstep(0.15, 0.6, noise3(p.x * 30, p.y * 30, p.z * 30, seed)) * 0.7)
  }
  for (let i = 0; i < 7; i++) {
    const a = (i / 6) * Math.PI * 2
    const d = i === 6 ? 0 : 0.058
    const g = blob(2, 500 + i, 0.25, 0.06, 10)
    g.scale(0.042, 0.05, 0.034)
    g.rotateX(range(rnd, -0.6, 0.6))
    g.rotateY(range(rnd, 0, 3))
    g.translate(Math.sin(a) * d, L + 0.01 + range(rnd, 0, 0.025) + (i === 6 ? 0.03 : 0), Math.cos(a) * d * 0.9)
    k.add(g, charred(i), place)
  }
  // Pickles and red onion tucked in, garlic sauce on top
  for (const [x, z, s] of [
    [0.07, 0.04, 1],
    [-0.065, 0.045, -1],
  ] as const) {
    const g = lathe(
      [
        [0, 0],
        [0.03, 0],
        [0.032, 0.005],
        [0.03, 0.01],
        [0, 0.01],
      ],
      14,
    )
    g.rotateX(Math.PI / 2 - 0.4)
    g.rotateZ(s * 0.5)
    g.translate(x, L + 0.005, z)
    k.add(g, C.pickle, place)
  }
  for (const [x, z] of [
    [-0.02, 0.06],
    [0.03, 0.055],
  ] as const) {
    const g = new THREE.TorusGeometry(0.028, 0.006, 5, 14, Math.PI * 1.2)
    g.rotateY(0.7)
    g.translate(x, L + 0.02, z)
    k.add(smooth(g), C.onion, place)
  }
  const sauce = blob(2, 520, 0.2)
  sauce.scale(0.085, 0.03, 0.05)
  sauce.rotateX(-0.5)
  sauce.translate(0, L + 0.08, -0.06)
  k.add(sauce, C.garlicSauce, { ...place, material: 'soft' })
  return k.build()
}

function teriyakiTofuBowl() {
  const k = new Kit()
  const bowl = lathe(
    [
      [0, 0],
      [0.13, 0],
      [0.14, 0.012],
      [0.15, 0.02],
      [0.21, 0.045],
      [0.28, 0.105],
      [0.33, 0.175],
      [0.345, 0.21],
      [0.338, 0.218],
      [0.325, 0.212],
      [0.31, 0.18],
      [0.26, 0.115],
      [0.18, 0.06],
      [0, 0.045],
    ],
    32,
  )
  const band = new THREE.Color(C.bowlBand)
  k.add(
    bowl,
    (p, n, out) => {
      out.set(C.bowl)
      const outer = n.x * p.x + n.z * p.z > 0
      if (outer && p.y > 0.12 && p.y < 0.165) out.lerp(band, 1)
    },
    { material: 'soft' },
  )
  // Rice filling the bowl, mounded a little
  const rice = mound(0.318, 0.05, 36, 6)
  k.add(rice, (p, _n, out) => mix(out, C.whiteRice, C.whiteRiceShade, smoothstep(0, 0.8, noise3(p.x * 30, p.y * 30, p.z * 30, 4)) * 0.6), {
    position: [0, 0.175, 0],
  })
  const r = rng(81)
  domeSpots(34, 0.3, 0.05, 0.9).forEach(({ pos, n }, i) => {
    k.add(ball(0), i % 3 ? C.whiteRice : C.white, {
      position: [pos.x, 0.178 + pos.y, pos.z],
      quaternion: alignUp(n, range(r, 0, 6)),
      scale: [0.03, 0.011, 0.013],
    })
  })
  // Seared tofu cubes with teriyaki glaze on top
  const cubes: [number, number, number][] = [
    [-0.12, 0.02, 0.2],
    [-0.04, -0.09, 1.1],
    [0.05, 0.03, 0.6],
    [-0.13, -0.11, 1.4],
    [0.03, -0.17, 0.3],
    [-0.04, 0.13, 0.9],
  ]
  cubes.forEach(([x, z, ry], i) => {
    k.add(
      new RoundedBoxGeometry(1, 1, 1, 1, 0.14),
      (p, n, out) => {
        // Pale tofu sides, seared and glazed on top
        mix(out, C.tofu, C.teriyakiLight, smoothstep(0.2, 0.7, n.y))
        out.lerp(tmpGlaze.set(C.teriyaki), smoothstep(0.6, 1, n.y) * smoothstep(-0.5, 0.5, noise3(p.x * 3, p.y * 3, p.z * 3, i)) * 0.6)
      },
      { position: [x, 0.245, z], rotation: [0.12, ry, 0.08], scale: 0.085, material: 'soft' },
    )
  })
  // A couple of broccoli bits
  for (const [x, z, seed] of [
    [0.17, -0.06, 1],
    [0.15, 0.1, 2],
  ] as const) {
    k.add(blob(2, 600 + seed, 0.12, 0.16, 5), (p, _n, out) => mix(out, C.broccoliDeep, C.broccoliLight, smoothstep(-0.5, 0.6, noise3(p.x * 6, p.y * 6, p.z * 6, seed))), {
      position: [x, 0.26, z],
      scale: [0.07, 0.055, 0.07],
    })
    k.add(smooth(new THREE.CylinderGeometry(0.022, 0.028, 0.05, 8)), C.stalk, { position: [x + 0.01, 0.225, z + 0.02], rotation: [0.6, 0, -0.4] })
  }
  // Scallions and sesame
  for (let i = 0; i < 6; i++) {
    const g = new THREE.TorusGeometry(0.013, 0.0045, 4, 10)
    k.add(smooth(g), C.scallion, {
      position: [range(r, -0.15, 0.08), 0.29, range(r, -0.15, 0.15)],
      rotation: [Math.PI / 2 + range(r, -0.4, 0.4), 0, range(r, -0.4, 0.4)],
    })
  }
  for (let i = 0; i < 12; i++) {
    k.add(ball(0), C.sesame, {
      position: [range(r, -0.17, 0.08), 0.282, range(r, -0.19, 0.16)],
      rotation: [0, range(r, 0, 3), 0],
      scale: [0.013, 0.006, 0.008],
    })
  }
  return k.build()
}

function orangeChicken() {
  const k = new Kit()
  const r = rng(91)
  const glaze = (seed: number) => (p: THREE.Vector3, n: THREE.Vector3, out: THREE.Color) => {
    mix(out, C.orangeGlaze, C.orangeGlazeLight, smoothstep(0.4, 1, n.y) * 0.6)
    out.lerp(tmpGlaze.set(C.orangeGlazeDeep), smoothstep(0.1, 0.6, noise3(p.x * 4, p.y * 4, p.z * 4, seed)) * 0.55)
  }
  const spots: [number, number, number][] = []
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.2
    spots.push([Math.cos(a) * 0.22, 0, Math.sin(a) * 0.2])
  }
  spots.push([0.03, 0.08, 0.02], [-0.07, 0.07, -0.07])
  const tops: THREE.Vector3[] = []
  spots.forEach(([x, y, z], i) => {
    const s = range(r, 0.1, 0.12)
    const pos: [number, number, number] = [x + range(r, -0.02, 0.02), s * 0.7 + y, z + range(r, -0.02, 0.02)]
    k.add(blob(3, 700 + i, 0.28, 0.05, 6), glaze(i), {
      position: pos,
      rotation: [range(r, 0, 3), range(r, 0, 3), range(r, 0, 3)],
      scale: [s * 1.15, s * 0.75, s],
      material: 'soft',
    })
    tops.push(new THREE.Vector3(pos[0], pos[1] + s * 0.7, pos[2]))
  })
  // Sesame seeds and sliced scallions sprinkled on top
  tops.forEach((t, i) => {
    for (let j = 0; j < 2; j++) {
      k.add(ball(0), C.sesame, {
        position: [t.x + range(r, -0.04, 0.04), t.y - 0.008, t.z + range(r, -0.04, 0.04)],
        rotation: [range(r, -0.3, 0.3), range(r, 0, 3), 0],
        scale: [0.015, 0.006, 0.009],
      })
    }
    if (i % 2 === 0) {
      k.add(smooth(new THREE.TorusGeometry(0.014, 0.005, 4, 10)), C.scallion, {
        position: [t.x + range(r, -0.03, 0.03), t.y - 0.004, t.z + range(r, -0.03, 0.03)],
        rotation: [Math.PI / 2 + range(r, -0.3, 0.3), 0, range(r, -0.3, 0.3)],
      })
    }
  })
  return k.build()
}

// ---------------------------------------------------------------- newer grains

function wholeWheatTortilla() {
  const k = new Kit()
  const t = 0.014
  // Flat tortilla underneath with a soft wave around the rim
  const R = 0.37
  const flatOne = warp(sheet(14, 14, t, toDisc(R)), (p) => {
    const a = Math.atan2(p.z, p.x)
    const d = Math.hypot(p.x, p.z) / R
    p.y += 0.014 * noise3(Math.cos(a) * 2, Math.sin(a) * 2, 0, 3) * d * d
  })
  k.add(flatOne, flatbreadPaint(C.tortilla, C.tortillaLight, C.tortillaSpot, 1), { position: [0, 0.008, 0.02] })
  // A second one folded in half on top
  const R2 = 0.35
  const folded = smooth(fold(sheet(12, 22, t, toDisc(R2)), t, 0.026))
  folded.translate(0, 0, R2 / 2 - 0.02)
  k.add(folded, flatbreadPaint(C.tortilla, C.tortillaLight, C.tortillaSpot, 2), {
    position: [0.02, 0.028, -0.02],
    rotation: [0, 0.45, 0],
  })
  return k.build()
}

/** Half a pita: a puffed half-moon whose straight cut side (facing +z) shows the pocket. */
function pitaHalf(R: number, H: number) {
  const g = new THREE.BoxGeometry(1, 1, 1, 14, 2, 8)
  g.translate(0, 0.5, 0)
  warp(g, (p) => {
    const x = 2 * p.x
    const w = 0.5 - p.z
    const zz = -w * Math.sqrt(Math.max(0, 1 - x * x))
    const dome = Math.sqrt(Math.max(0, 1 - x * x - zz * zz))
    const h = 0.018 + H * dome
    const yf = p.y
    p.set(R * x, yf * h * (yf > 0.5 ? 1 : 0.85), R * zz)
  })
  return smooth(g)
}

function wholeWheatPita() {
  const k = new Kit()
  const R = 0.3
  const H = 0.085
  const crust = flatbreadPaint(C.pita, C.pitaLight, C.tortillaSpot, 7)
  const pocket = new THREE.Color(C.pocket)
  const paint = (p: THREE.Vector3, n: THREE.Vector3, out: THREE.Color) => {
    if (p.z > -0.004 && n.z > 0.3) {
      // Cut side: soft crumb with the dark pocket line through the middle
      const h = 0.018 + H * Math.sqrt(Math.max(0, 1 - (p.x / R) ** 2))
      const mid = Math.abs(p.y / h - 0.45)
      out.set(C.pitaLight).lerp(pocket, smoothstep(0.42, 0.1, mid))
    } else {
      crust(p, n, out)
      // Paler underneath
      out.lerp(tmpGlaze.set(C.pitaLight), smoothstep(0, -0.8, n.y) * 0.7)
    }
  }
  k.add(pitaHalf(R, H), paint, { position: [-0.04, 0.06, -0.02], rotation: [-0.32, 0.2, 0] })
  k.add(pitaHalf(R, H), paint, { position: [0.03, 0, 0.2], rotation: [0, -0.12, 0] })
  return k.build()
}

// ---------------------------------------------------------------- newer vegetables

function sideSalad() {
  const k = new Kit()
  const r = rng(101)
  const H = 0.17
  const Rd = 0.36
  const height = (x: number, z: number) => H * Math.max(0, 1 - (x * x + z * z) / (Rd * Rd))
  const leaves: [number, number, number][] = [[0, 0, 0.3]]
  for (let i = 0; i < 4; i++) leaves.push([Math.cos(i * 1.6 + 0.4) * 0.13, Math.sin(i * 1.6 + 0.4) * 0.13, 0.26])
  for (let i = 0; i < 7; i++) leaves.push([Math.cos((i / 7) * 6.28) * 0.26, Math.sin((i / 7) * 6.28) * 0.26, 0.24])
  leaves.forEach(([x, z, s], i) => {
    const n = new THREE.Vector3(x * 2.2, 1, z * 2.2).normalize().lerp(new THREE.Vector3(range(r, -0.5, 0.5), 1, range(r, -0.5, 0.5)).normalize(), 0.4)
    const deep = i % 3 === 1
    k.add(leaf(i, 0.35), leafPaint(deep ? C.lettuce : C.lettuceLight, deep ? C.lettuceDeep : C.lettuce), {
      position: [x, height(x, z) + 0.01, z],
      quaternion: alignUp(n.normalize(), range(r, 0, Math.PI * 2)),
      scale: s * 1.3,
    })
  })
  // Cherry tomatoes
  for (const [x, z] of [
    [0.1, 0.08],
    [-0.14, 0.12],
    [0.05, -0.15],
  ] as const) {
    k.add(ball(2), (_p, n, out) => mix(out, C.tomato, C.tomatoLight, smoothstep(0.5, 1, n.y) * 0.5), {
      position: [x, height(x, z) + 0.065, z],
      scale: 0.048,
      material: 'soft',
    })
  }
  // Cucumber coins
  const coin = () =>
    lathe(
      [
        [0, 0],
        [0.05, 0],
        [0.056, 0.007],
        [0.05, 0.014],
        [0.04, 0.014],
        [0, 0.014],
      ],
      16,
    )
  for (const [x, z, tx] of [
    [-0.08, -0.06, 0.4],
    [0.15, -0.03, -0.5],
  ] as const) {
    k.add(coin(), (p, n, out) => mix(out, C.cucumber, C.cucumberFlesh, n.y > 0.5 && Math.hypot(p.x, p.z) < 0.045 ? 1 : 0), {
      position: [x, height(x, z) + 0.05, z],
      rotation: [tx, 0, 0.3],
    })
  }
  // Shredded carrot
  for (let i = 0; i < 6; i++) {
    const x = range(r, -0.18, 0.18)
    const z = range(r, -0.18, 0.18)
    k.add(smooth(new THREE.CapsuleGeometry(0.008, 0.09, 2, 5)), C.carrot, {
      position: [x, height(x, z) + 0.04, z],
      rotation: [Math.PI / 2 + range(r, -0.3, 0.3), 0, range(r, 0, 3)],
    })
  }
  return k.build()
}

function blackBeans() {
  const k = new Kit()
  const a = 0.33
  const b = 0.12
  k.add(mound(a, b, 20, 6), (p, _n, out) => mix(out, C.blackBean, C.refried, smoothstep(0, 0.8, noise3(p.x * 10, p.y * 10, p.z * 10, 3)) * 0.4), {
    material: 'soft',
  })
  const r = rng(111)
  domeSpots(34, a, b, 0.96).forEach(({ pos, n }, i) => {
    k.add(kidney(), (_p, nn, out) => mix(out, C.blackBean, C.blackBeanLight, smoothstep(0.5, 1, nn.y) * 0.8), {
      position: [pos.x, pos.y + 0.01, pos.z],
      quaternion: alignUp(n, range(r, 0, Math.PI * 2) + i),
      scale: [0.04, 0.024, 0.027],
      material: 'soft',
    })
  })
  // Seasoning: cilantro and a little diced pepper
  for (let i = 0; i < 6; i++) {
    const { pos, n } = domeSpots(6, a * 0.8, b * 0.8, 0.9)[i]
    const herb = i % 2 === 0
    k.add(herb ? leaf(i, 0.05) : ball(0), herb ? C.herb : C.pepperRed, {
      position: [pos.x, pos.y * 1.25 + 0.03, pos.z],
      quaternion: alignUp(n, i),
      scale: herb ? 0.07 : 0.014,
    })
  }
  return k.build()
}

function seasonedCorn() {
  const k = new Kit()
  const a = 0.33
  const b = 0.12
  k.add(mound(a, b, 20, 6), C.corn)
  const r = rng(121)
  const shades = [C.corn, C.corn, C.cornLight, C.corn, C.cornDeep]
  domeSpots(42, a, b, 0.96).forEach(({ pos, n }, i) => {
    const shade = shades[i % shades.length]
    k.add(dice(1, 0.5), (_p, nn, out) => mix(out, shade, C.cornLight, smoothstep(0.5, 1, nn.y) * 0.5), {
      position: [pos.x * 1.02, pos.y + 0.012, pos.z * 1.02],
      quaternion: alignUp(n, range(r, 0, Math.PI * 2)),
      scale: [0.028, 0.022, 0.024],
      material: 'soft',
    })
  })
  // Red pepper and parsley flecks
  for (let i = 0; i < 10; i++) {
    const { pos } = domeSpots(10, a * 0.85, b * 0.85, 0.9)[i]
    k.add(ball(0), i % 2 ? C.pepperRed : C.herb, {
      position: [pos.x, pos.y * 1.18 + 0.034, pos.z],
      rotation: [range(r, 0, 3), range(r, 0, 3), 0],
      scale: [0.013, 0.006, 0.012],
    })
  }
  return k.build()
}

// ---------------------------------------------------------------- newer fruit

function appleSlices() {
  const k = new Kit()
  const R = 0.21
  const A = THREE.MathUtils.degToRad(64)
  // Side view of a wedge: skin arc on the +x side, core cut along the inner edge
  const flesh = new THREE.Shape()
  flesh.moveTo(Math.cos(-A) * (R - 0.012), Math.sin(-A) * (R - 0.012))
  flesh.absarc(0, 0, R - 0.012, -A, A, false)
  flesh.lineTo(0.098, 0.075)
  flesh.quadraticCurveTo(0.13, 0, 0.098, -0.075)
  flesh.lineTo(Math.cos(-A) * (R - 0.012), Math.sin(-A) * (R - 0.012))
  const skin = new THREE.Shape()
  skin.moveTo(Math.cos(-A) * (R - 0.012), Math.sin(-A) * (R - 0.012))
  skin.absarc(0, 0, R - 0.012, -A, A, false)
  skin.absarc(0, 0, R + 0.004, A + 0.02, -A - 0.02, true)
  const depth = 0.06
  // Long sides run front to back, skins all facing the same way
  const slices: [number, number, number][] = [
    [-0.21, 0.03, 0.18],
    [-0.03, -0.02, -0.06],
    [0.15, 0.03, 0.12],
    [0.33, -0.01, -0.1],
  ]
  slices.forEach(([x, z, ry], i) => {
    const place = { position: [x, 0.008, z] as [number, number, number], rotation: [0, ry, 0] as [number, number, number] }
    const fleshGeo = flat(extrude(flesh, depth, 0.008, 10, 2))
    fleshGeo.translate(-0.15, 0, 0)
    k.add(fleshGeo, (_p, n, out) => mix(out, C.appleFlesh, C.pear, n.y > 0.5 ? 0 : 0.4), place)
    const skinGeo = flat(extrude(skin, depth, 0.006, 10, 2))
    skinGeo.translate(-0.15, 0, 0)
    k.add(skinGeo, (p, _n, out) => mix(out, C.apple, C.appleBlush, smoothstep(-0.1, 0.1, p.z) * 0.6), { ...place, material: 'soft' })
    // A couple of seeds in the core
    if (i === 1) {
      for (const sy of [-0.025, 0.025]) {
        const seed = ball(1)
        seed.scale(0.016, 0.006, 0.01)
        seed.translate(0.112 - 0.15, depth + 0.012, -sy)
        k.add(seed, C.stem, place)
      }
    }
  })
  return k.build()
}

function banana() {
  const k = new Kit()
  const Rb = 0.46
  const span = 1.45
  const r0 = 0.075
  const radiusAt = (t: number) => r0 * Math.pow(Math.sin(Math.PI * (0.07 + 0.86 * t)), 0.55)
  const spine = (t: number) => {
    const a = (t - 0.5) * span
    return {
      pos: new THREE.Vector3(Rb * Math.sin(a), 0.06 * (2 * t - 1) ** 2, Rb * (1 - Math.cos(a)) - Rb * (1 - Math.cos(span / 2)) * 0.5),
      tan: new THREE.Vector3(Math.cos(a), 0, Math.sin(a)),
      nor: new THREE.Vector3(-Math.sin(a), 0, Math.cos(a)),
    }
  }
  const body = warp(new THREE.CylinderGeometry(1, 1, 1, 10, 28), (p) => {
    const t = p.y + 0.5
    const phi = Math.atan2(p.z, p.x)
    // Five soft ridges along the peel, a little flatter underneath
    const ridge = 1 - 0.07 * Math.abs(Math.sin(phi * 2.5))
    const rr = radiusAt(t) * ridge
    const { pos, nor } = spine(t)
    const side = p.x * rr
    const up = p.z * rr * (p.z < 0 ? 0.85 : 1)
    p.copy(pos).addScaledVector(nor, side)
    p.y += up + r0 * 0.85
  })
  const tip = new THREE.Color(C.bananaTip)
  const green = new THREE.Color(C.bananaGreen)
  k.add(
    smooth(body),
    (p, n, out) => {
      const a = Math.atan2(p.x, Rb - p.z - Rb * (1 - Math.cos(span / 2)) * 0.5)
      const t = a / span + 0.5
      mix(out, C.banana, C.bananaLight, smoothstep(0.3, 1, n.y) * 0.6)
      out.lerp(green, smoothstep(0.2, 0.02, t) * 0.8)
      out.lerp(tip, smoothstep(0.96, 0.995, t))
    },
    { material: 'soft' },
  )
  // Stem at the start, a dark nub at the far end
  const s0 = spine(0)
  const stem = smooth(new THREE.CylinderGeometry(0.016, 0.024, 0.09, 8))
  stem.translate(0, 0.045, 0)
  const stemDir = s0.tan.clone().negate().add(new THREE.Vector3(0, 0.35, 0)).normalize()
  const stemBase = s0.pos.clone().add(new THREE.Vector3(0, r0 * 0.85, 0)).addScaledVector(s0.tan, 0.01)
  k.add(stem, (p, _n, out) => mix(out, C.bananaGreen, C.stem, smoothstep(0.04, 0.09, p.y)), {
    position: stemBase.toArray() as [number, number, number],
    quaternion: alignUp(stemDir),
  })
  const s1 = spine(1)
  k.add(ball(1), C.bananaTip, { position: s1.pos.clone().add(new THREE.Vector3(0, r0 * 0.85, 0)).addScaledVector(s1.tan, -0.004).toArray() as [number, number, number], scale: 0.017 })
  return k.build()
}

// ---------------------------------------------------------------- registry

export type { Component }

export const BUILDERS = {
  cheese_pizza: pizza,
  beef_nachos: nachos,
  chicken_nuggets: nuggets,
  cheeseburger: burger,
  popcorn_chicken: popcornChicken,
  spicy_chicken_sandwich: spicySandwich,
  dinner_roll: dinnerRolls,
  brown_rice: brownRice,
  steamed_carrots: carrots,
  broccoli,
  fruit_cup: fruitCup,
  mandarin_oranges: mandarins,
  chocolate_milk: () => carton(C.chocoPanel, C.chocoLight),
  milk_1pct: () => carton(C.milkPanel, C.white),
  milk_fat_free: () => carton(C.skimPanel, C.white),
  bean_cheese_burrito: beanCheeseBurrito,
  veggie_burger: veggieBurger,
  black_bean_quesadilla: blackBeanQuesadilla,
  chickpea_curry_rice: chickpeaCurryRice,
  falafel_wrap: falafelWrap,
  teriyaki_tofu_bowl: teriyakiTofuBowl,
  chicken_shawarma_wrap: chickenShawarmaWrap,
  orange_chicken: orangeChicken,
  whole_wheat_tortilla: wholeWheatTortilla,
  whole_wheat_pita: wholeWheatPita,
  side_salad: sideSalad,
  black_beans: blackBeans,
  seasoned_corn: seasonedCorn,
  apple_slices: appleSlices,
  banana,
} satisfies Record<string, () => BuiltFood>

export const FALLBACK_BUILDERS = {
  meat_alternate: meatballs,
  grain: breadSlices,
  vegetable: greenBeans,
  fruit: apple,
  milk: () => carton(C.milkLight, C.white, true),
} satisfies Record<Component, () => BuiltFood>

export type FoodId = keyof typeof BUILDERS

/** Which tray component each known item belongs to. */
export const FOOD_COMPONENT: Record<FoodId, Component> = {
  cheese_pizza: 'meat_alternate',
  beef_nachos: 'meat_alternate',
  chicken_nuggets: 'meat_alternate',
  cheeseburger: 'meat_alternate',
  popcorn_chicken: 'meat_alternate',
  spicy_chicken_sandwich: 'meat_alternate',
  dinner_roll: 'grain',
  brown_rice: 'grain',
  steamed_carrots: 'vegetable',
  broccoli: 'vegetable',
  fruit_cup: 'fruit',
  mandarin_oranges: 'fruit',
  chocolate_milk: 'milk',
  milk_1pct: 'milk',
  milk_fat_free: 'milk',
  bean_cheese_burrito: 'meat_alternate',
  veggie_burger: 'meat_alternate',
  black_bean_quesadilla: 'meat_alternate',
  chickpea_curry_rice: 'meat_alternate',
  falafel_wrap: 'meat_alternate',
  teriyaki_tofu_bowl: 'meat_alternate',
  chicken_shawarma_wrap: 'meat_alternate',
  orange_chicken: 'meat_alternate',
  whole_wheat_tortilla: 'grain',
  whole_wheat_pita: 'grain',
  side_salad: 'vegetable',
  black_beans: 'vegetable',
  seasoned_corn: 'vegetable',
  apple_slices: 'fruit',
  banana: 'fruit',
}
