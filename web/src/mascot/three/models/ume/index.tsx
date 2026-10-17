// Ume, the East & Southeast Asia mascot: a soft rice-ball toy with a nori belt, an ume
// blossom on the peak and a sakura sprig tucked under the belt. The rig moves the whole
// body; this file builds the shape once and drives the face and small parts every frame.
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { UmeMood } from '../../../types'
import type { MascotModelProps } from '../../contract'
import { TOY_BLUSH, TOY_INK, eyeGloss, toy } from '../../toy'
import {
  arcEyeGeometry,
  blossomCenterGeometry,
  bodyGeometry,
  facing,
  heartGeometry,
  lidGeometry,
  loosePetalGeometry,
  noriGeometry,
  openMouthGeometry,
  riceGrainTexture,
  sakuraBlossomGeometry,
  smileGeometry,
  softSpotTexture,
  surfaceAt,
  taperedTube,
  tongueGeometry,
  umeBlossomGeometry,
} from './geometry'

const RICE = '#fffdf8'
const NORI = '#1e3226'
const UME_PINK = '#ff8fab'
const SAKURA_PINK = '#ffc2d1'
const HEART_PINK = '#fb6f92'
const LEAF = '#5fb77a'
const BARK = '#5a2a3c'

// Face layout in model space.
const EYE_X = 0.158
const EYE_Y = 0.475
const EYE_R: [number, number, number] = [0.05, 0.064, 0.021]
const MOUTH_Y = 0.39
const BLUSH_X = 0.268
const BLUSH_Y = 0.418

/** Everything the face can do, as numbers that ease toward a mood's targets. */
interface Face {
  eye: number
  eyeW: number
  asym: number
  closed: number
  squeeze: number
  lid: number
  px: number
  py: number
  brow: number
  browL: number
  browR: number
  tiltL: number
  tiltR: number
  open: number
  mouthW: number
  mouthH: number
  tongue: number
  smileW: number
  smileC: number
  smileTilt: number
  smileX: number
  blush: number
  hl: number
}

const BASE: Face = {
  eye: 1, eyeW: 1, asym: 0, closed: 0, squeeze: 0, lid: 0.08, px: 0, py: 0,
  brow: 0, browL: 0, browR: 0, tiltL: 0, tiltR: 0,
  open: 0, mouthW: 1, mouthH: 1, tongue: 1,
  smileW: 1, smileC: 1, smileTilt: 0, smileX: 0, blush: 0.55, hl: 1,
}

const MOODS: Record<UmeMood, Face> = {
  idle: BASE,
  happy: { ...BASE, closed: 1, open: 0.85, blush: 0.85, lid: 0 },
  excited: { ...BASE, eye: 1.2, eyeW: 1.12, lid: 0, open: 1, mouthW: 1.2, mouthH: 1.25, blush: 1, brow: 1, browL: 0.7, browR: 0.7, hl: 1.35 },
  curious: { ...BASE, asym: 0.12, px: 0.5, py: 0.35, lid: 0, brow: 1, browL: 0.9, browR: -0.1, tiltL: 0.1, tiltR: -0.05, open: 0.42, mouthW: 0.5, mouthH: 0.85, tongue: 0, blush: 0.5 },
  thinking: { ...BASE, eye: 0.92, lid: 0.32, px: -0.7, py: 0.8, brow: 1, browL: 0.25, browR: -0.35, tiltL: 0.28, tiltR: 0.2, smileW: 0.66, smileC: 0.45, smileTilt: 0.26, smileX: 0.03, blush: 0.35 },
  sleepy: { ...BASE, eye: 0.96, lid: 0.8, py: -0.6, open: 0.22, mouthW: 0.38, mouthH: 0.6, tongue: 0, smileW: 0.6, blush: 0.3, hl: 0.7 },
  proud: { ...BASE, closed: 1, lid: 0, brow: 0.9, browL: 0.55, browR: 0.55, tiltL: -0.18, tiltR: -0.18, smileW: 1.45, smileC: 0.8, smileTilt: 0.14, smileX: 0.012, blush: 0.75 },
  petted: { ...BASE, closed: 1, squeeze: 1, lid: 0, open: 0.7, mouthW: 0.78, mouthH: 0.66, tongue: 0.8, blush: 1 },
  surprised: { ...BASE, eye: 1.3, eyeW: 1.14, lid: 0, open: 1, mouthW: 0.64, mouthH: 1.12, tongue: 0.25, brow: 1, browL: 1, browR: 1, blush: 0.4, hl: 1.15 },
}

const KEYS = Object.keys(BASE) as (keyof Face)[]
/** Moods where a stray petal is allowed to drift down and land on Ume's head. */
const CALM: ReadonlySet<UmeMood> = new Set<UmeMood>(['idle', 'curious', 'thinking', 'sleepy'])

const smooth = (a: number, b: number, k: number) => a + (b - a) * k

export default function Ume({ input }: MascotModelProps) {
  const built = useMemo(() => {
    const body = bodyGeometry()
    const grain = riceGrainTexture()
    const spot = softSpotTexture()
    const at = (x: number, y: number) => surfaceAt(body, x, y)

    const geo = {
      body,
      nori: noriGeometry(),
      eye: new THREE.SphereGeometry(1, 28, 20),
      lid: lidGeometry(),
      arc: arcEyeGeometry(EYE_R[0] * 1.1, EYE_R[1] * 0.45, 0.0105),
      brow: new THREE.CapsuleGeometry(0.0075, 0.042, 4, 10).rotateZ(Math.PI / 2),
      smile: smileGeometry(0.036, 0.017, 0.0085),
      mouth: openMouthGeometry(),
      tongue: tongueGeometry(),
      blush: new THREE.CircleGeometry(1, 32),
      ume: umeBlossomGeometry(0.025),
      umeCenter: blossomCenterGeometry(0.025),
      sakura: sakuraBlossomGeometry(0.042),
      sakuraCenter: blossomCenterGeometry(0.02),
      stem: taperedTube(
        new THREE.CatmullRomCurve3([
          new THREE.Vector3(-0.035, -0.02, -0.006),
          new THREE.Vector3(0.03, 0.004, 0.008),
          new THREE.Vector3(0.1, 0.03, 0.012),
          new THREE.Vector3(0.17, 0.068, 0.014),
        ]),
        0.0085,
        0.0035,
      ),
      twig: taperedTube(
        new THREE.QuadraticBezierCurve3(
          new THREE.Vector3(0.07, 0.02, 0.011),
          new THREE.Vector3(0.085, 0.06, 0.014),
          new THREE.Vector3(0.07, 0.095, 0.016),
        ),
        0.005,
        0.0028,
        12,
      ),
      leaf: new THREE.SphereGeometry(1, 16, 10),
      petal: loosePetalGeometry(0.046),
      heart: heartGeometry(0.035),
    }

    const mat = {
      rice: new THREE.MeshPhysicalMaterial({
        ...toy(RICE, { gloss: 0.22, soft: 0.6 }),
        bumpMap: grain,
        bumpScale: 0.9,
        emissive: new THREE.Color('#fff1ec'),
        emissiveIntensity: 0.45,
      }),
      nori: new THREE.MeshPhysicalMaterial({
        ...toy(NORI, { gloss: 0.18, soft: 0.3 }),
        bumpMap: grain,
        bumpScale: 0.6,
        side: THREE.DoubleSide,
      }),
      eye: new THREE.MeshPhysicalMaterial(eyeGloss()),
      ink: new THREE.MeshPhysicalMaterial({ ...toy(TOY_INK, { gloss: 0.5, soft: 0 }) }),
      mouth: new THREE.MeshPhysicalMaterial({ ...toy('#4a1426', { gloss: 0.4, soft: 0 }) }),
      tongue: new THREE.MeshPhysicalMaterial(toy(TOY_BLUSH, { gloss: 0.5 })),
      lid: new THREE.MeshPhysicalMaterial(toy('#f8e8e6', { gloss: 0.1, soft: 0.6 })),
      shine: new THREE.MeshBasicMaterial({ color: '#ffffff' }),
      blush: new THREE.MeshBasicMaterial({ color: TOY_BLUSH, alphaMap: spot, transparent: true, depthWrite: false, opacity: 0.6 }),
      ume: new THREE.MeshPhysicalMaterial(toy(UME_PINK, { gloss: 0.4 })),
      sakura: new THREE.MeshPhysicalMaterial(toy(SAKURA_PINK, { gloss: 0.35 })),
      center: new THREE.MeshPhysicalMaterial(toy(HEART_PINK, { gloss: 0.5 })),
      bark: new THREE.MeshPhysicalMaterial(toy(BARK, { gloss: 0.2, soft: 0.2 })),
      leaf: new THREE.MeshPhysicalMaterial(toy(LEAF, { gloss: 0.45 })),
      petal: new THREE.MeshPhysicalMaterial({ ...toy(SAKURA_PINK, { gloss: 0.35 }), transparent: true }),
      heart: new THREE.MeshPhysicalMaterial({ ...toy(HEART_PINK, { gloss: 0.6 }), transparent: true }),
    }

    // Where the face parts sit on the rice, found once.
    const eyes = [-1, 1].map((s) => {
      const { p, n } = at(s * EYE_X, EYE_Y)
      return { p: p.addScaledVector(n, 0.004), q: facing(n, 0.9) }
    })
    const mouthSpot = at(0, MOUTH_Y)
    const blushes = [-1, 1].map((s) => {
      const { p, n } = at(s * BLUSH_X, BLUSH_Y)
      return { p: p.addScaledVector(n, 0.009), q: facing(n, 0.1) }
    })
    const peak = at(0, 0.85)
    const sprig = at(0.175, 0.25)
    const landing = at(-0.12, 0.75)
    return {
      geo,
      mat,
      grain,
      spot,
      eyes,
      mouth: { p: mouthSpot.p.addScaledVector(mouthSpot.n, 0.002), q: facing(mouthSpot.n, 0.6) },
      blushes,
      peak: { p: peak.p.addScaledVector(peak.n, 0.012), q: facing(peak.n, 1.3) },
      sprig: { p: sprig.p.addScaledVector(sprig.n, 0.006), q: facing(sprig.n, 0.3) },
      landing: { p: landing.p.addScaledVector(landing.n, 0.008), q: facing(landing.n, 0.4) },
    }
  }, [])

  useEffect(
    () => () => {
      Object.values(built.geo).forEach((g) => g.dispose())
      Object.values(built.mat).forEach((m) => m.dispose())
      built.grain.dispose()
      built.spot.dispose()
    },
    [built],
  )

  const squish = useRef<THREE.Group>(null)
  const face = useRef<THREE.Group>(null)
  const nori = useRef<THREE.Mesh>(null)
  const eyeOpen = useRef<(THREE.Group | null)[]>([])
  const pupils = useRef<(THREE.Mesh | null)[]>([])
  const shines = useRef<(THREE.Group | null)[]>([])
  const lids = useRef<(THREE.Mesh | null)[]>([])
  const arcs = useRef<(THREE.Mesh | null)[]>([])
  const brows = useRef<(THREE.Mesh | null)[]>([])
  const smile = useRef<THREE.Mesh>(null)
  const mouth = useRef<THREE.Group>(null)
  const tongue = useRef<THREE.Mesh>(null)
  const blossom = useRef<THREE.Group>(null)
  const sprigSway = useRef<THREE.Group>(null)
  const petal = useRef<THREE.Mesh>(null)
  const heart = useRef<THREE.Mesh>(null)
  const blush = useRef<THREE.Mesh>(null)

  const state = useRef<{ f: Face; target: Face; melt: number; petalVis: number }>({
    f: { ...BASE },
    target: { ...BASE },
    melt: 0,
    petalVis: 0,
  })

  useFrame((_, delta) => {
    const i = input.current
    const s = state.current
    const dt = Math.min(delta, 0.1)
    const k = 1 - Math.exp(-dt * 11)
    const t = i.time

    // Mood targets, with petting blended on top of whatever mood is showing.
    const pet = THREE.MathUtils.clamp(i.pet, 0, 1)
    const petW = i.mood === 'petted' ? 1 : pet
    const from = MOODS[i.mood] ?? BASE
    for (const key of KEYS) s.target[key] = smooth(from[key], MOODS.petted[key], petW)
    for (const key of KEYS) s.f[key] = smooth(s.f[key], s.target[key], k)
    const f = s.f

    // Petting melts the rice flatter and wider. Scaling from y = 0 keeps the feet planted.
    s.melt = smooth(s.melt, petW, 1 - Math.exp(-dt * 6))
    const wob = Math.sin(t * 9) * 0.012 * s.melt
    squish.current?.scale.set(1 + 0.13 * s.melt + wob, 1 - 0.15 * s.melt - wob, 1 + 0.06 * s.melt)

    // Talking flaps the mouth open over whatever the mood wants.
    const flap = i.talk * (0.45 + 0.35 * Math.sin(t * 15) + 0.2 * Math.sin(t * 23.7))
    const open = Math.max(f.open, flap)

    // The face drifts a touch toward where Ume is looking, like the head is turning.
    face.current?.position.set(i.look.x * 0.012, i.look.y * 0.008, 0)

    for (let e = 0; e < 2; e++) {
      const side = e === 0 ? -1 : 1
      const size = f.eye * (1 + side * f.asym)
      const shut = 1 - 0.9 * THREE.MathUtils.clamp(i.blink, 0, 1)
      const show = THREE.MathUtils.clamp(1 - f.closed * 1.7, 0, 1)
      const g = eyeOpen.current[e]
      if (g) {
        g.scale.set(size * f.eyeW * Math.max(show, 0.001), size * shut * Math.max(show, 0.001), 1)
        g.visible = show > 0.02
      }
      pupils.current[e]?.position.set(
        THREE.MathUtils.clamp(i.look.x * 0.5 + f.px, -1, 1) * 0.0065,
        THREE.MathUtils.clamp(i.look.y * 0.5 + f.py, -1, 1) * 0.0075,
        0,
      )
      shines.current[e]?.scale.setScalar(f.hl)
      const lid = lids.current[e]
      if (lid) {
        lid.rotation.x = -Math.PI / 2 + f.lid * (Math.PI / 2 + 0.25)
        lid.visible = f.lid > 0.02
      }
      const arc = arcs.current[e]
      if (arc) {
        const c = THREE.MathUtils.smoothstep(f.closed, 0.35, 1)
        arc.scale.set(c * (1 + f.squeeze * 0.22), c * (1 - f.squeeze * 0.45), Math.max(c, 0.001))
        arc.visible = c > 0.02
      }
      const brow = brows.current[e]
      if (brow) {
        const raise = e === 0 ? f.browL : f.browR
        const tilt = e === 0 ? f.tiltL : -f.tiltR
        brow.position.set(side * EYE_X, EYE_Y + EYE_R[1] * f.eye + 0.032 + raise * 0.026, 0.0)
        brow.rotation.z = tilt
        brow.scale.setScalar(Math.max(f.brow, 0.001))
        brow.visible = f.brow > 0.02
      }
    }

    const sm = smile.current
    if (sm) {
      const vis = THREE.MathUtils.clamp(1 - open * 1.6, 0, 1)
      sm.scale.set(f.smileW * vis, Math.max(f.smileC, 0.35) * vis, Math.max(vis, 0.001))
      sm.position.set(f.smileX, 0.004 * (1 - f.smileC), 0)
      sm.rotation.z = f.smileTilt
      sm.visible = vis > 0.02
    }
    const m = mouth.current
    if (m) {
      m.scale.set(0.046 * f.mouthW * Math.max(open, 0.001), 0.042 * f.mouthH * Math.max(open, 0.001), 0.02)
      m.visible = open > 0.02
    }
    tongue.current?.scale.setScalar(Math.max(f.tongue, 0.001))

    const blushMat = blush.current?.material as THREE.MeshBasicMaterial | undefined
    if (blushMat) blushMat.opacity = THREE.MathUtils.clamp(f.blush * 0.7 + pet * 0.25, 0, 0.95)

    // Nori belt: the front edge peels and flutters after a hop, and flutters gently when happy.
    const n = nori.current
    if (n?.morphTargetInfluences) {
      const lively = i.mood === 'happy' || i.mood === 'excited' ? 0.18 : 0
      n.morphTargetInfluences[0] =
        Math.max(0, i.bounce * (0.55 + 0.45 * Math.sin(t * 24))) + lively * (0.5 + 0.5 * Math.sin(t * 7))
    }

    // Ume blossom on the peak bobs, more when excited or after a hop.
    const b = blossom.current
    if (b) {
      const speed = i.mood === 'excited' ? 4.2 : 2
      b.position.set(0, Math.sin(t * speed) * 0.004 + i.bounce * 0.02, 0)
      b.rotation.z = Math.sin(t * speed * 0.6) * 0.14 + i.bounce * Math.sin(t * 20) * 0.25
    }
    const sw = sprigSway.current
    if (sw) sw.rotation.z = -0.12 + Math.sin(t * 1.3) * 0.07 + Math.sin(t * 3.1) * 0.02 + i.bounce * Math.sin(t * 18) * 0.12

    // A stray petal drifts down, rests on the head, then blows away. Calm moods only.
    s.petalVis = smooth(s.petalVis, CALM.has(i.mood) && petW < 0.3 ? 1 : 0, 1 - Math.exp(-dt * 3))
    const pm = petal.current
    if (pm) {
      const land = built.landing.p
      const cyc = (t % 9) / 9
      let x = land.x
      let y = land.y
      let z = land.z
      let sc = 1
      let rz = 0.6
      if (cyc < 0.32) {
        const u = cyc / 0.32
        const e = 1 - (1 - u) * (1 - u)
        x = land.x + 0.22 * (1 - e) + Math.sin(u * 9) * 0.04 * (1 - u)
        y = land.y + 0.5 * (1 - e)
        z = land.z + 0.05 * (1 - e)
        rz = 0.6 + Math.sin(u * 7) * 0.9 * (1 - u)
        sc = Math.min(1, u * 6)
      } else if (cyc < 0.62) {
        rz = 0.6 + Math.sin(t * 2) * 0.05
      } else if (cyc < 0.86) {
        const u = (cyc - 0.62) / 0.24
        const e = u * u
        x = land.x - 0.42 * e
        y = land.y + 0.14 * e + Math.sin(u * 6) * 0.02
        z = land.z + 0.12 * e
        rz = 0.6 + e * 2.5
        sc = 1 - THREE.MathUtils.smoothstep(u, 0.6, 1)
      } else {
        sc = 0
      }
      pm.position.set(x, y, z)
      pm.rotation.z = rz
      const v = sc * s.petalVis
      pm.scale.setScalar(Math.max(v, 0.001))
      pm.visible = v > 0.02
    }

    // Petted: a little heart puffs out of the top and floats away, again and again.
    const h = heart.current
    if (h) {
      const u = (t % 1.5) / 1.5
      const on = THREE.MathUtils.clamp((petW - 0.25) * 2, 0, 1)
      h.position.set(0.2 + u * 0.1, 0.8 + u * 0.3, 0.16)
      h.rotation.z = -0.25 + Math.sin(u * 6.3) * 0.15
      const pop = Math.min(1, u * 5)
      h.scale.setScalar(Math.max(on * pop * (1 - u * 0.3), 0.001))
      const heartMat = h.material as THREE.MeshPhysicalMaterial
      heartMat.opacity = on * (1 - THREE.MathUtils.smoothstep(u, 0.55, 1))
      h.visible = on > 0.02
    }
  })

  const { geo, mat } = built
  return (
    <group>
      <group ref={squish}>
        <mesh geometry={geo.body} material={mat.rice} />
        <mesh ref={nori} geometry={geo.nori} material={mat.nori} morphTargetInfluences={[0]} />

        <group ref={face}>
          {built.eyes.map((spot, e) => (
            <group key={e} position={spot.p} quaternion={spot.q}>
              <group ref={(o) => { eyeOpen.current[e] = o }}>
                <mesh ref={(o) => { pupils.current[e] = o }} geometry={geo.eye} material={mat.eye} scale={EYE_R} />
                <group ref={(o) => { shines.current[e] = o }} position={[0, 0, EYE_R[2] * 0.7]}>
                  <mesh
                    geometry={geo.eye}
                    material={mat.shine}
                    position={[-EYE_R[0] * 0.34, EYE_R[1] * 0.36, 0]}
                    scale={[EYE_R[0] * 0.36, EYE_R[0] * 0.36, EYE_R[2] * 0.45]}
                  />
                  <mesh
                    geometry={geo.eye}
                    material={mat.shine}
                    position={[EYE_R[0] * 0.4, -EYE_R[1] * 0.38, 0]}
                    scale={[EYE_R[0] * 0.15, EYE_R[0] * 0.15, EYE_R[2] * 0.3]}
                  />
                </group>
                <mesh
                  ref={(o) => { lids.current[e] = o }}
                  geometry={geo.lid}
                  material={mat.lid}
                  scale={[EYE_R[0] * 1.02, EYE_R[1] * 1.02, EYE_R[2] * 1.5]}
                />
              </group>
              <mesh ref={(o) => { arcs.current[e] = o }} geometry={geo.arc} material={mat.ink} />
            </group>
          ))}

          {/* Brows sit in a flat frame over the eyes; they only show for a few moods. */}
          <group position={[0, 0, built.eyes[0].p.z + 0.004]}>
            {[0, 1].map((e) => (
              <mesh key={e} ref={(o) => { brows.current[e] = o }} geometry={geo.brow} material={mat.ink} />
            ))}
          </group>

          <group position={built.mouth.p} quaternion={built.mouth.q}>
            <mesh ref={smile} geometry={geo.smile} material={mat.ink} />
            <group ref={mouth}>
              <mesh geometry={geo.mouth} material={mat.mouth} position={[0, 0, -0.06]} />
              <mesh ref={tongue} geometry={geo.tongue} material={mat.tongue} position={[0, -0.5, 0.12]} />
            </group>
          </group>

          {built.blushes.map((spot, e) => (
            <mesh
              key={e}
              ref={e === 0 ? blush : undefined}
              geometry={geo.blush}
              material={mat.blush}
              position={spot.p}
              quaternion={spot.q}
              scale={[0.062, 0.036, 1]}
              renderOrder={2}
            />
          ))}
        </group>

        {/* Ume blossom on the peak. */}
        <group position={built.peak.p} quaternion={built.peak.q}>
          <group ref={blossom}>
            <mesh geometry={geo.ume} material={mat.ume} />
            <mesh geometry={geo.umeCenter} material={mat.center} />
          </group>
        </group>

        {/* Sakura sprig tucked under the belt. */}
        <group position={built.sprig.p} quaternion={built.sprig.q}>
          <group ref={sprigSway}>
            <mesh geometry={geo.stem} material={mat.bark} />
            <mesh geometry={geo.twig} material={mat.bark} />
            <mesh
              geometry={geo.leaf}
              material={mat.leaf}
              position={[0.045, -0.012, 0.012]}
              rotation={[0, 0, -0.55]}
              scale={[0.032, 0.013, 0.005]}
            />
            <group position={[0.172, 0.07, 0.018]} rotation={[0, 0, 0.3]}>
              <mesh geometry={geo.sakura} material={mat.sakura} />
              <mesh geometry={geo.sakuraCenter} material={mat.center} />
            </group>
            <group position={[0.07, 0.098, 0.018]} rotation={[0, 0, -0.2]} scale={0.78}>
              <mesh geometry={geo.sakura} material={mat.sakura} />
              <mesh geometry={geo.sakuraCenter} material={mat.center} />
            </group>
          </group>
        </group>
      </group>

      {/* Loose bits that float outside the squish. */}
      <mesh ref={petal} geometry={geo.petal} material={mat.petal} quaternion={built.landing.q} visible={false} />
      <mesh ref={heart} geometry={geo.heart} material={mat.heart} visible={false} />
    </group>
  )
}
