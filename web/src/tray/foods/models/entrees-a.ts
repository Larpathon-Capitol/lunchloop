import * as THREE from 'three'
import type { BuiltFood, MatKind, Paint } from '../build'
import type { FoodId } from '../items'
import { alignUp, ball, extrude, heap, Kit, lathe, puff, range, rng, smooth, smoothstep, toon, toonRamp, warp } from '../build'
import { FOOT } from '../fit'
import { FOOD as C } from '../palette'

/*
 * Entrees, part A. Style rules for every food:
 * chunky soft-toy pieces, a few big parts, low poly (ball detail 1 to 2), toon() shading,
 * and the portion fills FOOT.meat_alternate (about 1.6 wide, 1 deep). No faces.
 */

const [W, D] = FOOT.meat_alternate

// ---------------------------------------------------------------- shared helpers

/** Same light and shadow tints as toon() in build.ts, for paints that mix two colors first. */
const LIGHT = new THREE.Color('#fff8ec')
const DEEP = new THREE.Color('#5c2236')
const tmpA = new THREE.Color()
const tmpB = new THREE.Color()

/** toon() over a blend of `a` and `b`, where `t(p)` (0 to 1) picks the mix for each vertex. */
function toonMix(a: THREE.ColorRepresentation, b: THREE.ColorRepresentation, t: (p: THREE.Vector3) => number, light = 0.16, deep = 0.36): Paint {
  const ca = new THREE.Color(a)
  const cb = new THREE.Color(b)
  return (p, n, out) => {
    tmpA.copy(ca).lerp(tmpB.copy(cb), THREE.MathUtils.clamp(t(p), 0, 1))
    if (n.y >= 0) out.copy(tmpA.lerp(LIGHT, smoothstep(0.15, 1, n.y) * light))
    else out.copy(tmpA.lerp(DEEP, smoothstep(0, -1, n.y) * deep))
  }
}

/** A little paper dip cup with a glossy sauce pool, centered at (x, z). */
function dipCup(k: Kit, x: number, z: number, sauce: string) {
  const cup = lathe(
    [
      [0, 0],
      [0.15, 0],
      [0.17, 0.02],
      [0.19, 0.13],
      [0.17, 0.14],
      [0.15, 0.1],
      [0, 0.1],
    ],
    16,
  )
  k.add(cup, toon('#fffaf2', 0.2, 0.25), { position: [x, 0, z] })
  k.add(puff(3, 0.04, 1), toon(sauce, 0.35, 0.2), { position: [x, 0.1, z], scale: [0.15, 0.04, 0.15], material: 'soft' })
}

/** Rotate a local (x, z) offset by `yaw` about +y, matching three.js Euler Y rotation. */
const yawXZ = (x: number, z: number, yaw: number): [number, number] => [x * Math.cos(yaw) + z * Math.sin(yaw), -x * Math.sin(yaw) + z * Math.cos(yaw)]

// ---------------------------------------------------------------- burgers

type Profile = [number, number][]

/** One round layer of a burger: a lathe profile (bottom to top), side paint and cut-face paint. */
interface Layer {
  prof: Profile
  side: Paint
  cut: Paint
  material?: MatKind
  segments?: number
  /** Optional warp in polar terms; must be 0 at phi = 0 and PI so the cut face still matches. */
  wave?: (p: THREE.Vector3, phi: number, r: number) => void
}

/** Where a burger stands: center, yaw, and whether it is the cut half (cut face toward local -x). */
interface Stand {
  x: number
  z: number
  yaw: number
  half: boolean
}

/** A lathe layer: whole, or the x >= 0 half plus a flat cut face, both posed at `at`. */
function addLayer(k: Kit, layer: Layer, y: number, at: Stand) {
  const seg = layer.segments ?? 22
  const pts = layer.prof.map(([r, h]) => new THREE.Vector2(r, h))
  let g = smooth(new THREE.LatheGeometry(pts, at.half ? Math.ceil(seg / 2) : seg, 0, at.half ? Math.PI : Math.PI * 2))
  const wave = layer.wave
  if (wave) g = warp(g, (p) => wave(p, Math.atan2(p.x, p.z), Math.hypot(p.x, p.z)))
  const place = { position: [at.x, y, at.z] as [number, number, number], rotation: [0, at.yaw, 0] as [number, number, number] }
  k.add(g, layer.side, { ...place, material: layer.material })
  if (!at.half) return
  // Cut face: the profile mirrored across the axis, laid in the x = 0 plane facing -x.
  const shape = new THREE.Shape()
  const prof = layer.prof
  shape.moveTo(prof[0][0], prof[0][1])
  for (let i = 1; i < prof.length; i++) shape.lineTo(prof[i][0], prof[i][1])
  for (let i = prof.length - 2; i >= 1; i--) shape.lineTo(-prof[i][0], prof[i][1])
  const cap = new THREE.ShapeGeometry(shape, 1)
  cap.rotateY(-Math.PI / 2)
  k.add(cap, layer.cut, { ...place, material: layer.material })
}

/** Stacks layers from the floor up. Returns the height where the next layer would start. */
function stack(k: Kit, layers: { layer: Layer; gap?: number }[], at: Stand) {
  let y = 0
  for (const { layer, gap } of layers) {
    y += gap ?? 0
    addLayer(k, layer, y, at)
    y += layer.prof[layer.prof.length - 1][1]
  }
  return y
}

const R = 0.37

function bottomBun(side: string): Layer {
  return {
    prof: [
      [0, 0],
      [R - 0.05, 0],
      [R - 0.01, 0.02],
      [R, 0.06],
      [R - 0.012, 0.095],
      [R - 0.04, 0.11],
      [0, 0.11],
    ],
    side: toonMix(side, C.crumb, (p) => smoothstep(0.09, 0.11, p.y)),
    cut: toonMix(side, C.crumb, (p) => smoothstep(0.0, 0.03, p.y) * 0.85),
    material: 'soft',
  }
}

/** Puffy dome top bun, about 0.21 tall. */
function topBun(top: string, side: string): Layer {
  const prof: Profile = []
  const b = 0.19
  for (let i = 0; i <= 8; i++) {
    const phi = (i / 8) * THREE.MathUtils.degToRad(96)
    prof.push([R * Math.sin(phi), 0.02 + b * Math.cos(phi)])
  }
  prof.push([R - 0.025, 0], [0, 0])
  prof.reverse()
  return {
    prof,
    side: toonRamp(side, top, 0.02, 0.1, 0.22, 0.3),
    cut: toonMix(C.crumb, side, (p) => smoothstep(0.12, 0.2, Math.hypot(p.y - 0.02, 0) + (Math.abs(p.z) / R) * 0.12)),
    material: 'soft',
  }
}

/** Flat round disc layer with a softly rounded rim. */
function disc(r: number, h: number, side: Paint, cut: Paint, wave?: Layer['wave'], material?: MatKind): Layer {
  return {
    prof: [
      [0, 0],
      [r - 0.02, 0],
      [r, h * 0.3],
      [r, h * 0.7],
      [r - 0.02, h],
      [0, h],
    ],
    side,
    cut,
    wave,
    material,
  }
}

/** Ruffled lettuce: the rim waves up and down (zero at the cut line). */
const lettuce = () =>
  disc(R + 0.05, 0.022, toon(C.lettuce, 0.3), toon(C.lettuceLight), (p, phi, r) => {
    p.y += 0.022 * Math.sin(phi * 10) * Math.pow(r / (R + 0.05), 3)
  })

/** Melty cheese: the rim droops into four soft drips (none at the cut line). */
const cheeseSlice = () =>
  disc(R + 0.035, 0.022, toon(C.cheese, 0.3), toon(C.cheese), (p, phi, r) => {
    const drip = Math.pow(Math.max(0, Math.cos(4 * phi + Math.PI)), 3)
    const edge = Math.pow(r / (R + 0.035), 4)
    p.y -= drip * edge * 0.07
    p.x *= 1 + drip * edge * 0.06
    p.z *= 1 + drip * edge * 0.06
  }, 'soft')

const tomatoSlice = () => disc(R + 0.01, 0.03, toon(C.tomato, 0.3), toonMix(C.tomato, C.tomatoLight, (p) => 1 - smoothstep(0.05, 0.2, Math.abs(p.z))))

const beefPatty = (): Layer => ({
  prof: [
    [0, 0],
    [R + 0.01, 0],
    [R + 0.03, 0.02],
    [R + 0.035, 0.045],
    [R + 0.025, 0.075],
    [R, 0.085],
    [0, 0.085],
  ],
  side: toon(C.patty, 0.25, 0.3),
  cut: toon(C.pattyLight),
})

/** Seeds or oat flakes scattered on a top bun dome (skips the missing half on a cut burger). */
function bunDots(k: Kit, at: Stand, y0: number, count: number, color: string, size: [number, number, number], seed: number) {
  const r = rng(seed)
  const b = 0.19
  for (let i = 0; i < count; i++) {
    const phi = Math.sqrt(range(r, 0.03, 0.55)) * 1.2
    const th = range(r, 0, Math.PI * 2)
    const lx = R * Math.sin(phi) * Math.cos(th)
    const lz = R * Math.sin(phi) * Math.sin(th)
    if (at.half && lx < 0.04) continue
    const ly = 0.02 + b * Math.cos(phi)
    const [wx, wz] = yawXZ(lx, lz, at.yaw)
    const nl = new THREE.Vector3(lx / (R * R), ly / (b * b), lz / (R * R)).normalize()
    const [nx, nz] = yawXZ(nl.x, nl.z, at.yaw)
    k.add(smooth(new THREE.IcosahedronGeometry(1, 0)), toon(color, 0.2, 0.2), {
      position: [at.x + wx, y0 + ly + 0.002, at.z + wz],
      quaternion: alignUp(new THREE.Vector3(nx, nl.y, nz), range(r, 0, 3)),
      scale: size,
      material: 'soft',
    })
  }
}

/** A whole burger on the left and a cut half on the right, its layered cut face toward the camera. */
const STANDS: Stand[] = [
  { x: -W / 2 + R + 0.035, z: -0.04, yaw: 0.3, half: false },
  { x: W / 2 - R - 0.05, z: 0.13, yaw: Math.PI / 2 - 0.2, half: true },
]

export function cheeseburger() {
  const k = new Kit()
  for (const at of STANDS) {
    const top = stack(
      k,
      [
        { layer: bottomBun(C.bunSide) },
        { layer: beefPatty() },
        { layer: cheeseSlice() },
        { layer: tomatoSlice() },
        { layer: lettuce() },
        { layer: topBun(C.bunTop, C.bunSide), gap: -0.004 },
      ],
      at,
    )
    bunDots(k, at, top - 0.21, at.half ? 6 : 11, C.sesame, [0.024, 0.009, 0.014], at.half ? 6 : 5)
  }
  return k.build()
}

export function veggieBurger() {
  const k = new Kit()
  const patty: Layer = {
    ...beefPatty(),
    side: toonMix(C.veggiePatty, C.veggiePattyLight, (p) => smoothstep(0.03, 0.08, p.y), 0.25, 0.3),
    // Cut face shows a few big peas and carrot bits in the patty.
    cut: (p, n, out) => {
      const bits: [number, number, string][] = [
        [-0.24, 0.045, C.pea],
        [-0.12, 0.03, C.carrot],
        [0.0, 0.05, C.pea],
        [0.13, 0.035, C.corn],
        [0.26, 0.045, C.pea],
      ]
      out.set(C.veggiePattyLight)
      for (const [bz, by, col] of bits) if (Math.hypot(p.z - bz, p.y - by) < 0.028) out.set(col)
      void n
    },
  }
  for (const at of STANDS) {
    const top = stack(
      k,
      [
        { layer: bottomBun(C.bunSide) },
        { layer: patty },
        { layer: tomatoSlice() },
        { layer: lettuce() },
        { layer: topBun('#c96f34', C.bunSide), gap: -0.004 },
      ],
      at,
    )
    bunDots(k, at, top - 0.21, at.half ? 7 : 13, C.oat, [0.034, 0.011, 0.024], at.half ? 16 : 15)
    // A couple of peas peeking out of the patty rim
    if (!at.half) {
      for (const a of [0.9, 2.1, 3.6]) {
        const [px, pz] = yawXZ(Math.sin(a) * (R + 0.03), Math.cos(a) * (R + 0.03), at.yaw)
        k.add(ball(1), toon(C.pea, 0.3), { position: [at.x + px, 0.155, at.z + pz], scale: 0.03 })
      }
    }
  }
  return k.build()
}

export function spicyChickenSandwich() {
  const k = new Kit()
  const FR = R + 0.07
  // Crispy fillet: wider than the bun with a wavy craggy rim, glazed orange-red on top.
  const fillet = (): Layer => ({
    prof: [
      [0, 0],
      [FR - 0.04, 0],
      [FR - 0.01, 0.025],
      [FR, 0.055],
      [FR - 0.015, 0.085],
      [FR - 0.05, 0.1],
      [0, 0.1],
    ],
    side: toonMix(C.fryDeep, C.orangeGlazeDeep, (p) => smoothstep(0.03, 0.09, p.y), 0.08, 0.3),
    cut: toonMix('#fff1d6', C.fryDeep, (p) => Math.max(1 - smoothstep(0.0, 0.025, p.y), smoothstep(0.075, 0.1, p.y), smoothstep(FR - 0.07, FR - 0.03, Math.abs(p.z)))),
    segments: 32,
    wave: (p, phi, r) => {
      const f = 1 + 0.06 * Math.sin(phi * 7) * smoothstep(0.2, FR, r)
      p.x *= f
      p.z *= f
    },
    material: 'soft',
  })
  const pickle = () =>
    lathe(
      [
        [0, 0],
        [0.085, 0],
        [0.09, 0.008],
        [0.085, 0.016],
        [0, 0.016],
      ],
      14,
    )
  const picklePaint = toonMix('#5f9e36', C.lettuceLight, (p) => smoothstep(0.012, 0.016, p.y) * (1 - smoothstep(0.03, 0.06, Math.hypot(p.x, p.z))) * 0.8)
  for (const at of STANDS) {
    const top = stack(k, [{ layer: bottomBun(C.bunSide) }, { layer: fillet() }, { layer: topBun(C.brioche, C.bunSide), gap: 0.014 }], at)
    // Pickle chips tucked under the top bun, poking out of the rim
    const spots = at.half ? [0.7, 2.3] : [0.4, 2.0, 4.2]
    for (const a of spots) {
      const [px, pz] = yawXZ(Math.sin(a) * (R + 0.01), Math.cos(a) * (R + 0.01), at.yaw)
      k.add(pickle(), picklePaint, { position: [at.x + px, top - 0.218, at.z + pz], rotation: [0.15, a, -0.12] })
    }
  }
  return k.build()
}

// ---------------------------------------------------------------- pizza

/** Two plump slices, one pointing each way, so together they fill the wide well. */
export function cheesePizza() {
  const k = new Kit()
  const L = 0.9
  const half = 0.46
  const tipY = -L / 2
  const wedge = (inset: number, r: number, h: number) => {
    const s = new THREE.Shape()
    s.moveTo(0, tipY + inset)
    s.absarc(0, tipY, r, Math.PI / 2 - h, Math.PI / 2 + h, false)
    s.lineTo(0, tipY + inset)
    return s
  }
  const flat = (g: THREE.BufferGeometry) => g.rotateX(-Math.PI / 2)
  const r = rng(11)
  const bubble = toon('#ffe27a', 0.3, 0.2)
  const toasty = toon('#ffc93a', 0.25, 0.2)
  for (const [ox, turn] of [
    [-0.3, 0],
    [0.3, Math.PI],
  ] as const) {
    const at = (x: number, y: number, z: number): [number, number, number] => {
      const [wx, wz] = yawXZ(x, z, turn)
      return [ox + wx, y, wz]
    }
    const rot: [number, number, number] = [0, turn, 0]
    // Dough base
    k.add(flat(extrude(wedge(0, L - 0.03, half), 0.05, 0.02, 10, 2)), toon(C.crust, 0.2, 0.3), {
      position: at(0, 0.02, 0),
      rotation: rot,
    })
    // Thick gooey cheese, inset a little from the edges
    k.add(flat(extrude(wedge(0.07, L - 0.1, half - 0.05), 0.02, 0.022, 10, 2)), toon(C.cheese, 0.1, 0.25), {
      position: at(0, 0.088, 0),
      rotation: rot,
      material: 'soft',
    })
    // Puffy crust lip along the arc, with round ends
    const Rl = L - 0.07
    const lip = new THREE.TorusGeometry(Rl, 0.07, 8, 14, half * 2)
    lip.rotateZ(Math.PI / 2 - half)
    lip.scale(1, 1, 1.15)
    lip.translate(0, tipY, 0)
    k.add(flat(smooth(lip)), toon(C.crust, 0.25, 0.3), { position: at(0, 0.1, 0), rotation: rot })
    for (const s of [-1, 1]) {
      const a = Math.PI / 2 + s * half
      k.add(ball(1), toon(C.crust, 0.25, 0.3), {
        position: at(Math.cos(a) * Rl, 0.1, -(tipY + Math.sin(a) * Rl)),
        scale: [0.07, 0.08, 0.07],
      })
    }
    // Round cheese bubbles and a couple of toasty spots
    const spots: [number, number][] = [
      [-0.12, -0.15],
      [0.1, -0.05],
      [-0.03, 0.08],
      [0.16, -0.24],
      [0.0, 0.25],
    ]
    spots.forEach(([x, z], i) => {
      const s = range(r, 0.045, 0.065)
      k.add(ball(1), i % 2 === 1 ? toasty : bubble, {
        position: at(x, 0.128, z),
        scale: [s, s * 0.45, s * 0.9],
        material: 'soft',
      })
    })
    // A cheese drip over the side
    k.add(ball(1), toon(C.cheese, 0.3, 0.25), { position: at(0.17, 0.09, 0.08), scale: [0.04, 0.06, 0.04], material: 'soft' })
  }
  return k.build()
}

// ---------------------------------------------------------------- nachos

export function beefNachos() {
  const k = new Kit()
  const r = rng(7)
  const chipShape = (() => {
    const s = new THREE.Shape()
    const pts = [0, 1, 2].map((i) => {
      const a = Math.PI / 2 + (i * Math.PI * 2) / 3
      return new THREE.Vector2(Math.cos(a) * 0.23, Math.sin(a) * 0.23)
    })
    const round = 0.24
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
    warp(extrude(chipShape, 0.022, 0.012, 3, 1).rotateX(-Math.PI / 2), (p) => {
      p.y += -0.5 * (p.x * p.x * 0.5 + p.z * p.z)
    })
  const chipPaint = (tint: number) => toonMix('#ffd25e', C.chipDeep, (p) => tint * 0.4 + smoothstep(0.1, 0.22, Math.hypot(p.x, p.z)) * 0.5, 0.08, 0.3)

  // A mound in three rings: a wide floor layer, a middle layer, and a few chips on top. Each chip
  // leans on the dome a little outward, never steeper than about 50 degrees.
  const layers = [
    heap({ w: W * 0.98, d: D * 0.96, count: 12, seed: 3, height: 0.08, square: 2.8 }),
    heap({ w: W * 0.62, d: D * 0.6, count: 6, seed: 8, height: 0.05, square: 2.2 }).map((s) => ({ ...s, y: s.y + 0.11 })),
    heap({ w: W * 0.3, d: D * 0.32, count: 3, seed: 2, height: 0.02, square: 2 }).map((s) => ({ ...s, y: s.y + 0.2 })),
  ]
  for (const layer of layers) {
    for (const s of layer) {
      const n = new THREE.Vector3(s.x * 0.7 + range(r, -0.3, 0.3), 1, s.z * 1.0 + range(r, -0.3, 0.3))
      n.y = Math.max(n.y, 0.75 * Math.hypot(n.x, n.z))
      k.add(chip(), chipPaint(r()), {
        position: [s.x, s.y + 0.045, s.z],
        quaternion: alignUp(n.normalize(), range(r, 0, Math.PI * 2)),
        scale: range(r, 0.85, 1.0),
      })
    }
  }
  // Glossy cheese sauce splats on the upper chips, each with beef crumbles and a herb fleck
  const sauce = toon('#ff9f1c', 0.12, 0.2)
  const beef = toon(C.beef, 0.25, 0.3)
  const sauceSpots = [...layers[2], ...layers[1].filter((_, i) => i % 2 === 0)]
  sauceSpots.forEach((s, i) => {
    const big = i < layers[2].length
    const x = s.x * 0.85
    const z = s.z * 0.85
    const y = s.y + 0.085
    k.add(puff(9 + i, 0.35, 1), sauce, {
      position: [x, y, z],
      rotation: [0, range(r, 0, 3), 0],
      scale: big ? [0.16, 0.04, 0.13] : [0.12, 0.035, 0.1],
      material: 'soft',
    })
    for (let j = 0; j < 3; j++) {
      const a = i * 2.1 + j * 2.2
      const d = big ? 0.075 : 0.055
      const cx = x + Math.cos(a) * d
      const cz = z + Math.sin(a) * d * 0.8
      if (j < 2) {
        const sz = range(r, 0.035, 0.045)
        k.add(puff(60 + i * 3 + j, 0.3, 0), beef, { position: [cx, y + 0.03, cz], scale: [sz, sz * 0.7, sz], rotation: [range(r, 0, 3), range(r, 0, 3), 0] })
      } else {
        k.add(smooth(new THREE.IcosahedronGeometry(1, 0)), toon(C.scallion, 0.25, 0.2), {
          position: [cx, y + 0.035, cz],
          rotation: [0, a, 0],
          scale: [0.03, 0.012, 0.02],
        })
      }
    }
  })
  return k.build()
}

// ---------------------------------------------------------------- fried

/** Reference: a heap of chunky nuggets with a little ketchup cup tucked in one corner. */
export function nuggets() {
  const k = new Kit()
  const r = rng(21)
  // Ketchup cup, back right
  const cupX = W / 2 - 0.2
  const cupZ = -D / 2 + 0.2
  dipCup(k, cupX, cupZ, C.tomato)

  const paint = toonRamp(C.fryDeep, C.fry, -0.7, 0.6)
  // Bottom layer covers the floor, a smaller top layer heaps it up in the middle.
  const layers = [
    heap({ w: W, d: D, count: 12, seed: 4, height: 0.04, square: 3.2 }),
    heap({ w: W * 0.6, d: D * 0.55, count: 4, seed: 9, height: 0.05, square: 2 }).map((s) => ({ ...s, y: s.y + 0.13 })),
  ]
  for (const layer of layers) {
    for (const s of layer) {
      if (Math.hypot(s.x - cupX, s.z - cupZ) < 0.3) continue
      const size = range(r, 0.97, 1.14)
      k.add(puff(r() * 100, 0.12, 2), paint, {
        position: [s.x, s.y + 0.09 * size, s.z],
        rotation: [range(r, -0.25, 0.25), range(r, 0, Math.PI), range(r, -0.25, 0.25)],
        scale: [0.23 * size, 0.11 * size, 0.17 * size],
      })
    }
  }
  return k.build()
}

/** A big heap of round chunky bites with a honey mustard cup in the back left corner. */
export function popcornChicken() {
  const k = new Kit()
  const r = rng(33)
  const cupX = -W / 2 + 0.2
  const cupZ = -D / 2 + 0.2
  dipCup(k, cupX, cupZ, C.cheeseDeep)
  const paint = toonRamp(C.fryDeep, C.fryLight, -0.8, 0.8, 0.2, 0.36)
  const layers = [
    heap({ w: W, d: D, count: 19, seed: 12, height: 0.04, square: 3 }),
    heap({ w: W * 0.6, d: D * 0.55, count: 6, seed: 5, height: 0.05, square: 2 }).map((s) => ({ ...s, y: s.y + 0.12 })),
  ]
  for (const layer of layers) {
    for (const s of layer) {
      if (Math.hypot(s.x - cupX, s.z - cupZ) < 0.28) continue
      const size = range(r, 0.13, 0.155)
      k.add(puff(r() * 100, 0.2, 1), paint, {
        position: [s.x, s.y + size * 0.8, s.z],
        rotation: [range(r, -0.4, 0.4), range(r, 0, Math.PI), range(r, -0.4, 0.4)],
        scale: [size * 1.05, size * 0.85, size],
      })
    }
  }
  return k.build()
}

/** New-style builders, keyed by food id. Anything missing falls back to the old model in items.ts. */
export const MODELS: Partial<Record<FoodId, () => BuiltFood>> = {
  chicken_nuggets: nuggets,
  cheese_pizza: cheesePizza,
  beef_nachos: beefNachos,
  cheeseburger,
  popcorn_chicken: popcornChicken,
  spicy_chicken_sandwich: spicyChickenSandwich,
  veggie_burger: veggieBurger,
}
