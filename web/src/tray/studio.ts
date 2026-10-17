import * as THREE from 'three'

/*
 * Studio lighting and a soft floor shadow, built from plain three.js so the scene needs no
 * network fetch, no HDR loaders, and no per-frame shadow render.
 */

interface Former {
  form?: 'rect' | 'ring'
  intensity: number
  color: string
  position: [number, number, number]
  scale: [number, number]
  /** Explicit rotation. When missing the panel faces the origin. */
  rotation?: [number, number, number]
}

// The room the steel reflects: a dim, slightly cool gray, so the softboxes read as crisp streaks.
const BASE = '#40454e'

const FORMERS: Former[] = [
  // Big, dim overhead softbox plus two long bright strips: the long specular streaks across the
  // rim and the bevels that make polished steel read as steel.
  { intensity: 0.55, color: '#ffffff', position: [0, 7, 0], rotation: [Math.PI / 2, 0, 0], scale: [14, 9] },
  { intensity: 4.2, color: '#ffffff', position: [0, 6.9, 1.8], rotation: [Math.PI / 2, 0, 0], scale: [13, 0.9] },
  { intensity: 3.0, color: '#ffffff', position: [0, 6.8, -1.2], rotation: [Math.PI / 2, 0, 0], scale: [13, 0.5] },
  // Behind the tray and up high: what the top surface reflects in the pick view.
  { intensity: 1.8, color: '#ffffff', position: [0, 5, -6], scale: [11, 2.2] },
  { intensity: 4.5, color: '#ffffff', position: [0, 3.2, -6.5], scale: [14, 0.45] },
  // A broad panel high behind the tray, about 45 to 68 degrees up: the top-down pick view looks
  // straight at it in the rim, so the rim reads as bright polished steel on the pale page too.
  { intensity: 1.7, color: '#ffffff', position: [0, 6.6, -4.5], scale: [14, 3.4] },
  // Long side strips give the rim and walls crisp edge highlights.
  { intensity: 3.2, color: '#ffffff', position: [-7, 1.5, 0], rotation: [0, Math.PI / 2, 0], scale: [12, 0.7] },
  { intensity: 2.2, color: '#fff1de', position: [7, 1.2, 0], rotation: [0, -Math.PI / 2, 0], scale: [12, 0.9] },
  // Warm fill from the front, like lamplight over a wooden counter. Ties the steel to the room.
  { intensity: 1.5, color: '#ffe2bf', position: [0, 0.6, 7], rotation: [0, Math.PI, 0], scale: [14, 2.2] },
  { intensity: 1.1, color: '#ffd9ad', position: [5, 2.5, 5], scale: [3, 3] },
  // Low front fill and a pale floor, so walls facing down or forward are not black.
  { intensity: 1.3, color: '#ffffff', position: [0, -3, 5], scale: [16, 4] },
  { intensity: 0.45, color: '#f4f6f8', position: [0, -6, 0], rotation: [-Math.PI / 2, 0, 0], scale: [16, 16] },
  // A small ring light for one sharp specular glint.
  { form: 'ring', intensity: 3.2, color: '#ffffff', position: [3, 5, 3], scale: [1.1, 1.1] },
]

/** Prefiltered environment map for metal reflections. Caller owns the returned render target. */
export function buildStudioEnvironment(renderer: THREE.WebGLRenderer) {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(BASE)
  const rect = new THREE.PlaneGeometry(1, 1)
  const ring = new THREE.RingGeometry(0.5, 1, 48)
  const materials: THREE.Material[] = []

  for (const f of FORMERS) {
    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(f.color).multiplyScalar(f.intensity),
      side: THREE.DoubleSide,
      toneMapped: false,
    })
    materials.push(material)
    const mesh = new THREE.Mesh(f.form === 'ring' ? ring : rect, material)
    mesh.position.set(...f.position)
    mesh.scale.set(f.scale[0], f.scale[1], 1)
    if (f.rotation) mesh.rotation.set(...f.rotation)
    else mesh.lookAt(0, 0, 0)
    scene.add(mesh)
  }

  const pmrem = new THREE.PMREMGenerator(renderer)
  const target = pmrem.fromScene(scene, 0.02)
  pmrem.dispose()
  rect.dispose()
  ring.dispose()
  materials.forEach((m) => m.dispose())
  return target
}

/** Soft elliptical shadow texture: a radial gradient, cheap enough for any phone. */
export function buildShadowTexture(color = '#1f2a36') {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const c = new THREE.Color(color)
  const rgb = `${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}`
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, `rgba(${rgb}, 1)`)
  g.addColorStop(0.45, `rgba(${rgb}, 0.7)`)
  g.addColorStop(0.75, `rgba(${rgb}, 0.22)`)
  g.addColorStop(1, `rgba(${rgb}, 0)`)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

/**
 * Brushed grain for the compartment floors: fine streaks running one way, used as a roughness
 * map so the light smears along the brush direction. Tiles seamlessly.
 */
export function buildBrushedTexture() {
  const w = 256
  const h = 256
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = 'rgb(128,128,128)'
  ctx.fillRect(0, 0, w, h)
  // Deterministic noise so every load looks the same.
  let seed = 7
  const rnd = () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
  for (let i = 0; i < 1400; i++) {
    const y = rnd() * h
    const x = rnd() * w
    const len = 40 + rnd() * 200
    const v = Math.round(108 + rnd() * 44)
    ctx.strokeStyle = `rgba(${v},${v},${v},${0.2 + rnd() * 0.35})`
    ctx.lineWidth = 0.4 + rnd() * 0.7
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + len, y + (rnd() - 0.5) * 0.6)
    ctx.stroke()
    // Wrap the streak so the texture tiles.
    if (x + len > w) {
      ctx.beginPath()
      ctx.moveTo(x - w, y)
      ctx.lineTo(x + len - w, y)
      ctx.stroke()
    }
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(1.2, 4.5)
  texture.anisotropy = 4
  return texture
}
