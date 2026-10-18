import * as THREE from 'three'
import type { Component } from './items'
import { foodGeometry } from './registry'

// Shared materials, one set for every food on the page. Matte is soft vinyl (a little sheen, like
// the mascots), soft is glossy for buns, glazes and sauces, clear is plastic for cups and lids.
const MATERIALS = {
  matte: new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    roughness: 0.6,
    metalness: 0,
    sheen: 0.25,
    sheenRoughness: 0.5,
    sheenColor: new THREE.Color('#fff1e0'),
  }),
  soft: new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    roughness: 0.42,
    metalness: 0,
    clearcoat: 0.45,
    clearcoatRoughness: 0.3,
  }),
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
  /**
   * Uniform scale. At 1 the item fills its home compartment's footprint (see FOOT in fit.ts):
   * about 1 deep, and up to about 1.6 wide for entrees. It rests on y = 0.
   */
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
