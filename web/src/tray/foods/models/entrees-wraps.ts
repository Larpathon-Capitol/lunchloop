import * as THREE from 'three'
import type { BuiltFood } from '../build'
import type { Component, FoodId } from '../items'
import { ball, blob, dice, Kit, lathe, mix, noise3, range, rng, smoothstep, toon, toonRamp, warp } from '../build'
import { FOOT } from '../fit'
import { FOOD as C } from '../palette'

/*
 * Wraps and folded flatbreads: burrito, quesadilla, falafel and shawarma wraps. Each one is cut in
 * halves or wedges that sit side by side, so the portion spans the wide entree well, with the
 * filling showing at the cut. Parts of a roll are built in the roll's own frame and moved into
 * place before painting, so the soft-toy shading reads the real up direction.
 */

const [W, D] = FOOT.meat_alternate

// ---------------------------------------------------------------- shared helpers

const LIGHT = new THREE.Color('#fff8ec')
const DEEP = new THREE.Color('#5c2236')
const tmp = new THREE.Color()

/** The same soft-toy shading as `toon`, applied to a color already in `out`. */
function shade(out: THREE.Color, n: THREE.Vector3, light = 0.16, deep = 0.36) {
  if (n.y >= 0) out.lerp(LIGHT, smoothstep(0.15, 1, n.y) * light)
  else out.lerp(DEEP, smoothstep(0, -1, n.y) * deep)
  return out
}

/** Warm flour tortilla: soft light patches and a few big toasty spots, no speckle. */
function tortilla(seed: number, toast = '#e39a4c') {
  const spot = new THREE.Color(toast)
  return (p: THREE.Vector3, n: THREE.Vector3, out: THREE.Color) => {
    mix(out, C.tortilla, C.tortillaLight, smoothstep(-0.2, 0.6, noise3(p.x * 4, p.y * 4, p.z * 4, seed)) * 0.65)
    out.lerp(spot, smoothstep(0.25, 0.5, noise3(p.x * 6, p.y * 6, p.z * 6, seed + 3)) * 0.7)
    shade(out, n)
  }
}

interface Roll {
  /** Moves a part from roll space into food space. Roll space: axis +y from the cut (y = 0) to the closed end, +z is up. */
  put: (g: THREE.BufferGeometry) => THREE.BufferGeometry
  /** Food space point back to roll space (ignoring the slant of the cut). */
  local: (p: THREE.Vector3) => THREE.Vector3
}

/**
 * A rolled tortilla cut in half, lying on the tray with its cut end facing the viewer. `slant`
 * angles the cut so it faces up toward the camera, `lift` raises the cut end a little.
 * Adds the shell (and an optional paper band) to the kit and returns the roll's frame.
 */
function roll(
  k: Kit,
  o: { r: number; L: number; at: [number, number]; yaw: number; lift: number; slant: number; squash: number; seed: number; band?: [string, string] },
): Roll {
  const { r, L, slant } = o
  const t = 0.032
  const rb = r * 1.02
  const prof: [number, number][] = [
    [0, 0.035],
    [r - t, 0.035],
    [r - t, 0.012],
    [r - t * 0.5, -0.006],
    [r, 0.01],
    [rb, L * 0.18],
    [rb, L * 0.45],
    [rb, L * 0.7],
  ]
  const cap = L - r * 0.75
  for (let i = 1; i <= 4; i++) {
    const th = (i / 4) * (Math.PI / 2)
    prof.push([rb * Math.cos(th), cap + r * 0.75 * Math.sin(th)])
  }
  prof[prof.length - 1][0] = 0
  // Slanted cut: the top of the cut sits further back, so the face tips up toward the camera.
  const shear = (g: THREE.BufferGeometry) =>
    warp(g, (p) => {
      p.y += slant * (p.z + r) * (1 - smoothstep(0, L * 0.6, p.y))
    })
  const m0 = new THREE.Matrix4()
    .makeTranslation(o.at[0], 0, o.at[1])
    .multiply(new THREE.Matrix4().makeRotationY(o.yaw))
    .multiply(new THREE.Matrix4().makeRotationX(-o.lift))
    .multiply(new THREE.Matrix4().makeScale(1, o.squash, 1))
    .multiply(new THREE.Matrix4().makeTranslation(0, 0, L / 2))
    .multiply(new THREE.Matrix4().makeRotationX(-Math.PI / 2))
  const probe = shear(lathe(prof, 14)).applyMatrix4(m0)
  probe.computeBoundingBox()
  const m = new THREE.Matrix4().makeTranslation(0, -probe.boundingBox!.min.y, 0).multiply(m0)
  probe.dispose()
  const inv = m.clone().invert()
  const put = (g: THREE.BufferGeometry) => shear(g).applyMatrix4(m)
  const lp = new THREE.Vector3()
  const local = (p: THREE.Vector3) => lp.copy(p).applyMatrix4(inv)

  const shell = tortilla(o.seed)
  k.add(put(lathe(prof, 14)), (p, n, out) => {
    const q = local(p)
    if (q.y < 0.04 + slant * (q.z + r) && Math.hypot(q.x, q.z) < r * 0.99) {
      // The rolled edge at the cut, lighter, with the inside layer a little darker.
      mix(out, C.tortillaLight, C.tortilla, smoothstep(r - t * 0.6, r - t, Math.hypot(q.x, q.z)))
      shade(out, n, 0.1, 0.2)
    } else shell(p, n, out)
  })

  if (o.band) {
    const [paper, stripe] = o.band
    const y0 = L * 0.34
    const y1 = L * 0.72
    const pr = rb + 0.01
    const sleeve = lathe(
      [
        [pr - 0.008, y0 - 0.004],
        [pr + 0.004, y0 + 0.006],
        [pr + 0.006, y0 + (y1 - y0) * 0.36],
        [pr + 0.006, y0 + (y1 - y0) * 0.4],
        [pr + 0.006, y0 + (y1 - y0) * 0.6],
        [pr + 0.006, y0 + (y1 - y0) * 0.64],
        [pr + 0.004, y1 - 0.006],
        [pr - 0.008, y1 + 0.004],
      ],
      14,
    )
    const a = new THREE.Color(paper)
    const b = new THREE.Color(stripe)
    k.add(put(sleeve), (p, n, out) => {
      const y = (local(p).y - y0) / (y1 - y0)
      out.copy(y > 0.37 && y < 0.63 ? b : a)
      shade(out, n, 0.12, 0.3)
    })
  }
  return { put, local }
}

/** A piece in roll space: unit geometry scaled, turned and placed. */
function piece(g: THREE.BufferGeometry, at: [number, number, number], scale: [number, number, number], rot: [number, number, number] = [0, 0, 0]) {
  g.scale(...scale)
  g.rotateX(rot[0])
  g.rotateY(rot[1])
  g.rotateZ(rot[2])
  g.translate(...at)
  return g
}

/** World-shaded flat color (for parts already moved into food space). */
const flat = (color: string, light = 0.16, deep = 0.36) => {
  const c = new THREE.Color(color)
  return (_p: THREE.Vector3, n: THREE.Vector3, out: THREE.Color) => shade(out.copy(c), n, light, deep)
}

// ---------------------------------------------------------------- burrito

const BEAN = '#c9683f'
const BEAN_DEEP = '#a84a32'

function beanCheeseBurrito() {
  const k = new Kit()
  const r = 0.28
  const L = D * 0.88
  const halves: [number, number, number][] = [
    [-0.39, 0.13, 1],
    [0.39, -0.13, 2],
  ]
  for (const [x, yaw, seed] of halves) {
    const ro = roll(k, { r, L, at: [x, 0], yaw, lift: 0.05, slant: 0.35, squash: 0.86, seed: seed * 7 })
    // Filling bulging out of the cut: refried beans with a ring of melted cheese.
    const fill = piece(ball(3), [0, 0.012, 0], [r - 0.028, 0.05, r - 0.028])
    k.add(ro.put(fill), (p, n, out) => {
      const q = ro.local(p)
      const d = Math.hypot(q.x, q.z) / (r - 0.028)
      const wob = 0.06 * noise3(q.x * 9, q.z * 9, 0, seed)
      const cheese = smoothstep(0.42, 0.5, d + wob) * (1 - smoothstep(0.66, 0.74, d + wob))
      mix(out, BEAN, BEAN_DEEP, smoothstep(0.2, 0.7, noise3(q.x * 14, q.z * 14, 1, seed)) * 0.5)
      out.lerp(tmp.set(C.cheese), cheese)
      shade(out, n, 0.2, 0.3)
    }, { material: 'soft' })
    // A few whole beans and soft cubes of melted cheese poking out of the cut.
    const rr = rng(seed + 40)
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + range(rr, -0.3, 0.3)
      const d = i % 2 ? range(rr, 0.06, 0.1) : range(rr, 0.12, 0.15)
      const isCheese = i % 2 === 0
      const g = isCheese ? dice(1, 0.5) : ball(1)
      k.add(
        ro.put(piece(g, [Math.sin(a) * d, -0.05, Math.cos(a) * d], isCheese ? [0.04, 0.03, 0.04] : [0.042, 0.03, 0.03], [0, range(rr, 0, 3), 0])),
        flat(isCheese ? C.cheese : BEAN_DEEP, 0.25, 0.2),
        { material: 'soft' },
      )
    }
  }
  return k.build()
}

// ---------------------------------------------------------------- quesadilla

/** One chunky quesadilla wedge: tip toward +z, arc toward -z, centered on its length. */
function wedge(R: number, theta: number, t: number) {
  const r0 = 0.06
  return warp(dice(3, 0.7), (p) => {
    // Melted cheese bulging out of the middle of the side walls
    const band = 1 - smoothstep(0.1, 0.55, Math.abs(p.y))
    const a = p.x * (theta / 2) * (1 + 0.3 * band * Math.abs(p.x))
    const d = r0 + ((p.z + 1) / 2) * (R - r0) + 0.06 * band * Math.max(0, p.z)
    const top = Math.max(0, p.y)
    const y = ((p.y + 1) / 2) * t + 0.045 * top * top * (1 - p.x * p.x) * (1 - 0.5 * p.z * p.z)
    p.set(Math.sin(a) * d, y, -Math.cos(a) * d + R / 2)
  })
}

function blackBeanQuesadilla() {
  const k = new Kit()
  const R = D * 0.8
  const theta = 0.7
  const t = 0.15
  const golden = new THREE.Color('#f6b24a')
  const toast = new THREE.Color('#e48f3a')
  const paint = (p: THREE.Vector3, n: THREE.Vector3, out: THREE.Color) => {
    const mid = Math.abs(p.y - t / 2)
    if (mid < t * 0.3) {
      mix(out, C.cheese, C.cheeseDeep, smoothstep(0.1, 0.26, mid / t) * 0.5)
      return shade(out, n, 0.25, 0.15)
    }
    mix(out, C.tortillaLight, golden, smoothstep(-0.2, 0.9, n.y))
    out.lerp(toast, smoothstep(0.35, 0.6, noise3(p.x * 9, 0, p.z * 9, 5)) * 0.45 * Math.max(0, n.y))
    shade(out, n)
  }
  const step = 0.345
  const r = rng(13)
  for (let i = 0; i < 4; i++) {
    const x = (i - 1.5) * step
    const yaw = (i % 2 ? Math.PI : 0) + range(r, -0.04, 0.04)
    const roll = (i % 2 ? 1 : -1) * 0.06
    k.add(wedge(R, theta, t), paint, { position: [x, 0.012, 0], rotation: [0, yaw, roll] })
    // Black beans tucked into the cheese along both cut sides
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(x, 0, 0),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0)),
      new THREE.Vector3(1, 1, 1),
    )
    for (const side of [-1, 1]) {
      const d = (side > 0 ? 0.42 : 0.68) * R
      const a = side * (theta / 2) * 1.2
      const pos = new THREE.Vector3(Math.sin(a) * d, t * 0.5, -Math.cos(a) * d + R / 2).applyMatrix4(m)
      k.add(ball(1), toon('#3a2050', 0.2, 0.2), {
        position: pos.toArray() as [number, number, number],
        rotation: [0, yaw + a + range(r, -0.3, 0.3), 0],
        scale: [0.034, 0.03, 0.05],
        material: 'soft',
      })
    }
  }
  return k.build()
}

// ---------------------------------------------------------------- falafel wrap

const FALAFEL = '#c4743a'
const FALAFEL_TOP = '#e39a52'

function falafelBall(seed: number) {
  return blob(2, seed, 0.1, 0.05, 7)
}

function falafelWrap() {
  const k = new Kit()
  const r = 0.235
  const L = D * 0.82
  const halves: [number, number, number][] = [
    [-0.52, 0.08, 1],
    [-0.03, -0.06, 2],
  ]
  for (const [x, yaw, seed] of halves) {
    const ro = roll(k, { r, L, at: [x, -0.04], yaw, lift: 0.14, slant: 0.3, squash: 0.95, seed: seed * 5 + 20, band: [C.kraft, C.leaf] })
    const rr = rng(seed + 60)
    // Lettuce frill around the top of the opening
    for (const [a, s] of [
      [-0.9, 1],
      [0, 1.1],
      [0.9, 1],
    ] as const) {
      const g = piece(blob(1, 80 + seed * 3 + a * 10, 0.25), [Math.sin(a) * r * 0.55, -0.03, Math.cos(a) * r * 0.55], [0.09 * s, 0.05, 0.06])
      k.add(ro.put(g), (_p, n, out) => shade(mix(out, C.lettuceDeep, C.lettuceLight, smoothstep(-0.2, 1, n.y)), n, 0.1, 0.3))
    }
    // Tomato cubes and falafel pieces in the middle, tahini over the top
    for (const [px, pz] of [
      [-0.08, -0.06],
      [0.09, -0.04],
    ] as const) {
      k.add(ro.put(piece(dice(1, 0.6), [px, -0.05, pz], [0.035, 0.035, 0.035], [range(rr, 0, 1), range(rr, 0, 3), 0])), flat(C.tomato, 0.25, 0.3), {
        material: 'soft',
      })
    }
    k.add(ro.put(piece(falafelBall(300 + seed), [0, -0.04, -0.02], [0.085, 0.07, 0.085])), (_p, n, out) => {
      shade(mix(out, FALAFEL, FALAFEL_TOP, smoothstep(-0.2, 1, n.y)), n)
    })
    k.add(ro.put(piece(blob(1, 330 + seed, 0.2), [0.01, -0.06, 0.08], [0.1, 0.035, 0.05])), flat(C.tahini, 0.2, 0.25), { material: 'soft' })
  }
  // Three whole falafel beside the wrap, one with a dot of tahini
  const balls: [number, number, number][] = [
    [0.47, 0.21, 0.135],
    [0.6, -0.08, 0.13],
    [0.38, -0.27, 0.12],
  ]
  balls.forEach(([x, z, s], i) => {
    k.add(falafelBall(400 + i), toonRamp(FALAFEL, FALAFEL_TOP, -0.4, 0.8, 0.12, 0.4), {
      position: [x, s * 0.85, z],
      rotation: [i, i * 2, 0],
      scale: [s, s * 0.88, s],
    })
  })
  k.add(blob(1, 450, 0.2), toon(C.tahini, 0.2, 0.25), { position: [0.47, 0.232, 0.22], scale: [0.065, 0.032, 0.06], material: 'soft' })
  return k.build()
}

// ---------------------------------------------------------------- shawarma wrap

const CHICKEN = '#f08038'
const CHICKEN_CHAR = '#c8402a'

function chickenShawarmaWrap() {
  const k = new Kit()
  const r = 0.255
  const L = D * 0.86
  const halves: [number, number, number][] = [
    [-0.45, 0.1, 1],
    [0.08, -0.08, 2],
  ]
  for (const [x, yaw, seed] of halves) {
    const ro = roll(k, { r, L, at: [x, -0.02], yaw, lift: 0.12, slant: 0.32, squash: 0.92, seed: seed * 5 + 40, band: [C.wrapPaper, C.bowlBand] })
    const rr = rng(seed + 90)
    // Spiced chicken chunks heaped in the opening
    const spots: [number, number, number][] = [
      [-0.09, 0.07, 0.5],
      [0.09, 0.08, -0.4],
      [0, -0.04, 0.1],
      [-0.1, -0.09, -0.6],
      [0.1, -0.08, 0.7],
    ]
    spots.forEach(([px, pz, rz]) => {
      const g = piece(blob(1, 600 + seed * 9 + px * 50, 0.15), [px, -0.05 - range(rr, 0, 0.02), pz], [0.085, 0.045, 0.04], [range(rr, -0.3, 0.3), 0, rz])
      k.add(ro.put(g), (_p, n, out) => {
        mix(out, CHICKEN_CHAR, CHICKEN, smoothstep(-0.4, 0.7, n.y))
        out.lerp(tmp.set(C.shawarmaLight), smoothstep(0.6, 1, n.y) * 0.35)
        shade(out, n, 0.1, 0.3)
      })
    })
    // Pink pickled onion rings and a ribbon of garlic sauce
    for (const [px, pz, rz] of [
      [-0.05, 0.02, 0.5],
      [0.07, -0.02, -0.7],
    ] as const) {
      const ring = new THREE.TorusGeometry(1, 0.32, 4, 10)
      k.add(ro.put(piece(ring, [px, -0.085, pz], [0.04, 0.04, 0.04], [0.3, 0, rz])), flat(C.onion, 0.25, 0.2), { material: 'soft' })
    }
    k.add(ro.put(piece(blob(1, 500 + seed, 0.2), [0.0, -0.08, 0.06], [0.11, 0.03, 0.045])), flat(C.garlicSauce, 0.1, 0.2), { material: 'soft' })
    k.add(ro.put(piece(blob(1, 520 + seed, 0.25), [0.12, -0.03, 0.14], [0.06, 0.03, 0.04])), flat(C.lettuce, 0.12, 0.3))
  }
  // A little cup of garlic sauce at the back right
  const cupX = W / 2 - 0.18
  const cupZ = 0.12
  const cup = lathe(
    [
      [0, 0],
      [0.15, 0],
      [0.17, 0.02],
      [0.185, 0.13],
      [0.17, 0.14],
      [0.15, 0.1],
      [0, 0.09],
    ],
    16,
  )
  k.add(cup, toon(C.bowlBand, 0.2, 0.25), { position: [cupX, 0, cupZ] })
  k.add(ball(2), toon(C.garlicSauce, 0.1, 0.2), { position: [cupX, 0.11, cupZ], scale: [0.15, 0.035, 0.15], material: 'soft' })
  return k.build()
}

/** New-style builders, keyed by food id. Anything missing falls back to the old model in items.ts. */
export const MODELS: Partial<Record<FoodId, () => BuiltFood>> = {
  bean_cheese_burrito: beanCheeseBurrito,
  black_bean_quesadilla: blackBeanQuesadilla,
  falafel_wrap: falafelWrap,
  chicken_shawarma_wrap: chickenShawarmaWrap,
}

/** Fallback models for unknown items, keyed by compartment. */
export const FALLBACKS: Partial<Record<Component, () => BuiltFood>> = {}
