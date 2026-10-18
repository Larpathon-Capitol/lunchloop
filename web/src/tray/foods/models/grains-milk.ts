import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import type { BuiltFood } from '../build'
import type { Component, FoodId } from '../items'
import { alignUp, ball, extrude, Kit, mix, puff, range, rng, smooth, smoothstep, toon, toonRamp } from '../build'
import { FOOT, WELL } from '../fit'
import { FOOD as C } from '../palette'

/*
 * Grains and milk, cute style: puffy golden rolls, a soft scoop of rice, folded tortillas, plump
 * pita halves, and one shared gable-top school milk carton. The grain portion fills FOOT.grain
 * (about 1.2 x 1.0) and the carton fills the round milk well.
 */

const [W, D] = FOOT.grain

// ---------------------------------------------------------------- shared helpers

/** A polygon with rounded corners (quadratic), for soft flat silhouettes. `r` is the corner reach. */
function roundedPoly(pts: [number, number][], r: number) {
  const shape = new THREE.Shape()
  const n = pts.length
  for (let i = 0; i < n; i++) {
    const prev = new THREE.Vector2(...pts[(i + n - 1) % n])
    const cur = new THREE.Vector2(...pts[i])
    const next = new THREE.Vector2(...pts[(i + 1) % n])
    const a = prev.clone().sub(cur)
    const b = next.clone().sub(cur)
    const ra = Math.min(r, a.length() * 0.45)
    const rb = Math.min(r, b.length() * 0.45)
    const p1 = cur.clone().add(a.normalize().multiplyScalar(ra))
    const p2 = cur.clone().add(b.normalize().multiplyScalar(rb))
    if (i === 0) shape.moveTo(p1.x, p1.y)
    else shape.lineTo(p1.x, p1.y)
    shape.quadraticCurveTo(cur.x, cur.y, p2.x, p2.y)
  }
  shape.closePath()
  return shape
}

/** Lay an extruded shape flat: shape x stays x, shape y becomes -z, extrusion goes up, resting on y = 0. */
function lay(g: THREE.BufferGeometry, bevel: number) {
  g.rotateX(-Math.PI / 2)
  g.translate(0, bevel, 0)
  return g
}

// ---------------------------------------------------------------- dinner rolls

/** Three puffy glossy golden rolls nestled together, each with a little split on top. */
export function dinnerRoll() {
  const k = new Kit()
  const rolls: { x: number; z: number; sx: number; sy: number; sz: number; rot: number; seed: number }[] = [
    { x: -0.3, z: 0.24, sx: 0.37, sy: 0.25, sz: 0.34, rot: 0.3, seed: 3 },
    { x: 0.31, z: 0.2, sx: 0.36, sy: 0.24, sz: 0.34, rot: -0.35, seed: 8 },
    { x: 0.0, z: -0.22, sx: 0.38, sy: 0.26, sz: 0.34, rot: 0.1, seed: 5 },
  ]
  for (const r of rolls) {
    const paint = toonRamp(C.rollBase, C.rollTop, -0.1, 0.6, 0.22, 0.34)
    k.add(puff(r.seed, 0.05, 2), paint, {
      position: [r.x, r.sy * 0.62, r.z],
      rotation: [0, r.rot, 0],
      scale: [r.sx, r.sy, r.sz],
      material: 'soft',
    })
    // A soft pale split along the top
    k.add(ball(1), toon(C.crumb, 0.3, 0.1), {
      position: [r.x, r.sy * 0.62 + r.sy * 0.93, r.z],
      rotation: [0, r.rot, 0],
      scale: [r.sx * 0.5, r.sy * 0.14, r.sz * 0.1],
      material: 'soft',
    })
  }
  return k.build()
}

// ---------------------------------------------------------------- brown rice

/** A big soft scoop of rice: a smooth mound covered in plump, evenly spread grains. */
export function brownRice() {
  const k = new Kit()
  const r = rng(12)
  const dome = { sx: W * 0.47, sy: 0.4, sz: D * 0.45, y: 0.0 }
  k.add(puff(4, 0.04, 2), toonRamp('#cf9f5e', '#e0b676', -0.3, 0.9, 0.2, 0.36), {
    position: [0, dome.y, 0],
    scale: [dome.sx, dome.sy, dome.sz],
  })
  // Grains: golden-angle spiral over the dome, so they spread evenly and never bunch
  const n = 60
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n
    const polar = Math.acos(1 - 0.99 * t)
    const az = i * 2.399963
    const nx = Math.sin(polar) * Math.cos(az)
    const ny = Math.cos(polar)
    const nz = Math.sin(polar) * Math.sin(az)
    const pos = new THREE.Vector3(nx * dome.sx, dome.y + ny * dome.sy, nz * dome.sz)
    const normal = new THREE.Vector3(nx / dome.sx, ny / dome.sy, nz / dome.sz).normalize()
    const q = alignUp(normal, az + range(r, -0.5, 0.5))
    const s = range(r, 0.92, 1.1)
    k.add(ball(0), toon(i % 3 === 0 ? '#f1d9a3' : i % 3 === 1 ? '#ebcf94' : '#e4c284', 0.3, 0.22), {
      position: pos.addScaledVector(normal, -0.012).toArray(),
      quaternion: q,
      scale: [0.085 * s, 0.052 * s, 0.05 * s],
      material: 'soft',
    })
  }
  return k.build()
}

// ---------------------------------------------------------------- tortilla

/** Soft-toy shading with a darker toasted tone where the surface curls over the edge. */
function toastRim(top: string, rim: string) {
  const shade = toon(top, 0.2, 0.36)
  const edge = new THREE.Color(rim)
  return (p: THREE.Vector3, n: THREE.Vector3, out: THREE.Color) => {
    ;(shade as (p: THREE.Vector3, n: THREE.Vector3, out: THREE.Color) => void)(p, n, out)
    out.lerp(edge, smoothstep(0.93, 0.55, n.y) * 0.65)
  }
}

/** A quarter-folded tortilla: a rounded wedge (a quarter circle) with the point toward the viewer. */
function tortillaWedge(R: number, bevel: number) {
  const pts: [number, number][] = [[0, 0]]
  const steps = 5
  for (let i = 0; i <= steps; i++) {
    const ang = Math.PI * (0.25 + (0.5 * i) / steps)
    pts.push([R * Math.cos(ang), R * Math.sin(ang)])
  }
  return lay(extrude(roundedPoly(pts, 0.17), 0.07, bevel, 3, 2), bevel)
}

/** A fanned stack of three soft folded tortillas with a few toasted spots. */
export function wholeWheatTortilla() {
  const k = new Kit()
  const R = 0.7
  const bevel = 0.05
  const layers = [
    { y: 0, rot: -0.3, dx: -0.03, dz: 0.0, spots: [[-0.1, 0.62, 1], [0.3, 0.55, 0.8]] as [number, number, number][] },
    { y: 0.1, rot: 0.26, dx: 0.03, dz: -0.04, spots: [[0.22, 0.6, 1], [-0.24, 0.52, 0.9]] as [number, number, number][] },
    { y: 0.2, rot: -0.02, dx: 0, dz: -0.1, spots: [[0.2, 0.3, 1], [-0.22, 0.46, 1.1], [0.04, 0.58, 0.8]] as [number, number, number][] },
  ]
    for (const l of layers) {
    k.add(tortillaWedge(R, bevel), toastRim('#f2c47a', '#dd9a4c'), {
      position: [l.dx, l.y, D * 0.42 + l.dz],
      rotation: [0, l.rot, 0],
      material: 'soft',
    })
    // A soft crease down the middle where the second fold sits
    k.add(ball(1), '#f7d596', {
      position: [l.dx - R * 0.46 * Math.sin(l.rot), l.y + 0.07 + 2 * bevel - 0.004, D * 0.42 + l.dz - R * 0.46 * Math.cos(l.rot)],
      rotation: [0, l.rot, 0],
      scale: [0.018, 0.016, R * 0.42],
      material: 'soft',
    })
    // Toasted freckles on the top face of each tortilla, scattered off-center
    const cos = Math.cos(l.rot)
    const sin = Math.sin(l.rot)
    for (const [off, d, sz] of l.spots) {
      const x = l.dx + off * cos - d * sin
      const z = D * 0.42 + l.dz - off * sin - d * cos
      k.add(ball(1), '#c9803f', {
        position: [x, l.y + 0.07 + 2 * bevel - 0.018, z],
        rotation: [0, off * 9, 0],
        scale: [0.07 * sz, 0.022, 0.048 * sz],
        material: 'soft',
      })
    }
  }
  return k.build()
}

// ---------------------------------------------------------------- pita

const SHADE_LIGHT = new THREE.Color('#fff8ec')
const SHADE_DEEP = new THREE.Color('#5c2236')
/** The same soft top highlight and warm underside shadow as toon(), for custom paint functions. */
function toonShade(out: THREE.Color, n: THREE.Vector3, light = 0.2, deep = 0.34) {
  if (n.y >= 0) out.lerp(SHADE_LIGHT, smoothstep(0.15, 1, n.y) * light)
  else out.lerp(SHADE_DEEP, smoothstep(0, -1, n.y) * deep)
}

/** A plump pita half leaning back: arc at the front on the floor, straight cut edge raised at the back with a dark pocket slit. */
function addPitaHalf(k: Kit, R: number, at: { x: number; z: number; lean: number; rot: number }) {
  const bevel = 0.07
  const pts: [number, number][] = []
  // Straight cut along y = 0 (becomes z = 0), arc bulging to -z
  const steps = 8
  for (let i = 0; i <= steps; i++) {
    const ang = Math.PI * (i / steps)
    pts.push([R * Math.cos(ang), R * Math.sin(ang)])
  }
  const body = lay(extrude(roundedPoly(pts, 0.14), 0.05, bevel, 3, 3), bevel)
  const edgeTone = new THREE.Color('#d9964a')
  const paint = (p: THREE.Vector3, n: THREE.Vector3, out: THREE.Color) => {
    // Golden toward the arc, paler along the cut edge
    mix(out, '#f2c070', C.pitaLight, smoothstep(-0.25, 0.05, p.z) * 0.45)
    out.lerp(edgeTone, smoothstep(0.93, 0.5, n.y) * 0.55)
    toonShade(out, n)
  }
  // Lean the flat piece back by `lean` (radians from flat), then spin about the vertical
  const q = new THREE.Quaternion()
    .setFromAxisAngle(new THREE.Vector3(0, 1, 0), at.rot)
    .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), at.lean))
    .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI))
  const lift = R * Math.sin(at.lean) + 0.02
  const pos = new THREE.Vector3(at.x, lift, at.z)
  k.add(body, paint, { position: pos.toArray(), quaternion: q, material: 'soft' })
  // The pocket opening: a dark soft slit along the top cut edge, on the surface of the rounded edge
  const slit = new THREE.Vector3(0, bevel + 0.02, bevel * 0.98).applyQuaternion(q).add(pos)
  k.add(ball(1), C.pocket, { position: slit.toArray(), quaternion: q, scale: [R * 0.8, 0.03, 0.03] })
}

/** Four plump pita halves leaning back in two rows, pocket openings along their raised edges. */
export function wholeWheatPita() {
  const k = new Kit()
  const halves = [
    { r: 0.32, x: -0.28, z: -0.34, lean: 0.9, rot: 0.08 },
    { r: 0.32, x: 0.28, z: -0.36, lean: 0.9, rot: -0.08 },
    { r: 0.32, x: -0.28, z: 0.14, lean: 0.9, rot: -0.06 },
    { r: 0.32, x: 0.28, z: 0.12, lean: 0.9, rot: 0.07 },
  ]
  for (const h of halves) addPitaHalf(k, h.r, h)
  return k.build()
}

// ---------------------------------------------------------------- bread (generic grain)

/** Soft sandwich-bread slice outline with two puffy shoulders; `s` scales it about its center. */
function sliceShape(s: number) {
  const sh = new THREE.Shape()
  const P = (x: number, y: number): [number, number] => [x * s, y * s]
  sh.moveTo(...P(-0.27, -0.36))
  sh.lineTo(...P(0.27, -0.36))
  sh.quadraticCurveTo(...P(0.33, -0.36), ...P(0.33, -0.3))
  sh.lineTo(...P(0.33, 0.04))
  sh.bezierCurveTo(...P(0.46, 0.1), ...P(0.42, 0.42), ...P(0.16, 0.4))
  sh.quadraticCurveTo(...P(0.06, 0.39), ...P(0, 0.34))
  sh.quadraticCurveTo(...P(-0.06, 0.39), ...P(-0.16, 0.4))
  sh.bezierCurveTo(...P(-0.42, 0.42), ...P(-0.46, 0.1), ...P(-0.33, 0.04))
  sh.lineTo(...P(-0.33, -0.3))
  sh.quadraticCurveTo(...P(-0.33, -0.36), ...P(-0.27, -0.36))
  return sh
}

/** Two plump slices of bread side by side. */
export function breadSlices() {
  const k = new Kit()
  const bevel = 0.045
  const sc = 0.92
  const slices = [
    { x: -0.29, z: 0.14, rot: 0.14 },
    { x: 0.3, z: -0.14, rot: -0.12 },
  ]
  for (const s of slices) {
    k.add(lay(extrude(sliceShape(sc), 0.075, bevel, 8, 3), bevel), toonRamp(C.breadCrust, C.crust, 0, 0.17, 0.2, 0.34), {
      position: [s.x, 0, s.z],
      rotation: [0, s.rot, 0],
      material: 'soft',
    })
    // Pale crumb face, set a touch above the crust
    const face = lay(extrude(sliceShape(sc * 0.82), 0.02, 0.03, 8, 2), 0.03)
    k.add(face, toon(C.bread, 0.25, 0.1), {
      position: [s.x, 0.075 + bevel - 0.012, s.z + 0.005],
      rotation: [0, s.rot, 0],
    })
  }
  return k.build()
}

// ---------------------------------------------------------------- milk cartons

const M = Math.min(WELL.milk.w, WELL.milk.d)

/** One cute gable-top school carton: a big colored band, a white roof with a symbol, and a colored top fold. */
function carton(band: string, bandLight: string, symbol: 'drop' | 'heart') {
  const k = new Kit()
  const side = M * 0.7
  const bodyH = 0.7
  const roofH = 0.22
  const rad = 0.07

  // White body underneath
  k.add(smooth(new RoundedBoxGeometry(side, bodyH, side, 2, rad)), toon(C.carton, 0.18, 0.3), {
    position: [0, bodyH / 2, 0],
  })
  // Big colored band around the lower body
  const bandH = bodyH - 0.02
  k.add(smooth(new RoundedBoxGeometry(side + 0.016, bandH, side + 0.016, 2, rad + 0.006)), toon(band, 0.18, 0.32), {
    position: [0, 0.03 + bandH / 2, 0],
  })

  // Gable roof: a rounded triangular prism, ridge along x so the front slope faces the camera
  const half = side / 2 - 0.004
  const tri = roundedPoly(
    [
      [-half, 0],
      [half, 0],
      [0, roofH],
    ],
    0.08,
  )
  const roof = extrude(tri, side - 0.05, 0.012, 6, 2)
  roof.translate(0, 0, -(side - 0.05) / 2)
  roof.rotateY(Math.PI / 2)
  k.add(roof, (_p, n, out) => {
    mix(out, C.carton, band, n.z > 0.3 || n.z < -0.3 ? 0.28 : 0)
    if (Math.abs(n.x) > 0.55) mix(out, C.carton, C.cartonShade, 0.5)
    toonShade(out, n, 0.2, 0.3)
  }, { position: [0, bodyH - 0.01, 0] })

  // Colored top fold (the fin) along the ridge
  k.add(smooth(new RoundedBoxGeometry(side - 0.06, 0.075, 0.07, 2, 0.028)), toon(band, 0.2, 0.3), {
    position: [0, bodyH + roofH - 0.012, 0],
  })
  // Light symbol on the front and the side
  const sym = new THREE.Shape()
  if (symbol === 'drop') {
    sym.moveTo(0, 0.1)
    sym.bezierCurveTo(0.03, 0.05, 0.085, -0.0, 0.085, -0.045)
    sym.absarc(0, -0.045, 0.085, 0, Math.PI, true)
    sym.bezierCurveTo(-0.085, -0.0, -0.03, 0.05, 0, 0.1)
  } else {
    sym.moveTo(0, -0.09)
    sym.bezierCurveTo(-0.14, 0.0, -0.12, 0.11, -0.05, 0.1)
    sym.bezierCurveTo(-0.02, 0.095, 0, 0.07, 0, 0.055)
    sym.bezierCurveTo(0, 0.07, 0.02, 0.095, 0.05, 0.1)
    sym.bezierCurveTo(0.12, 0.11, 0.14, 0.0, 0, -0.09)
  }
  const face = side / 2 + 0.008
  const symY = 0.03 + bandH / 2
  const mark = () => extrude(sym, 0.012, 0.012, 12, 2)
  k.add(mark(), toon(bandLight, 0.15, 0.2), { position: [0, symY, face - 0.012], scale: 1.7 })
  k.add(mark(), toon(bandLight, 0.15, 0.2), { position: [face - 0.012, symY, 0], rotation: [0, Math.PI / 2, 0], scale: 1.7 })
  // A big symbol in the band color on the front roof slope, the surface the camera sees best
  const lean = Math.atan2(half, roofH)
  const nrm = new THREE.Vector3(0, Math.sin(lean), Math.cos(lean))
  const mid = new THREE.Vector3(0, bodyH - 0.01 + roofH / 2, half / 2 + 0.02).addScaledVector(nrm, 0.0)
  k.add(mark(), toon(band, 0.2, 0.25), { position: mid.toArray(), rotation: [-lean, 0, 0], scale: 1.35 })
  return k.build()
}

export const chocolateMilk = () => carton(C.chocoPanel, C.chocoLight, 'drop')
export const milk1pct = () => carton(C.milkPanel, C.white, 'drop')
export const milkFatFree = () => carton(C.skimPanel, C.white, 'heart')

// ---------------------------------------------------------------- registry

/** New-style builders, keyed by food id. Anything missing falls back to the old model in items.ts. */
export const MODELS: Partial<Record<FoodId, () => BuiltFood>> = {
  dinner_roll: dinnerRoll,
  brown_rice: brownRice,
  whole_wheat_tortilla: wholeWheatTortilla,
  whole_wheat_pita: wholeWheatPita,
  chocolate_milk: chocolateMilk,
  milk_1pct: milk1pct,
  milk_fat_free: milkFatFree,
}

/** Fallback models for unknown items, keyed by compartment. */
export const FALLBACKS: Partial<Record<Component, () => BuiltFood>> = {
  grain: breadSlices,
  milk: () => carton(C.milkLight, C.white, 'drop'),
}
