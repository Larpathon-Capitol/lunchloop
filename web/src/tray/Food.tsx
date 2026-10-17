import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { GroupId } from './groups'

/*
 * Stand-in food, one small low-poly cluster per group. Every piece sits on y = 0 (the
 * compartment floor) so it can scale up from its base. Final food art replaces this file.
 */

interface Piece {
  geometry: THREE.BufferGeometry
  position: [number, number, number]
  rotation?: [number, number, number]
  scale?: [number, number, number]
  /** Lightness shift applied to the group color, so a cluster is not one flat tone. */
  shade?: number
  /** Use a fixed color instead of the group color (stems, milk). */
  color?: string
}

let shared: Record<string, THREE.BufferGeometry> | null = null

function geometries() {
  if (shared) return shared
  const ball = new THREE.IcosahedronGeometry(0.15, 1)
  ball.translate(0, 0.15, 0)
  const floret = new THREE.IcosahedronGeometry(0.12, 0)
  floret.translate(0, 0.2, 0)
  const stem = new THREE.CylinderGeometry(0.035, 0.05, 0.14, 6)
  stem.translate(0, 0.07, 0)
  const twig = new THREE.CylinderGeometry(0.012, 0.016, 0.07, 5)
  twig.translate(0, 0.31, 0)
  const roll = new THREE.CapsuleGeometry(0.15, 0.32, 3, 8)
  roll.rotateZ(Math.PI / 2)
  roll.translate(0, 0.15, 0)
  const nugget = new THREE.DodecahedronGeometry(0.15, 0)
  nugget.scale(1.2, 0.55, 0.9)
  nugget.translate(0, 0.085, 0)
  const cup = new THREE.CylinderGeometry(0.27, 0.23, 0.36, 20)
  cup.translate(0, 0.18, 0)
  const milk = new THREE.CylinderGeometry(0.235, 0.235, 0.012, 20)
  milk.translate(0, 0.366, 0)
  shared = { ball, floret, stem, twig, roll, nugget, cup, milk }
  return shared
}

function piecesFor(group: GroupId): Piece[] {
  const g = geometries()
  switch (group) {
    case 'fruit':
      return [
        { geometry: g.ball, position: [-0.14, 0, 0.1] },
        { geometry: g.twig, position: [-0.14, 0, 0.1], color: '#6b4a2b' },
        { geometry: g.ball, position: [0.16, 0, 0.12], shade: 0.08, scale: [0.9, 0.9, 0.9] },
        { geometry: g.ball, position: [0.0, 0, -0.16], shade: -0.06, scale: [0.95, 0.95, 0.95] },
        { geometry: g.twig, position: [0.0, 0, -0.16], color: '#6b4a2b', scale: [0.95, 0.95, 0.95] },
      ]
    case 'vegetable':
      return [-0.18, 0.02, 0.2].flatMap((x, i): Piece[] => {
        const z = i === 1 ? -0.14 : 0.1
        return [
          { geometry: g.stem, position: [x, 0, z], shade: 0.18 },
          { geometry: g.floret, position: [x, 0, z], rotation: [0.3, i, 0.2], shade: i * -0.04 },
        ]
      })
    case 'grain':
      return [
        { geometry: g.roll, position: [-0.02, 0, 0.18], rotation: [0, 0.25, 0] },
        { geometry: g.roll, position: [0.04, 0, -0.18], rotation: [0, -0.2, 0], shade: 0.06 },
      ]
    case 'meat_alternate':
      return [
        [-0.42, 0.12, 0.4],
        [-0.12, -0.16, 1.4],
        [0.18, 0.16, 2.3],
        [0.44, -0.12, 0.9],
        [0.0, 0.2, 3.1],
      ].map(([x, z, ry], i) => ({
        geometry: g.nugget,
        position: [x, 0, z],
        rotation: [0, ry, 0],
        shade: (i % 3) * 0.04 - 0.03,
      }))
    case 'milk':
      return [
        { geometry: g.cup, position: [0, 0, 0] },
        { geometry: g.milk, position: [0, 0, 0], color: '#f7f7f2' },
      ]
  }
}

interface FoodClusterProps {
  group: GroupId
  color: string
  filled: boolean
  reduced: boolean
  position: [number, number, number]
}

/** Springs from scale 0 to 1 (with a little overshoot) when `filled` turns on, and back when it turns off. */
export function FoodCluster({ group, color, filled, reduced, position }: FoodClusterProps) {
  const pieces = useMemo(() => piecesFor(group), [group])
  const materials = useMemo(
    () =>
      pieces.map((p) => {
        const c = new THREE.Color(p.color ?? color)
        if (p.shade) c.offsetHSL(0, 0, p.shade)
        return new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, metalness: 0, flatShading: true })
      }),
    [pieces, color],
  )
  useEffect(() => () => materials.forEach((m) => m.dispose()), [materials])
  const ref = useRef<THREE.Group>(null)
  const spring = useRef({ x: filled ? 1 : 0, v: 0 })

  useFrame((state, dt) => {
    const s = spring.current
    const target = filled ? 1 : 0
    if (reduced) {
      s.x = target
      s.v = 0
    } else {
      // Semi-implicit Euler spring, stepped in small slices so a dropped frame cannot blow it up.
      let left = Math.min(dt, 0.1)
      while (left > 0) {
        const h = Math.min(left, 1 / 120)
        const stiffness = filled ? 240 : 320
        const damping = filled ? 14 : 30
        s.v += (stiffness * (target - s.x) - damping * s.v) * h
        s.x += s.v * h
        left -= h
      }
      if (Math.abs(target - s.x) < 1e-3 && Math.abs(s.v) < 1e-3) {
        s.x = target
        s.v = 0
      } else {
        state.invalidate()
      }
    }
    const g = ref.current
    if (!g) return
    const k = Math.max(s.x, 0)
    g.visible = k > 0.001
    g.scale.setScalar(Math.max(k, 0.001))
  })

  return (
    <group ref={ref} position={position} visible={filled}>
      {pieces.map((p, i) => (
        <mesh
          key={i}
          geometry={p.geometry}
          material={materials[i]}
          position={p.position}
          rotation={p.rotation ?? [0, 0, 0]}
          scale={p.scale ?? [1, 1, 1]}
        />
      ))}
    </group>
  )
}
