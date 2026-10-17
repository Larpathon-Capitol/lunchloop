// Chispa, the Americas mascot: a plump honey-glazed drumette with a pink glaze cap, a pleated
// paper frill on the knuckle and one wing tip that waves like an arm. The rig moves the whole
// body; this file drives the face, wing, frill and glaze shine from the rig input.
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { MascotModelProps } from '../../contract'
import { TOY_BLUSH, TOY_INK, eyeGloss, toy } from '../../toy'
import { buildBody, buildFrill, buildGlaze, buildMouth, buildSmile, buildSparkle, buildWing, fleckSpots, onSurface } from './geometry'
import { POSES, type ChispaPose } from './moods'

type NumKey = Exclude<keyof ChispaPose, 'look'>
const NUM_KEYS: NumKey[] = [
  'open', 'eyeScale', 'asym', 'arc', 'squeeze', 'lookMix', 'droop', 'flat', 'grin', 'pout',
  'mouth', 'mouthW', 'mouthH', 'tongue', 'blush', 'sparkle', 'wingZ', 'wingY', 'wingAmp', 'wingSpeed',
]

// Face layout on the body: eyes low and wide on the bulb, mouth under them, blush outside.
const EYE_THETA = 0.355
const EYE_Y = 0.405
const MOUTH_Y = 0.292
const BLUSH_THETA = 0.6
const BLUSH_Y = 0.318
const WING_THETA = 1.24
const WING_Y = 0.37
const SIDES = [-1, 1] as const

function smooth(x: number, a: number, b: number) {
  return THREE.MathUtils.smoothstep(x, a, b)
}

/** A soft round blush spot: pink in the middle fading to clear. */
function blushTexture(): THREE.CanvasTexture {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const g = canvas.getContext('2d')
  if (g) {
    const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    grad.addColorStop(0, 'rgba(255,255,255,1)')
    grad.addColorStop(0.55, 'rgba(255,255,255,0.75)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, size, size)
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function useChispaParts() {
  return useMemo(() => {
    const frill = buildFrill()
    const { mouth, tongue } = buildMouth()
    const blushMap = blushTexture()
    const geo = {
      body: buildBody(),
      glaze: buildGlaze(),
      frill: frill.geometry,
      ring: new THREE.TorusGeometry(0.138, 0.014, 10, 48),
      knuckle: new THREE.CapsuleGeometry(0.058, 0.07, 8, 20),
      wing: buildWing(),
      ball: new THREE.SphereGeometry(1, 32, 24),
      fleck: new THREE.SphereGeometry(1, 12, 8),
      arc: new THREE.TorusGeometry(0.042, 0.0105, 8, 24, Math.PI),
      cap: new THREE.SphereGeometry(0.0105, 10, 8),
      smile: buildSmile(),
      mouth,
      tongue,
      blush: new THREE.PlaneGeometry(1, 1),
      sparkle: buildSparkle(),
    }
    const mat = {
      skin: new THREE.MeshPhysicalMaterial({ ...toy('#ffffff', { gloss: 0.6, soft: 0.35 }), vertexColors: true }),
      wing: new THREE.MeshPhysicalMaterial(toy('#f7bb57', { gloss: 0.6, soft: 0.35 })),
      glaze: new THREE.MeshPhysicalMaterial({ ...toy('#ef4d72', { gloss: 1 }), roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.04, sheen: 0.2 }),
      fleck: new THREE.MeshPhysicalMaterial(toy('#d4832f', { gloss: 0.4, soft: 0.2 })),
      frill: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, flatShading: true, side: THREE.DoubleSide }),
      ring: new THREE.MeshPhysicalMaterial(toy('#5fb77a', { gloss: 0.4 })),
      knuckle: new THREE.MeshPhysicalMaterial(toy('#fff1dc', { gloss: 0.3, soft: 0.6 })),
      eye: new THREE.MeshPhysicalMaterial(eyeGloss()),
      shine: new THREE.MeshBasicMaterial({ color: '#ffffff' }),
      ink: new THREE.MeshPhysicalMaterial({ ...toy(TOY_INK, { gloss: 0.5 }), sheen: 0 }),
      mouth: new THREE.MeshStandardMaterial({ color: '#5a1430', roughness: 0.55 }),
      tongue: new THREE.MeshPhysicalMaterial(toy(TOY_BLUSH, { gloss: 0.5 })),
      blush: new THREE.MeshBasicMaterial({ color: TOY_BLUSH, map: blushMap, transparent: true, depthWrite: false, opacity: 0.5 }),
      sparkle: new THREE.MeshBasicMaterial({ color: '#fffaf0', transparent: true, toneMapped: false, side: THREE.DoubleSide }),
    }
    return { geo, mat, frillRest: frill.rest, blushMap }
  }, [])
}

/**
 * Chispa the chicken wing. Stands on y = 0, faces +z, about 0.95 units tall.
 * Reads mood, look, blink, talk, pet, bounce and time from `input` every frame.
 */
export default function Chispa({ input }: MascotModelProps) {
  const { geo, mat, frillRest, blushMap } = useChispaParts()

  useEffect(() => () => {
    for (const g of Object.values(geo)) g.dispose()
    for (const m of Object.values(mat)) m.dispose()
    blushMap.dispose()
  }, [geo, mat, blushMap])

  // Fixed placements on the skin, computed once.
  const layout = useMemo(() => {
    const eyes = SIDES.map((s) => onSurface(s * EYE_THETA, EYE_Y, 0.002))
    const blush = SIDES.map((s) => onSurface(s * BLUSH_THETA, BLUSH_Y, 0.007))
    const mouth = onSurface(0, MOUTH_Y, 0.003)
    const sparkles = [onSurface(-0.42, 0.665, 0.03), onSurface(0.62, 0.61, 0.03), onSurface(-0.05, 0.73, 0.02)]
    const wing = onSurface(WING_THETA, WING_Y, -0.035)
    return { eyes, blush, mouth, sparkles, wing }
  }, [])

  const fleckRef = useRef<THREE.InstancedMesh>(null)
  useEffect(() => {
    const mesh = fleckRef.current
    if (!mesh) return
    const m = new THREE.Matrix4()
    fleckSpots().forEach((f, i) => {
      const { position, quaternion } = onSurface(f.theta, f.y, -0.001)
      m.compose(position, quaternion, new THREE.Vector3(0.026 * f.s, 0.016 * f.s, 0.005))
      mesh.setMatrixAt(i, m)
    })
    mesh.instanceMatrix.needsUpdate = true
  }, [])

  const eyeRoot = useRef<(THREE.Group | null)[]>([])
  const eyeOpen = useRef<(THREE.Group | null)[]>([])
  const pupil = useRef<(THREE.Group | null)[]>([])
  const arcs = useRef<(THREE.Group | null)[]>([])
  const blushRefs = useRef<(THREE.Mesh | null)[]>([])
  const sparkRefs = useRef<(THREE.Mesh | null)[]>([])
  const smileRef = useRef<THREE.Mesh>(null)
  const mouthRef = useRef<THREE.Group>(null)
  const tongueRef = useRef<THREE.Mesh>(null)
  const wingRef = useRef<THREE.Group>(null)
  const frillRef = useRef<THREE.Mesh>(null)

  // Eased state, starting at the idle pose.
  const cur = useRef({ ...POSES.idle, lookX: 0, lookY: 0, phase: 0 })

  useFrame((_, delta) => {
    const inp = input.current
    const c = cur.current
    const p = POSES[inp.mood] ?? POSES.idle
    const dt = Math.min(delta, 0.1)
    const k = 1 - Math.exp(-dt * 9)
    for (const key of NUM_KEYS) c[key] += (p[key] - c[key]) * k
    c.lookX += (p.look[0] - c.lookX) * k
    c.lookY += (p.look[1] - c.lookY) * k
    c.phase += dt * c.wingSpeed
    const t = inp.time
    const pet = inp.pet

    // Eyes: petting closes them into arcs even before the mood catches up.
    const petClose = smooth(pet, 0.3, 0.75)
    const arc = Math.max(c.arc, petClose)
    const squeeze = Math.max(c.squeeze, petClose)
    const lookX = THREE.MathUtils.lerp(inp.look.x, c.lookX, c.lookMix)
    const lookY = THREE.MathUtils.lerp(inp.look.y, c.lookY, c.lookMix)
    const openY = THREE.MathUtils.lerp(c.open, 0.1, inp.blink)
    SIDES.forEach((side, i) => {
      const root = eyeRoot.current[i]
      const open = eyeOpen.current[i]
      const pu = pupil.current[i]
      const a = arcs.current[i]
      if (!root || !open || !pu || !a) return
      const lean = side < 0 ? 1 + c.asym : 1 - c.asym * 0.6
      root.scale.setScalar(c.eyeScale * lean)
      root.position.y = -c.droop * 0.014
      const keep = 1 - smooth(arc, 0, 0.55)
      open.visible = keep > 0.03
      open.scale.set(1 - arc * 0.25, Math.max(0.02, openY * keep), 1)
      // Highlights hide as the lids come down so a half-shut eye reads as sleepy, not glassy.
      const shine = smooth(openY * keep, 0.2, 0.55)
      for (const hl of open.children.slice(1)) {
        const base = hl.userData.s as [number, number, number]
        const f = Math.max(0.0001, shine)
        hl.scale.set(base[0] * f, base[1] * f, base[2] * f)
      }
      pu.position.set(lookX * 0.013, lookY * 0.011, 0)
      const show = smooth(arc, 0.3, 1)
      const sq = Math.max(0, squeeze)
      const smug = Math.max(0, -squeeze)
      a.visible = show > 0.03
      a.scale.set(show * (1 - sq * 0.12), show * (1 - sq * 0.4 - smug * 0.3), show)
      a.rotation.z = -side * (sq * 0.42 - smug * 0.12)
      a.position.y = -0.018 - sq * 0.008 + smug * 0.012
    })

    // Mouth: the closed curve morphs; the open D shape takes over for big moods and talking.
    const talkOpen = inp.talk * (0.3 + 0.55 * Math.abs(Math.sin(t * 9.5)))
    const talkWins = smooth(talkOpen - c.mouth, 0, 0.12)
    const open = Math.max(c.mouth, talkOpen)
    const mw = THREE.MathUtils.lerp(c.mouthW, 0.72, talkWins)
    const mh = THREE.MathUtils.lerp(c.mouthH, 1, talkWins)
    const smile = smileRef.current
    if (smile) {
      if (!smile.morphTargetInfluences) smile.updateMorphTargets()
      const inf = smile.morphTargetInfluences
      if (inf) {
        inf[0] = c.flat
        inf[1] = Math.max(c.grin, pet * 0.6)
        inf[2] = c.pout
      }
      const s = 1 - smooth(open, 0.04, 0.35)
      smile.visible = s > 0.02
      smile.scale.setScalar(Math.max(0.001, s))
    }
    const mouth = mouthRef.current
    if (mouth) {
      mouth.visible = open > 0.02
      mouth.scale.set(mw * (0.45 + 0.55 * open), Math.max(0.001, mh * open), 1)
    }
    const tongue = tongueRef.current
    if (tongue) tongue.scale.setScalar(Math.max(0.001, THREE.MathUtils.lerp(c.tongue, 0.8, talkWins)))

    // Blush warms up with the mood and with petting.
    const blush = Math.min(1, c.blush + pet * 0.5)
    blushRefs.current.forEach((b) => {
      if (!b) return
      ;(b.material as THREE.MeshBasicMaterial).opacity = 0.25 + blush * 0.6
      b.scale.set(0.105 * (1 + pet * 0.15), 0.066 * (1 + pet * 0.15), 1)
    })

    // Glaze sparkles twinkle out of step with each other.
    sparkRefs.current.forEach((sp, i) => {
      if (!sp) return
      const tw = 0.5 + 0.5 * Math.sin(t * 6.5 + i * 2.1)
      const s = c.sparkle * (0.35 + 0.65 * tw) * (i === 2 ? 0.022 : 0.032)
      sp.visible = s > 0.002
      sp.scale.setScalar(Math.max(0.0001, s))
      sp.rotation.z = t * 1.2 + i
    })

    // Wing tip: rests, waves, flaps on landing, tucks to the chin when thinking.
    const wing = wingRef.current
    if (wing) {
      const flap = inp.bounce * 0.95 * Math.abs(Math.sin(t * 24))
      wing.rotation.z = c.wingZ + Math.sin(c.phase) * c.wingAmp + flap + pet * 0.25 * Math.sin(t * 9)
      wing.rotation.y = c.wingY
    }

    // Frill: a soft rustle all the time, fluffing open when petted or after a hop.
    const frill = frillRef.current
    if (frill) {
      const attr = frill.geometry.getAttribute('position') as THREE.BufferAttribute
      const arr = attr.array as Float32Array
      const { theta, h, fold, y, r } = frillRest
      for (let v = 0; v < theta.length; v++) {
        const hv = Math.pow(h[v], 1.5)
        const f = 1 + hv * (pet * 0.4 + 0.045 * Math.sin(t * 3.2 + theta[v] * 3) + inp.bounce * 0.18 * Math.sin(t * 21 + theta[v] * 2))
        const rr = r[v] * fold[v] * f
        arr[v * 3] = rr * Math.sin(theta[v])
        arr[v * 3 + 1] = y[v] + h[v] * pet * 0.022
        arr[v * 3 + 2] = rr * Math.cos(theta[v])
      }
      attr.needsUpdate = true
    }
  })

  return (
    <group rotation={[0, 0, 0.12]}>
      <mesh geometry={geo.body} material={mat.skin} />
      <mesh geometry={geo.glaze} material={mat.glaze} />
      <instancedMesh ref={fleckRef} args={[geo.fleck, mat.fleck, fleckSpots().length]} />
      <mesh ref={frillRef} geometry={geo.frill} material={mat.frill} frustumCulled={false} />
      <mesh geometry={geo.ring} material={mat.ring} position={[0, 0.73, 0]} rotation={[Math.PI / 2, 0, 0]} />
      <mesh geometry={geo.knuckle} material={mat.knuckle} position={[0, 0.9, 0]} rotation={[0, 0, Math.PI / 2]} />

      <group position={layout.wing.position} rotation={[0, WING_THETA - Math.PI / 2, 0]}>
        <group ref={wingRef}>
          <mesh geometry={geo.wing} material={mat.wing} />
        </group>
      </group>

      {SIDES.map((side, i) => (
        <group key={side} position={layout.eyes[i].position} quaternion={layout.eyes[i].quaternion}>
          <group ref={(g) => { eyeRoot.current[i] = g }}>
            <group ref={(g) => { eyeOpen.current[i] = g }}>
              <group ref={(g) => { pupil.current[i] = g }}>
                <mesh geometry={geo.ball} material={mat.eye} scale={[0.068, 0.088, 0.03]} />
              </group>
              <mesh geometry={geo.ball} material={mat.shine} position={[-0.024, 0.032, 0.027]} scale={[0.019, 0.022, 0.006]} userData={{ s: [0.019, 0.022, 0.006] }} />
              <mesh geometry={geo.ball} material={mat.shine} position={[0.022, -0.03, 0.026]} scale={[0.009, 0.009, 0.004]} userData={{ s: [0.009, 0.009, 0.004] }} />
            </group>
            <group ref={(g) => { arcs.current[i] = g }} position={[0, -0.018, 0.006]} visible={false}>
              <mesh geometry={geo.arc} material={mat.ink} />
              <mesh geometry={geo.cap} material={mat.ink} position={[0.042, 0, 0]} />
              <mesh geometry={geo.cap} material={mat.ink} position={[-0.042, 0, 0]} />
            </group>
          </group>
        </group>
      ))}

      <group position={layout.mouth.position} quaternion={layout.mouth.quaternion}>
        <mesh ref={smileRef} geometry={geo.smile} material={mat.ink} position={[0, 0, 0.004]} />
        <group ref={mouthRef} visible={false}>
          <mesh geometry={geo.mouth} material={mat.mouth} />
          <mesh ref={tongueRef} geometry={geo.tongue} material={mat.tongue} position={[0, 0, 0.006]} />
        </group>
      </group>

      {SIDES.map((side, i) => (
        <mesh
          key={side}
          ref={(m) => { blushRefs.current[i] = m }}
          geometry={geo.blush}
          material={mat.blush}
          position={layout.blush[i].position}
          quaternion={layout.blush[i].quaternion}
          scale={[0.105, 0.066, 1]}
        />
      ))}

      {layout.sparkles.map((s, i) => (
        <mesh
          key={i}
          ref={(m) => { sparkRefs.current[i] = m }}
          geometry={geo.sparkle}
          material={mat.sparkle}
          position={s.position}
          quaternion={s.quaternion}
          visible={false}
        />
      ))}
    </group>
  )
}
