import * as THREE from 'three'
import type { Component } from './items'
import { foodGeometry } from './registry'

// Shared materials: matte clay for most food, a softer sheen for buns and glazes, clear plastic.
const MATERIALS = {
  matte: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.74, metalness: 0 }),
  soft: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.56, metalness: 0 }),
  clear: new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.18,
    metalness: 0,
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
    side: THREE.DoubleSide,
  }),
} as const

export interface FoodModelProps {
  itemId: string
  /** Used to pick a fallback model when `itemId` has no model of its own. */
  component?: Component
  /** Uniform scale. At 1 the item fits a 1 by 1 footprint and rests on y = 0. */
  size?: number
}

/** A stylized food item centered on the origin, resting on y = 0. */
export function FoodModel({ itemId, component, size = 1 }: FoodModelProps) {
  const built = foodGeometry(itemId, component)
  return (
    <group scale={size}>
      {built.matte && <mesh geometry={built.matte} material={MATERIALS.matte} />}
      {built.soft && <mesh geometry={built.soft} material={MATERIALS.soft} />}
      {built.clear && <mesh geometry={built.clear} material={MATERIALS.clear} renderOrder={1} />}
    </group>
  )
}
