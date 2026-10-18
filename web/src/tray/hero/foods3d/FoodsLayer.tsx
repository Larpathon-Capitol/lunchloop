import { createPortal, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { FoodModel } from '../../foods'
import { stageBus } from '../../stageBus'
import { buildShadowTexture } from '../../studio'
import { buddyShape, type Buddy, type BuddyShape } from './cast'
import { computeLayout, type Layout } from './layout'

/*
 * The hero's little food crowd. Drawn in the tray's own canvas (no second WebGL context) but in a
 * scene of its own with its own camera, rendered after the tray with the depth cleared, so the
 * tray rig's camera and view offset never touch it. While mounted it takes over the canvas's
 * render call (a priority-1 frame callback draws the tray scene first, then this one); it is
 * unmounted as soon as the hero is left, which hands rendering straight back to the canvas.
 */

const FOV = 22
const CAM_POS = new THREE.Vector3(0, 4.2, 14)
/** Most triangles all the foods together may cost. */
const TRIANGLE_BUDGET = 40_000

// Springs: [stiffness, damping], mass 1.
const TURN: [number, number] = [70, 11]
const LEAN: [number, number] = [90, 10]
const POP: [number, number] = [210, 15]
const POP_OUT: [number, number] = [320, 26]
const SQUASH: [number, number] = [380, 13]
const GRAVITY = 15

type Spring = { x: number; v: number }
/** Still visibly travelling toward `target` (as opposed to resting on it). */
const moving = (s: Spring, target: number, eps: number) => Math.abs(target - s.x) > eps || Math.abs(s.v) > eps * 4
function step(s: Spring, target: number, [k, c]: [number, number], dt: number) {
  let left = Math.min(dt, 0.1)
  while (left > 0) {
    const h = Math.min(left, 1 / 120)
    s.v += (k * (target - s.x) - c * s.v) * h
    s.x += s.v * h
    left -= h
  }
}

interface Anim {
  yaw: Spring
  pitch: Spring
  roll: Spring
  pop: Spring
  squash: Spring
  hopY: number
  hopV: number
  near: boolean
  /** Already hopped off on the way out. */
  gone: boolean
  hopReadyAt: number
  seed: number
  delay: number
  /** World scale that gives the food its on-screen size. */
  scale: number
}

const newAnim = (i: number, reduced: boolean): Anim => ({
  yaw: { x: 0, v: 0 },
  pitch: { x: 0, v: 0 },
  roll: { x: 0, v: 0 },
  pop: { x: reduced ? 1 : 0, v: 0 },
  squash: { x: 0, v: 0 },
  hopY: 0,
  hopV: 0,
  near: false,
  gone: false,
  hopReadyAt: 0,
  seed: i * 1.73 + 0.4,
  delay: i * 0.07,
  scale: 0,
})

// Shared across every food and every mount.
let shadowMaterial: THREE.MeshBasicMaterial | null = null
const SHADOW_GEOMETRY = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)
function getShadowMaterial() {
  shadowMaterial ??= new THREE.MeshBasicMaterial({
    map: buildShadowTexture('#3a1626'),
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
    toneMapped: false,
  })
  return shadowMaterial
}

/** Where the pointer is, shared by all foods. Touch never writes it. */
const pointer = { x: 0, y: 0, active: false }

// One layer at a time ever exists (it lives in the one tray canvas), so its scene and camera can too.
const SCENE = new THREE.Scene()
const CAMERA = new THREE.PerspectiveCamera(FOV, 1, 0.5, 80)

const ray = new THREE.Raycaster()
const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
const ndc = new THREE.Vector2()
const tmpA = new THREE.Vector3()
const tmpB = new THREE.Vector3()
const shadowMatrix = new THREE.Matrix4()
const shadowQuat = new THREE.Quaternion()
const shadowScale = new THREE.Vector3()

interface Props {
  cast: Buddy[]
  leaving: boolean
  reduced: boolean
  coarse: boolean
  /** Bumped by the parent to ask for a fresh measure of the page. */
  measureKey: number
}

export function FoodsLayer({ cast, leaving, reduced, coarse, measureKey }: Props) {
  const { size, invalidate } = useThree()
  const scene = SCENE
  const camera = CAMERA
  const [layout, setLayout] = useState<Layout | null>(null)
  const leavingRef = useRef(leaving)
  useLayoutEffect(() => {
    leavingRef.current = leaving
  }, [leaving])

  // Measure the page: which spots are free, given the tray, the words and the stickers. Not
  // while hopping off: the tray is flying away then and the spots must not shift under them.
  useLayoutEffect(() => {
    if (leavingRef.current) return
    setLayout(computeLayout(size.width, size.height, cast.length))
  }, [size.width, size.height, cast.length, measureKey])

  // Keep the cast inside the triangle budget, dropping from the end of the row.
  const { list: shown, triangles } = useMemo(() => {
    if (!layout) return { list: [], triangles: 0 }
    const out: { buddy: Buddy; spot: Layout['spots'][number]; shape: BuddyShape; footprint: number }[] = []
    let tris = 0
    for (let i = 0; i < layout.spots.length && i < cast.length; i++) {
      const shape = buddyShape(cast[i].itemId, cast[i].component)
      if (tris + shape.triangles > TRIANGLE_BUDGET) break
      tris += shape.triangles
      out.push({ buddy: cast[i], spot: layout.spots[i], shape, footprint: shape.footprint })
    }
    return { list: out, triangles: tris }
  }, [layout, cast])

  useEffect(() => {
    // Handy in screenshot scripts: how many foods are out and what they cost.
    if (import.meta.env.DEV) (window as unknown as { __heroFoods?: unknown }).__heroFoods = { count: shown.length, triangles }
  }, [shown.length, triangles])

  const roots = useRef<(THREE.Group | null)[]>([])
  const pivots = useRef<(THREE.Group | null)[]>([])
  const shadows = useRef<THREE.InstancedMesh>(null)
  const anims = useRef<Anim[]>([])
  const clock = useRef({ t: 0, leftAt: -1, nextHop: 3.5, hops: 0 })

  // Ground positions and scales for the current spots, from the camera's real projection.
  useLayoutEffect(() => {
    camera.aspect = size.width / Math.max(size.height, 1)
    camera.position.copy(CAM_POS)
    camera.lookAt(0, 0, 0)
    camera.updateProjectionMatrix()
    camera.updateMatrixWorld()
    const list = anims.current
    list.length = shown.length
    shown.forEach(({ shape, spot }, i) => {
      list[i] ??= newAnim(i, reduced)
      const a = list[i]
      const root = roots.current[i]
      ndc.set((spot.x / size.width) * 2 - 1, -(spot.y / size.height) * 2 + 1)
      ray.setFromCamera(ndc, camera)
      if (!root || !ray.ray.intersectPlane(ground, tmpA)) return
      root.position.copy(tmpA)
      // Pixels per world unit at that spot, measured by projecting a 1 unit step.
      tmpB.copy(tmpA).project(camera)
      const x0 = tmpB.x
      tmpB.set(tmpA.x + 1, tmpA.y, tmpA.z).project(camera)
      const pxPerUnit = (Math.abs(tmpB.x - x0) * size.width) / 2
      a.scale = spot.size / pxPerUnit / shape.extent
    })
    invalidate()
  }, [shown, size.width, size.height, camera, reduced, invalidate])

  // Pointer tracking, page-wide like the tray's tilt. Touch is left alone (those foods wander).
  useEffect(() => {
    if (reduced || coarse) return
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      pointer.x = e.clientX
      pointer.y = e.clientY
      pointer.active = true
      invalidate()
    }
    const onLeave = () => {
      pointer.active = false
      invalidate()
    }
    window.addEventListener('pointermove', onMove)
    document.documentElement.addEventListener('pointerleave', onLeave)
    return () => {
      window.removeEventListener('pointermove', onMove)
      document.documentElement.removeEventListener('pointerleave', onLeave)
    }
  }, [reduced, coarse, invalidate])

  useEffect(() => {
    invalidate()
  }, [leaving, invalidate])

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1)
    const c = clock.current
    if (!reduced) c.t += dt
    if (leaving && c.leftAt < 0) c.leftAt = c.t
    const t = c.t
    const W = size.width
    const H = size.height
    // Fast: a hop, a pop, or a turn still catching up with the pointer. These get every frame.
    // Slow: breathing, the resting sway and the touch wander. These ride the stage's shared idle
    // tick instead, so the canvas is not held at full rate just to breathe.
    let fast = false
    let slow = false

    const list = anims.current
    // Now and then one of them (never several at once) gives a little hop on its own.
    if (!reduced && !leaving && t > c.nextHop && shown.length) {
      const a = list[(c.hops * 5 + 2) % shown.length]
      if (a && a.hopY === 0 && a.hopV === 0) a.hopV = 2.1
      c.hops++
      c.nextHop = t + 4.5 + ((c.hops * 2.39) % 3)
    }
    for (let i = 0; i < shown.length; i++) {
      const a = list[i]
      const root = roots.current[i]
      const pivot = pivots.current[i]
      if (!a || !root || !pivot) continue
      const { spot } = shown[i]
      const cx = spot.x
      const cy = spot.y - spot.size * 0.5

      if (reduced) {
        a.pop.x = leaving ? 0 : 1
        pivot.rotation.set(0, 0, 0)
        pivot.position.y = 0
      } else {
        // Entrance pops up in a ripple; leaving hops off and shrinks away, quickly.
        const started = leaving ? t - c.leftAt > i * 0.025 : t > a.delay
        if (leaving && started && !a.gone) {
          a.gone = true
          a.hopV = Math.max(a.hopV, 3.4)
        }
        const popTo = leaving ? (started ? 0 : a.pop.x) : started ? 1 : 0
        step(a.pop, popTo, leaving ? POP_OUT : POP, dt)
        if (moving(a.pop, popTo, 0.002)) fast = true

        // What to look at: the pointer, a slow wander on touch screens, or a calm sway at rest.
        let gx: number
        let gy: number
        let has = true
        if (coarse) {
          gx = W * (0.5 + Math.sin(t * 0.23) * 0.42 + Math.sin(t * 0.61 + a.seed) * 0.08)
          gy = H * (0.3 + Math.sin(t * 0.17 + 1.3) * 0.18)
        } else if (pointer.active) {
          gx = pointer.x
          gy = pointer.y
        } else {
          gx = cx
          gy = cy - 400
          has = false
        }
        const dx = gx - cx
        const dy = gy - cy
        const dist = Math.hypot(dx, dy)
        const close = has ? Math.exp(-dist / 260) : 0
        const yaw = has ? THREE.MathUtils.clamp(Math.atan2(dx, 380), -0.85, 0.85) : Math.sin(t * 0.4 + a.seed) * 0.22
        const pitch = has ? THREE.MathUtils.clamp(Math.atan2(-dy, 520) * 0.55, -0.12, 0.38) : 0.08
        const roll = has ? -THREE.MathUtils.clamp(dx / 650, -1, 1) * (0.07 + close * 0.16) : Math.sin(t * 0.7 + a.seed) * 0.03
        step(a.yaw, yaw, TURN, dt)
        step(a.pitch, pitch, TURN, dt)
        step(a.roll, roll, LEAN, dt)
        // Pointer-driven turns hold still once caught up; the sway and wander drift slowly forever.
        if (has && !coarse && (moving(a.yaw, yaw, 0.004) || moving(a.pitch, pitch, 0.004) || moving(a.roll, roll, 0.003))) fast = true

        // A hop when the pointer comes close, and now and then one on its own.
        const near = has && !coarse && dist < spot.size * 0.95
        if (near && !a.near && t > a.hopReadyAt && a.hopY === 0 && !leaving) {
          a.hopV = 3.6
          a.hopReadyAt = t + 0.6
        }
        a.near = near
        if (a.hopV !== 0 || a.hopY > 0) {
          a.hopV -= GRAVITY * dt
          a.hopY += a.hopV * dt
          if (a.hopY <= 0) {
            a.squash.v += Math.min(4.5, -a.hopV * 1.1)
            a.hopY = 0
            a.hopV = 0
          }
        }
        step(a.squash, 0, SQUASH, dt)
        if (a.hopY > 0 || a.hopV !== 0 || moving(a.squash, 0, 0.015)) fast = true

        pivot.rotation.set(-a.pitch.x, a.yaw.x, a.roll.x)
        pivot.position.y = a.hopY

      }

      const breath = reduced ? 0 : Math.sin(t * 2.1 + a.seed) * 0.018
      const sq = a.squash.x
      const pop = Math.max(0, a.pop.x)
      root.scale.set(a.scale * pop * (1 + sq * 0.22), a.scale * pop * (1 - sq * 0.35 + breath), a.scale * pop * (1 + sq * 0.22))
      root.visible = pop * a.scale > 1e-4

      // Contact shadow: shrinks and fades as the food leaves the table.
      const sh = shadows.current
      if (sh) {
        const lift = Math.min(a.hopY / 0.6, 1)
        const s = a.scale * pop * (1 - lift * 0.45) * shown[i].footprint
        shadowScale.set(s * 1.05, 1, s * 0.62)
        shadowMatrix.compose(root.position, shadowQuat, shadowScale)
        sh.setMatrixAt(i, shadowMatrix)
      }

      if (!reduced && !leaving && pop > 0.002) slow = true
    }
    const sh = shadows.current
    if (sh) {
      sh.count = shown.length
      sh.instanceMatrix.needsUpdate = true
    }

    // Draw: the tray scene with its own camera, then the foods on top with theirs.
    const gl = state.gl
    const auto = gl.autoClear
    gl.autoClear = true
    gl.render(state.scene, state.camera)
    gl.autoClear = false
    gl.clearDepth()
    scene.environment = state.scene.environment
    gl.render(scene, camera)
    gl.autoClear = auto

    if (document.hidden) return
    if (fast) state.invalidate()
    else if (slow) stageBus.idleFrame(state.invalidate)
  }, 1)

  return createPortal(
    <>
      <directionalLight position={[2, 5, 4]} intensity={1.35} />
      <directionalLight position={[-3, 2, 4]} intensity={0.4} color="#ffd6e0" />
      <ambientLight intensity={0.3} />
      <instancedMesh ref={shadows} args={[SHADOW_GEOMETRY, getShadowMaterial(), Math.max(shown.length, 1)]} renderOrder={-1} frustumCulled={false} key={shown.length} />
      {shown.map(({ buddy }, i) => {
        return (
          <group key={`${buddy.itemId}-${i}`} ref={(g) => void (roots.current[i] = g)} visible={false}>
            <group ref={(g) => void (pivots.current[i] = g)} rotation-order="ZXY">
              <FoodModel itemId={buddy.itemId} component={buddy.component} />
            </group>
          </group>
        )
      })}
    </>,
    scene,
  )
}
