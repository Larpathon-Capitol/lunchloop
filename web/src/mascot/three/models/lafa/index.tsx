// Lafa, the shawarma wrap: mascot of the South Asia, West Asia and Mediterranean world.
// A rolled, toasted flatbread with a spiral seam, wrapped halfway up in slanted paper printed
// with 8-point stars, one corner folded down. The face sits on the paper; pickled turnip,
// lettuce, tomato and a curl of garlic sauce peek out of the open top of the roll. The rig
// moves the whole body; this file drives the face and the filling from the rig input every frame.
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { MascotModelProps } from '../../contract'
import { eyeGloss, toy, TOY_BLUSH, TOY_INK } from '../../toy'
import { POSES, type FacePose } from './moods'
import {
  breadGeometry,
  breadTexture,
  lettuceGeometry,
  mouthGeometry,
  paperFlapGeometry,
  paperGeometry,
  paperRadius,
  paperSlope,
  paperTexture,
  RIPPLE_WEIGHT,
  sauceGeometry,
  sparkleGeometry,
} from './parts'

const EYE_Y = 0.365
const EYE_X = 0.09
const MOUTH_Y = 0.268
const BLUSH_Y = 0.292
const BLUSH_X = 0.166

/** Position and turn for a part sitting on the paper at (x, y), pushed out by `out`. */
function onPaper(x: number, y: number, out = 0): { position: [number, number, number]; rotation: THREE.Euler } {
  // Two passes: the paper radius depends a little on the angle.
  let th = Math.asin(THREE.MathUtils.clamp(x / paperRadius(0, y), -1, 1))
  const r = paperRadius(th, y) + out
  th = Math.asin(THREE.MathUtils.clamp(x / r, -1, 1))
  return {
    position: [Math.sin(th) * r, y, Math.cos(th) * r],
    rotation: new THREE.Euler(Math.atan(paperSlope(th, y)), th, 0, 'YXZ'),
  }
}

/** Frame-rate independent ease toward a target. */
function damp(cur: number, target: number, rate: number, dt: number): number {
  return cur + (target - cur) * (1 - Math.exp(-rate * dt))
}

function physical(params: THREE.MeshPhysicalMaterialParameters) {
  return new THREE.MeshPhysicalMaterial(params)
}

function useKit() {
  const kit = useMemo(() => {
    const paperTex = paperTexture()
    const breadTex = breadTexture()
    const geo = {
      paper: paperGeometry(),
      flap: paperFlapGeometry(),
      bread: breadGeometry(),
      lettuce: lettuceGeometry(),
      sauce: sauceGeometry(),
      mouth: mouthGeometry(),
      sparkle: sparkleGeometry(),
      sphere: new THREE.SphereGeometry(1, 32, 24),
      smallSphere: new THREE.SphereGeometry(1, 16, 12),
      // Lower half of a sphere: a D-shaped open smile once flattened.
      bowl: new THREE.SphereGeometry(1, 32, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
      turnip: new THREE.CapsuleGeometry(0.027, 0.15, 6, 14),
      tomato: new THREE.CylinderGeometry(0.072, 0.072, 0.024, 32),
      tomatoCore: new THREE.CircleGeometry(0.054, 32),
      arc: new THREE.TorusGeometry(0.048, 0.0115, 10, 32, Math.PI),
      brow: new THREE.CapsuleGeometry(0.0105, 0.046, 4, 10),
      blush: new THREE.CircleGeometry(0.04, 32),
    }
    const mat = {
      paper: physical({ ...toy('#ffffff', { gloss: 0.12, soft: 0.7 }), map: paperTex }),
      // The plain back of the sheet, seen on the folded corner.
      paperBack: physical({ ...toy('#efd5c2', { gloss: 0.08, soft: 0.7 }), side: THREE.DoubleSide }),
      bread: physical({ ...toy('#ffffff', { gloss: 0.1, soft: 0.8 }), map: breadTex }),
      meat: physical(toy('#b4602f', { gloss: 0.25 })),
      turnip: physical(toy('#ef4f8b', { gloss: 0.75 })),
      lettuce: physical({ ...toy('#79c96a', { gloss: 0.45 }), side: THREE.DoubleSide }),
      tomato: physical(toy('#ee4a3b', { gloss: 0.7 })),
      tomatoCore: physical(toy('#ff9478', { gloss: 0.5 })),
      sauce: physical({ ...toy('#fffaf3', { gloss: 1, soft: 0.3 }), roughness: 0.22 }),
      eye: physical(eyeGloss()),
      // Satin ink for strokes (closed eyes, brows, the mouth line) so they read as clean lines.
      line: physical({ color: TOY_INK, roughness: 0.45, clearcoat: 0.3, clearcoatRoughness: 0.5 }),
      glint: new THREE.MeshBasicMaterial({ color: '#ffffff' }),
      mouth: physical(toy('#5a1530', { gloss: 0.5 })),
      tongue: physical(toy(TOY_BLUSH, { gloss: 0.5 })),
      blush: new THREE.MeshBasicMaterial({
        color: TOY_BLUSH,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      }),
      sparkle: new THREE.MeshBasicMaterial({ color: '#ffc94a', side: THREE.DoubleSide }),
    }
    const rest = Float32Array.from(geo.paper.attributes.position.array as ArrayLike<number>)
    const rippleW = geo.paper.userData[RIPPLE_WEIGHT] as Float32Array
    return { geo, mat, tex: [paperTex, breadTex], rest, rippleW }
  }, [])
  useEffect(
    () => () => {
      Object.values(kit.geo).forEach((g) => g.dispose())
      Object.values(kit.mat).forEach((m) => m.dispose())
      kit.tex.forEach((t) => t.dispose())
    },
    [kit],
  )
  return kit
}

interface EyeRefs {
  open: THREE.Group | null
  ink: THREE.Mesh | null
  arc: THREE.Mesh | null
  brow: THREE.Group | null
}

// Everything in the filling stands inside the roll's opening (inner radius about 0.29).
const TURNIPS: { p: [number, number, number]; r: [number, number, number] }[] = [
  { p: [0.1, 0.9, -0.08], r: [-0.25, 0, -0.55] },
  { p: [0.02, 0.935, -0.13], r: [-0.3, 0, -0.12] },
  { p: [-0.07, 0.91, -0.1], r: [-0.25, 0, 0.38] },
  { p: [0.18, 0.865, 0.02], r: [0.15, 0, -0.9] },
  { p: [-0.17, 0.87, 0.01], r: [0.05, 0, 0.75] },
]
/** Lettuce leaves tucked in at the back corners, leaning out over the rim. */
const LETTUCE: { p: [number, number, number]; r: [number, number, number]; s: number }[] = [
  { p: [-0.17, 0.74, -0.06], r: [0.2, 0.35, 0.4], s: 1.3 },
  { p: [0.17, 0.74, -0.1], r: [-0.1, -0.4, -0.42], s: 1.15 },
]

export default function Lafa({ input }: MascotModelProps) {
  const { geo, mat, rest, rippleW } = useKit()

  const eyes = useRef<[EyeRefs, EyeRefs]>([
    { open: null, ink: null, arc: null, brow: null },
    { open: null, ink: null, arc: null, brow: null },
  ])
  const filling = useRef<THREE.Group>(null)
  const meat = useRef<THREE.Group>(null)
  const turnips = useRef<(THREE.Group | null)[]>([])
  const lettuce = useRef<(THREE.Group | null)[]>([])
  const tomato = useRef<THREE.Group>(null)
  const sauce = useRef<THREE.Group>(null)
  const sparkle = useRef<THREE.Mesh>(null)
  const mouth = useRef<THREE.Group>(null)
  const smile = useRef<THREE.Mesh>(null)
  const oval = useRef<THREE.Mesh>(null)
  const bowl = useRef<THREE.Mesh>(null)
  const blushes = useRef<(THREE.Mesh | null)[]>([])
  const tongue = useRef<THREE.Mesh>(null)
  const paper = useRef<THREE.Mesh>(null)
  const pose = useRef<FacePose>({ ...POSES.idle })
  const ripple = useRef(0)

  const anchors = useMemo(
    () => ({
      eyes: [onPaper(-EYE_X, EYE_Y, -0.004), onPaper(EYE_X, EYE_Y, -0.004)],
      mouth: onPaper(0, MOUTH_Y, 0),
      blush: [onPaper(-BLUSH_X, BLUSH_Y, 0.009), onPaper(BLUSH_X, BLUSH_Y, 0.009)],
    }),
    [],
  )

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1)
    const i = input.current
    const t = i.time
    const target = POSES[i.mood] ?? POSES.idle
    const p = pose.current
    for (const k of Object.keys(target) as (keyof FacePose)[]) {
      p[k] = damp(p[k], target[k], 9, dt)
    }
    const pet = i.pet
    const arc = Math.min(1, Math.max(p.arc, THREE.MathUtils.smoothstep(pet, 0.35, 0.75)))
    const squeeze = Math.max(p.squeeze, pet * 0.8)

    // Eyes: pupils drift with look, highlights stay put, blink squashes the whole eye.
    const lookX = THREE.MathUtils.clamp(i.look.x + p.lookX, -1.2, 1.2)
    const lookY = THREE.MathUtils.clamp(i.look.y + p.lookY, -1.2, 1.2)
    const openY = p.eyeOpen * (1 - 0.92 * i.blink)
    eyes.current.forEach((e, side) => {
      const s = p.eye * (side === 1 ? p.eyeAsym : 1)
      // Swapping to closed arcs plays like a blink: the open eye shuts, then the arc grows.
      const visible = 1 - THREE.MathUtils.smoothstep(arc, 0, 0.5)
      const arcGrow = THREE.MathUtils.smoothstep(arc, 0.5, 1)
      if (e.open) {
        e.open.visible = visible > 0.04
        e.open.scale.set(s * (0.6 + 0.4 * visible), Math.max(0.04, s * openY * visible), s)
      }
      if (e.ink) e.ink.position.set(lookX * 0.012, lookY * 0.01, 0.004)
      if (e.arc) {
        e.arc.visible = arcGrow > 0.04
        const a = arcGrow * p.eye
        e.arc.scale.set(a * (1 + 0.12 * squeeze + 0.1 * p.arcFlip), a * (1 - 0.5 * squeeze) * (1 - 0.35 * p.arcFlip), a)
        e.arc.rotation.z = p.arcFlip * Math.PI
        e.arc.position.set(side === 0 ? 0.006 * squeeze : -0.006 * squeeze, -0.018 - 0.01 * squeeze + p.arcFlip * 0.012, 0.012)
      }
      if (e.brow) {
        const dir = side === 0 ? 1 : -1
        const lift = p.browLift + (side === 1 ? p.browAsym : 0) + (p.eye - 1) * 0.06
        e.brow.position.set(0, 0.098 + lift, 0.004)
        e.brow.rotation.z = Math.PI / 2 + p.browTilt * dir
        e.brow.scale.setScalar(Math.max(0.001, THREE.MathUtils.smoothstep(p.brow, 0.1, 0.6)))
        e.brow.visible = p.brow > 0.1
      }
    })

    // Mouth: a curve when closed, an oval with a tongue when open, flapping with talk.
    const talkFlap = i.talk * (0.38 + 0.3 * Math.sin(t * 17) + 0.12 * Math.sin(t * 29))
    const open = THREE.MathUtils.clamp(Math.max(p.open, talkFlap) + (squeeze > 0.5 ? Math.sin(t * 5) * 0.06 : 0), 0, 1.1)
    const closedVis = 1 - THREE.MathUtils.smoothstep(open, 0.08, 0.3)
    if (mouth.current) {
      mouth.current.position.x = anchors.mouth.position[0] + p.mouthX
      mouth.current.rotation.z = p.mouthTilt
    }
    if (smile.current) {
      smile.current.visible = closedVis > 0.03
      smile.current.scale.set(p.mouthW * (0.7 + 0.3 * closedVis), Math.max(0.05, closedVis), 1)
      const inf = smile.current.morphTargetInfluences
      if (inf) {
        inf[0] = Math.max(0, -p.grin)
        inf[1] = Math.max(0, p.grin)
      }
    }
    // Round O and wide D trade places as p.round eases between them.
    const h = 0.038 * open * p.mouthH
    const round = p.round
    if (oval.current) {
      const k = round
      oval.current.visible = open > 0.06 && k > 0.03
      oval.current.scale.set(Math.max(0.001, 0.036 * p.mouthW * k), Math.max(0.001, h * k), 0.014)
    }
    if (bowl.current) {
      const k = 1 - round
      bowl.current.visible = open > 0.06 && k > 0.03
      bowl.current.position.y = 0.012
      bowl.current.scale.set(Math.max(0.001, 0.05 * p.mouthW * k), Math.max(0.001, h * 1.25 * k), 0.014)
    }
    if (tongue.current) {
      tongue.current.visible = open > 0.12
      const ty = round > 0.5 ? -h * 0.5 : 0.012 - h * 0.85
      tongue.current.position.set(0, ty, 0.006)
      tongue.current.scale.set((round > 0.5 ? 0.02 : 0.026) * p.mouthW, Math.max(0.001, h * 0.36), 0.009)
    }

    // Blush follows mood and petting.
    const blushOpacity = THREE.MathUtils.clamp(p.blush * 0.7 + pet * 0.3, 0, 0.95)
    blushes.current.forEach((m) => {
      if (m) (m.material as THREE.MeshBasicMaterial).opacity = blushOpacity
    })

    // Filling: sways, pops up after a hop and settles, lettuce wiggles while petted.
    // After a hop lands (bounce 1 decaying to 0): pop up, dip a little, settle.
    const b = i.bounce
    const popAt = (x: number) =>
      x < 0.45 ? 0.085 * Math.sin((Math.PI * x) / 0.45) : x < 0.8 ? -0.018 * Math.sin((Math.PI * (x - 0.45)) / 0.35) : 0
    const pop = b > 0 ? popAt(1 - b) : 0
    if (filling.current) {
      filling.current.position.y = p.lift + Math.max(-0.02, pop)
      filling.current.rotation.z = Math.sin(t * 1.3) * 0.035 * p.sway - lookX * 0.02
      filling.current.rotation.x = Math.sin(t * 0.9) * 0.02 * p.sway - lookY * 0.02
    }
    if (meat.current) meat.current.position.y = (p.lift + Math.max(-0.02, pop)) * 0.3
    turnips.current.forEach((g, k) => {
      if (!g) return
      const base = TURNIPS[k]
      const stagger = b > 0 ? popAt(Math.max(0, 1 - b - k * 0.04)) * 0.6 : 0
      g.position.y = base.p[1] + Math.sin(t * 1.7 * Math.max(0.5, p.sway) + k * 1.9) * 0.012 * p.sway + stagger
      g.rotation.z = base.r[2] + Math.sin(t * 1.2 + k) * 0.04 * p.sway
    })
    lettuce.current.forEach((g, k) => {
      if (!g) return
      const dir = k === 0 ? 1 : -1
      g.rotation.z = LETTUCE[k].r[2] + dir * (Math.sin(t * 1.1 + k) * 0.05 + Math.sin(t * 15 + k) * 0.2 * pet + b * 0.15)
    })
    if (tomato.current) tomato.current.rotation.z = -0.35 + Math.sin(t * 1.4 + 1) * 0.04 * p.sway
    if (sauce.current) {
      sauce.current.rotation.z = Math.sin(t * 2.1) * 0.07 * p.sway + Math.sin((1 - b) * 18) * b * 0.25
      const sy = 1 + pop * 1.2
      sauce.current.scale.set(0.92, 0.92 * sy, 0.92)
    }
    if (sparkle.current) {
      const s = p.sparkle * (0.75 + 0.25 * Math.sin(t * 7))
      sparkle.current.visible = s > 0.03
      sparkle.current.scale.setScalar(Math.max(0.001, s))
      sparkle.current.rotation.z += dt * 1.5
    }

    // The paper ripples while petted (never near the top edge, so it stays on the bread).
    const rTarget = Math.max(pet, i.mood === 'petted' ? 0.5 : 0)
    ripple.current = damp(ripple.current, rTarget, 6, dt)
    const mesh = paper.current
    if (mesh && (ripple.current > 0.002 || mesh.userData.rippled)) {
      const pos = mesh.geometry.attributes.position as THREE.BufferAttribute
      const amp = ripple.current * 0.011
      for (let k = 0; k < pos.count; k++) {
        const x = rest[k * 3]
        const y = rest[k * 3 + 1]
        const z = rest[k * 3 + 2]
        const w = rippleW[k]
        const phi = Math.atan2(x, z)
        const s = 1 + amp * w * Math.sin(phi * 7 + y * 26 - t * 7)
        pos.setXYZ(k, x * s, y, z * s)
      }
      pos.needsUpdate = true
      mesh.geometry.computeVertexNormals()
      mesh.userData.rippled = ripple.current > 0.002
    }
  })

  return (
    <group>
      <mesh geometry={geo.bread} material={mat.bread} />
      <mesh ref={paper} geometry={geo.paper} material={mat.paper} />
      <mesh geometry={geo.flap} material={mat.paperBack} />

      {/* The meat bed only bobs a little; the toppings above it do the popping. */}
      <group ref={meat}>
        <mesh geometry={geo.sphere} material={mat.meat} position={[0, 0.8, 0]} scale={[0.285, 0.08, 0.285]} />
        <mesh geometry={geo.smallSphere} material={mat.meat} position={[-0.1, 0.865, 0.11]} scale={[0.07, 0.042, 0.06]} rotation={[0.3, 0, 0.4]} />
        <mesh geometry={geo.smallSphere} material={mat.meat} position={[0.04, 0.87, 0.14]} scale={[0.065, 0.038, 0.055]} rotation={[0.2, 0.5, -0.3]} />
      </group>

      <group ref={filling}>
        {TURNIPS.map((tp, k) => (
          <group key={k} ref={(g) => { turnips.current[k] = g }} position={tp.p} rotation={tp.r}>
            <mesh geometry={geo.turnip} material={mat.turnip} />
          </group>
        ))}
        {LETTUCE.map((l, k) => (
          <group key={k} ref={(g) => { lettuce.current[k] = g }} position={l.p} rotation={l.r} scale={l.s}>
            <mesh geometry={geo.lettuce} material={mat.lettuce} />
          </group>
        ))}
        <group ref={tomato} position={[0.12, 0.88, 0.13]} rotation={[1.0, 0, -0.35]}>
          <mesh geometry={geo.tomato} material={mat.tomato} />
          <mesh geometry={geo.tomatoCore} material={mat.tomatoCore} position={[0, 0.0125, 0]} rotation={[-Math.PI / 2, 0, 0]} />
        </group>
        <group ref={sauce} position={[-0.04, 0.86, 0.12]} scale={0.92}>
          <mesh geometry={geo.sauce} material={mat.sauce} />
          <mesh geometry={geo.smallSphere} material={mat.sauce} position={[0, -0.035, -0.01]} scale={[0.065, 0.028, 0.055]} />
          <mesh ref={sparkle} geometry={geo.sparkle} material={mat.sparkle} position={[0.17, 0.13, 0.06]} />
        </group>
      </group>

      {anchors.eyes.map((a, side) => (
        <group key={side} position={a.position} rotation={a.rotation}>
          <group ref={(g) => { eyes.current[side].open = g }}>
            <mesh
              ref={(m) => { eyes.current[side].ink = m }}
              geometry={geo.sphere}
              material={mat.eye}
              scale={[0.066, 0.078, 0.026]}
            />
            <mesh geometry={geo.smallSphere} material={mat.glint} position={[-0.022, 0.028, 0.027]} scale={[0.021, 0.025, 0.008]} />
            <mesh geometry={geo.smallSphere} material={mat.glint} position={[0.024, -0.028, 0.026]} scale={[0.01, 0.01, 0.005]} />
          </group>
          <mesh ref={(m) => { eyes.current[side].arc = m }} geometry={geo.arc} material={mat.line} visible={false} />
          <group ref={(g) => { eyes.current[side].brow = g }} visible={false}>
            <mesh geometry={geo.brow} material={mat.line} />
          </group>
        </group>
      ))}

      <group ref={mouth} position={anchors.mouth.position} rotation={anchors.mouth.rotation}>
        <mesh ref={smile} geometry={geo.mouth} material={mat.line} morphTargetInfluences={[0, 0]} position={[0, 0, 0.004]} />
        <mesh ref={oval} geometry={geo.sphere} material={mat.mouth} visible={false} />
        <mesh ref={bowl} geometry={geo.bowl} material={mat.mouth} visible={false} />
        <mesh ref={tongue} geometry={geo.smallSphere} material={mat.tongue} visible={false} />
      </group>

      {anchors.blush.map((a, side) => (
        <mesh key={side} ref={(m) => { blushes.current[side] = m }} geometry={geo.blush} material={mat.blush} position={a.position} rotation={a.rotation} scale={[1.45, 1, 1]} />
      ))}
    </group>
  )
}
