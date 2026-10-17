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
}
