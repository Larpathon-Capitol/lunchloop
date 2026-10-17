import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

/*
 * A small folded paper chit lying in a compartment: the mark for "skipped on purpose".
 * Two leaves hinged along a center crease, opened almost flat, with a few lines of ink on one leaf.
 * Sits on y = 0 in the parent's space.
 */

const W = 0.5
const D = 0.34
const OPEN = THREE.MathUtils.degToRad(9)

let shared: { leaf: THREE.BufferGeometry; line: THREE.BufferGeometry; paper: THREE.Material; ink: THREE.Material } | null = null

function parts() {
  if (shared) return shared
  const leaf = new THREE.BoxGeometry(W / 2, 0.006, D)
  leaf.translate(W / 4, 0.003, 0)
  const line = new THREE.BoxGeometry(1, 0.002, 0.018)
  line.translate(0.5, 0, 0)
  shared = {
    leaf,
    line,
    paper: new THREE.MeshStandardMaterial({ color: '#fbfcf9', roughness: 0.92, metalness: 0 }),
    ink: new THREE.MeshStandardMaterial({ color: '#5a6070', roughness: 0.9, metalness: 0 }),
  }
  return shared
}

interface PaperSlipProps {
  /** Footprint scale; at 1 the slip is about half a unit wide. */
  size?: number
  /** Turn on the floor, in radians, so slips in different wells don't look stamped out. */
  turn?: number
  reducedMotion?: boolean
}

export function PaperSlip({ size = 1, turn = 0, reducedMotion = false }: PaperSlipProps) {
  const p = parts()
  const ref = useRef<THREE.Group>(null)
  const spring = useRef({ x: reducedMotion ? 1 : 0, v: 0 })
  const lines = useMemo(() => [0.62, 0.48, 0.7], [])
  useEffect(() => {
    spring.current = { x: reducedMotion ? 1 : 0, v: 0 }
  }, [reducedMotion])

  // Flutters down: falls from a little above the floor, rocking slightly, then settles.
  useFrame((state, dt) => {
    const g = ref.current
    if (!g) return
    const s = spring.current
    if (!reducedMotion && (Math.abs(1 - s.x) > 1e-3 || Math.abs(s.v) > 1e-3)) {
      let left = Math.min(dt, 0.1)
      while (left > 0) {
        const h = Math.min(left, 1 / 120)
        s.v += (90 * (1 - s.x) - 11 * s.v) * h
        s.x += s.v * h
        left -= h
      }
      state.invalidate()
    } else {
      s.x = 1
      s.v = 0
    }
    const k = s.x
    g.position.y = Math.max(0, (1 - k) * 0.5)
    g.rotation.z = (1 - k) * 0.35
    g.rotation.x = (1 - k) * -0.2
    g.visible = k > 0.02
  })

  return (
    <group rotation-y={turn} scale={size}>
      <group ref={ref}>
        {/* right leaf, with the ink */}
        <group rotation-z={OPEN}>
          <mesh geometry={p.leaf} material={p.paper} />
          {lines.map((len, i) => (
            <mesh
              key={i}
              geometry={p.line}
              material={p.ink}
              position={[0.04, 0.0072, -0.08 + i * 0.07]}
              scale={[(W / 2 - 0.08) * len, 1, 1]}
            />
          ))}
        </group>
        {/* left leaf, mirrored across the crease */}
        <group rotation-z={Math.PI - OPEN} position-y={0.006}>
          <mesh geometry={p.leaf} material={p.paper} />
        </group>
      </group>
    </group>
  )
}
