// Procedural shapes for Ume the onigiri: the puffy rice body, the nori belt that hugs it,
// blossoms, the sakura sprig, the face parts and the small canvas textures.
// Everything is built once in model space (stands on y = 0, faces +z, about 1 unit tall).
import * as THREE from 'three'
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/** Rounded-triangle outline: radius by angle, apex up. Two cosine terms keep the sides soft. */
function outline(theta: number) {
  const phi = theta - Math.PI / 2
  return 1 + 0.15 * Math.cos(3 * phi) + 0.035 * Math.cos(6 * phi)
}

const BASE = 0.5
const WIDE = 1.05
const HALF_DEPTH = 0.27
const FLOOR = -0.31
const FLOOR_SOFT = 0.05

/** Maps a point on the unit sphere onto the onigiri surface (before it is lifted onto the ground). */
function shape(x: number, y: number, z: number, grow = 1): THREE.Vector3 {
  const r = outline(Math.atan2(y, x)) * BASE * grow
  let py = y * r
  const px = x * r * WIDE
  // Flatter front and back with a rounded rim, a little thinner toward the peak.
  const taper = 1 - 0.18 * Math.max(0, py / 0.6)
  const pz = Math.sign(z) * Math.pow(Math.abs(z), 0.72) * HALF_DEPTH * taper * grow
  // Soft flat bottom so it sits like a real rice ball.
  if (py < FLOOR) {
    const d = FLOOR - py
    py = FLOOR - FLOOR_SOFT * Math.tanh(d / FLOOR_SOFT)
  }
  return new THREE.Vector3(px, py, pz)
}

const LIFT = -(FLOOR - FLOOR_SOFT * Math.tanh((FLOOR + (1 - 0.15 + 0.035) * BASE) / FLOOR_SOFT))

/** World height the raw shape is scaled to, so body plus blossom stays inside 1 unit. */
const TARGET_H = 0.92
const RAW_H = (1 + 0.15 + 0.035) * BASE + LIFT
export const BODY_SCALE = TARGET_H / RAW_H

function place(v: THREE.Vector3) {
  v.y += LIFT
  return v.multiplyScalar(BODY_SCALE)
}

/** Body: a dense sphere pushed into the onigiri shape, seams welded for smooth normals. */
export function bodyGeometry() {
  const src = new THREE.SphereGeometry(1, 96, 64)
  src.deleteAttribute('uv')
  src.deleteAttribute('normal')
  const g = mergeVertices(src, 1e-5)
  src.dispose()
  const pos = g.attributes.position as THREE.BufferAttribute
  const uv = new Float32Array(pos.count * 2)
  const v = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize()
    const p = place(shape(v.x, v.y, v.z))
    pos.setXYZ(i, p.x, p.y, p.z)
    // Planar map with a little depth mixed in, enough for grain noise.
    uv[i * 2] = p.x * 2.2 + p.z * 1.1
    uv[i * 2 + 1] = p.y * 2.2 - p.z * 0.7
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  g.computeVertexNormals()
  return g
}

/** Front top edge height of the nori, in model space. */
export const NORI_TOP = 0.3

/**
 * Nori: a band of the same surface, grown a hair so it hugs the rice, wrapping from the
 * front under the bottom to the back. Morph target 0 peels the front edge outward.
 */
export function noriGeometry() {
  const half = 0.36
  const start = 1.75
  const g = new THREE.SphereGeometry(1, 72, 10, start, 2 * Math.PI - 2 * start, Math.PI / 2 - half, half * 2)
  g.rotateZ(-Math.PI / 2)
  const pos = g.attributes.position as THREE.BufferAttribute
  const v = new THREE.Vector3()
  const peel = new Float32Array(pos.count * 3)
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize()
    const p = place(shape(v.x, v.y, v.z, 1.012))
    pos.setXYZ(i, p.x, p.y, p.z)
  }
  g.computeVertexNormals()
  const nrm = g.attributes.normal as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i)
    const z = pos.getZ(i)
    if (z <= 0) continue
    // Weight is 1 at the front top edge and fades out lower down.
    const w = THREE.MathUtils.smoothstep(y, NORI_TOP * 0.25, NORI_TOP + 0.02)
    const x = pos.getX(i)
    peel[i * 3] = nrm.getX(i) * 0.05 * w * w + x * 0.08 * w * w
    peel[i * 3 + 1] = 0.035 * w * w
    peel[i * 3 + 2] = nrm.getZ(i) * 0.07 * w * w
  }
  g.morphAttributes.position = [new THREE.BufferAttribute(peel, 3)]
  g.morphTargetsRelative = true
  return g
}

/** Point and outward normal on the body front at (x, y), found once with a ray. */
export function surfaceAt(body: THREE.BufferGeometry, x: number, y: number) {
  const mesh = new THREE.Mesh(body)
  const ray = new THREE.Raycaster(new THREE.Vector3(x, y, 2), new THREE.Vector3(0, 0, -1))
  const hit = ray.intersectObject(mesh, false)[0]
  if (!hit) return { p: new THREE.Vector3(x, y, 0.2), n: new THREE.Vector3(0, 0, 1) }
  const n = hit.face ? hit.face.normal.clone() : new THREE.Vector3(0, 0, 1)
  return { p: hit.point.clone(), n }
}

/** Quaternion that turns +z onto a normal, nudged toward the camera by `face`. */
export function facing(n: THREE.Vector3, face = 0) {
  const dir = n.clone().add(new THREE.Vector3(0, 0, face)).normalize()
  return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir)
}

/** Five round ume petals, merged, lying in the xy plane facing +z. */
export function umeBlossomGeometry(r: number) {
  const parts: THREE.BufferGeometry[] = []
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 + Math.PI / 2
    const petal = new THREE.SphereGeometry(r, 18, 12)
    petal.scale(1, 1, 0.35)
    petal.translate(Math.cos(a) * r * 0.95, Math.sin(a) * r * 0.95, -k * 0.0008)
    parts.push(petal)
  }
  const g = mergeGeometries(parts)
  parts.forEach((p) => p.dispose())
  return g
}

/** Blossom heart: a pink-5 dome with a ring of tiny stamen dots. */
export function blossomCenterGeometry(r: number) {
  const parts: THREE.BufferGeometry[] = []
  const core = new THREE.SphereGeometry(r * 0.45, 14, 10)
  core.scale(1, 1, 0.6)
  core.translate(0, 0, r * 0.25)
  parts.push(core)
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2
    const dot = new THREE.SphereGeometry(r * 0.13, 8, 6)
    dot.translate(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6, r * 0.32)
    parts.push(dot)
  }
  const g = mergeGeometries(parts)
  parts.forEach((p) => p.dispose())
  return g
}

/** One sakura petal outline with the notched tip, base at the origin, tip up. */
function sakuraPetalShape(len: number) {
  const w = len * 0.52
  const s = new THREE.Shape()
  s.moveTo(0, 0)
  s.bezierCurveTo(w * 0.9, len * 0.15, w, len * 0.7, w * 0.42, len)
  s.lineTo(0, len * 0.84)
  s.lineTo(-w * 0.42, len)
  s.bezierCurveTo(-w, len * 0.7, -w * 0.9, len * 0.15, 0, 0)
  return s
}

const softBevel = (len: number): THREE.ExtrudeGeometryOptions => ({
  depth: len * 0.04,
  bevelEnabled: true,
  bevelThickness: len * 0.08,
  bevelSize: len * 0.07,
  bevelSegments: 3,
  curveSegments: 10,
})

/** Five notched sakura petals, merged, cupped slightly toward +z. */
export function sakuraBlossomGeometry(len: number) {
  const parts: THREE.BufferGeometry[] = []
  for (let k = 0; k < 5; k++) {
    const petal = new THREE.ExtrudeGeometry(sakuraPetalShape(len), softBevel(len))
    petal.rotateX(-0.28)
    petal.rotateZ((k / 5) * Math.PI * 2)
    parts.push(petal)
  }
  const g = mergeGeometries(parts)
  parts.forEach((p) => p.dispose())
  g.computeVertexNormals()
  return g
}

/** A single loose sakura petal, centered, for the one that lands on Ume's head. */
export function loosePetalGeometry(len: number) {
  const g = new THREE.ExtrudeGeometry(sakuraPetalShape(len), softBevel(len))
  g.translate(0, -len * 0.5, 0)
  return g
}

/** Puffy heart for the petted puff. */
export function heartGeometry(size: number) {
  const s = new THREE.Shape()
  const k = size
  s.moveTo(0, -k * 0.9)
  s.bezierCurveTo(-k * 0.2, -k * 0.6, -k, -k * 0.15, -k, k * 0.3)
  s.bezierCurveTo(-k, k * 0.85, -k * 0.25, k * 0.95, 0, k * 0.45)
  s.bezierCurveTo(k * 0.25, k * 0.95, k, k * 0.85, k, k * 0.3)
  s.bezierCurveTo(k, -k * 0.15, k * 0.2, -k * 0.6, 0, -k * 0.9)
  const g = new THREE.ExtrudeGeometry(s, {
    depth: k * 0.15,
    bevelEnabled: true,
    bevelThickness: k * 0.22,
    bevelSize: k * 0.18,
    bevelSegments: 4,
    curveSegments: 14,
  })
  g.center()
  return g
}

/** A tube whose radius shrinks along its length, with a round cap at the thick end. */
export function taperedTube(curve: THREE.Curve<THREE.Vector3>, r0: number, r1: number, seg = 24) {
  const radial = 8
  const g = new THREE.TubeGeometry(curve, seg, 1, radial, false)
  const pos = g.attributes.position as THREE.BufferAttribute
  const c = new THREE.Vector3()
  const v = new THREE.Vector3()
  for (let i = 0; i <= seg; i++) {
    curve.getPointAt(i / seg, c)
    const r = THREE.MathUtils.lerp(r0, r1, i / seg)
    for (let j = 0; j <= radial; j++) {
      const idx = i * (radial + 1) + j
      v.fromBufferAttribute(pos, idx).sub(c).multiplyScalar(r).add(c)
      pos.setXYZ(idx, v.x, v.y, v.z)
    }
  }
  g.computeVertexNormals()
  return g
}

/** A tube along a curve with soft spherical end caps (for the smile and arc eyes). */
export function cappedTube(curve: THREE.Curve<THREE.Vector3>, r: number, seg = 24) {
  const tube = new THREE.TubeGeometry(curve, seg, r, 10, false)
  const a = new THREE.SphereGeometry(r, 10, 8)
  a.translate(...curve.getPointAt(0).toArray())
  const b = new THREE.SphereGeometry(r, 10, 8)
  b.translate(...curve.getPointAt(1).toArray())
  const g = mergeGeometries([tube, a, b])
  tube.dispose()
  a.dispose()
  b.dispose()
  return g
}

/** Closed happy eye: an upside-down U, centered on its middle. */
export function arcEyeGeometry(w: number, h: number, r: number) {
  const curve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(-w, -h * 0.5, 0),
    new THREE.Vector3(0, h * 1.5, 0),
    new THREE.Vector3(w, -h * 0.5, 0),
  )
  return cappedTube(curve, r)
}

/** Closed smile: a soft U, centered on its middle. */
export function smileGeometry(w: number, h: number, r: number) {
  const curve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(-w, h * 0.5, 0),
    new THREE.Vector3(0, -h * 1.5, 0),
    new THREE.Vector3(w, h * 0.5, 0),
  )
  return cappedTube(curve, r)
}

/** Open mouth: a soft D (flat-ish top, round bottom), unit sized, origin at its middle. */
export function openMouthGeometry() {
  const s = new THREE.Shape()
  s.moveTo(-1, 0.35)
  s.quadraticCurveTo(0, 0.55, 1, 0.35)
  s.bezierCurveTo(1.05, -0.45, 0.55, -0.95, 0, -0.95)
  s.bezierCurveTo(-0.55, -0.95, -1.05, -0.45, -1, 0.35)
  const g = new THREE.ExtrudeGeometry(s, {
    depth: 0.05,
    bevelEnabled: true,
    bevelThickness: 0.12,
    bevelSize: 0.1,
    bevelSegments: 3,
    curveSegments: 16,
  })
  return g
}

/** Tongue: a small pink oval that sits in the bottom of the open mouth. */
export function tongueGeometry() {
  const g = new THREE.SphereGeometry(1, 20, 12)
  g.scale(0.62, 0.38, 0.2)
  return g
}

/** Lid: the upper half of a sphere. Rotating it about x lowers it over the eye. */
export function lidGeometry() {
  return new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2)
}

/** Grey noise of tiny rice grains, used as a bump and roughness map. */
export function riceGrainTexture() {
  const size = 256
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const ctx = c.getContext('2d')
  if (ctx) {
    ctx.fillStyle = '#7a7a7a'
    ctx.fillRect(0, 0, size, size)
    // Seeded so the grains are the same every load.
    let seed = 7
    const rnd = () => {
      seed = (seed * 16807) % 2147483647
      return seed / 2147483647
    }
    for (let i = 0; i < 520; i++) {
      const x = rnd() * size
      const y = rnd() * size
      const a = rnd() * Math.PI
      const l = 6 + rnd() * 4
      const shade = 150 + Math.floor(rnd() * 80)
      // Draw wrapped copies so the tile repeats without seams.
      for (const dx of [-size, 0, size]) {
        for (const dy of [-size, 0, size]) {
          const g = ctx.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, l)
          g.addColorStop(0, `rgb(${shade},${shade},${shade})`)
          g.addColorStop(1, 'rgba(122,122,122,0)')
          ctx.save()
          ctx.translate(x + dx, y + dy)
          ctx.rotate(a)
          ctx.scale(1, 0.45)
          ctx.translate(-(x + dx), -(y + dy))
          ctx.fillStyle = g
          ctx.beginPath()
          ctx.arc(x + dx, y + dy, l, 0, Math.PI * 2)
          ctx.fill()
          ctx.restore()
        }
      }
    }
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = THREE.RepeatWrapping
  t.wrapT = THREE.RepeatWrapping
  t.repeat.set(1.6, 1.6)
  return t
}

/** Soft round alpha spot for blush. */
export function softSpotTexture() {
  const size = 64
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const ctx = c.getContext('2d')
  if (ctx) {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.55, 'rgba(255,255,255,0.85)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, size, size)
  }
  return new THREE.CanvasTexture(c)
}
