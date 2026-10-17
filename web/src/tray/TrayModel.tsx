import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { buildTrayGeometries, COMPARTMENTS, disposeTrayGeometries, TRAY } from './geometry'
import type { GroupColors, GroupId } from './groups'
import { approach } from './motion'
import { buildBrushedTexture } from './studio'

function useSteel() {
  const materials = useMemo(() => {
    const brushed = buildBrushedTexture()
    return {
      brushed,
      // Polished stainless: fully metallic, low roughness and a clearcoat, so the studio strips
      // land on the rim and bevels as long crisp streaks.
      polished: new THREE.MeshPhysicalMaterial({
        color: '#eef0f3',
        metalness: 1,
        roughness: 0.16,
        clearcoat: 0.6,
        clearcoatRoughness: 0.12,
        envMapIntensity: 1.15,
      }),
      // Underside: same steel, never seen up close.
      base: new THREE.MeshPhysicalMaterial({ color: '#b9bec6', metalness: 1, roughness: 0.34 }),
      // Compartment floors: darker brushed steel, which reads as depth.
      floor: new THREE.MeshPhysicalMaterial({
        color: '#a9afb7',
        metalness: 1,
        roughness: 0.4,
        roughnessMap: brushed,
        envMapIntensity: 1.05,
      }),
    }
  }, [])
  useEffect(
    () => () => {
      materials.polished.dispose()
      materials.base.dispose()
      materials.floor.dispose()
      materials.brushed.dispose()
    },
    [materials],
  )
  return materials
}

export type WellHandler = (id: GroupId, e: ThreeEvent<PointerEvent> | ThreeEvent<MouseEvent>) => void

interface WellProps {
  id: GroupId
  color: string
  floor: THREE.BufferGeometry
  ring: THREE.BufferGeometry
  opening: THREE.BufferGeometry
  floorMaterial: THREE.Material
  /** Shows the faint resting rim (pick mode). */
  picking: boolean
  /** Can be tapped. */
  selectable: boolean
  /** Full glaze rim: hovered or focused. */
  lit: boolean
  reduced: boolean
  onOver: WellHandler
  onOut: WellHandler
  onSelect: WellHandler
}

/** One compartment: brushed floor, glaze tint, outline ring, and an invisible hit area across its opening. */
function Well({ id, color, floor, ring, opening, floorMaterial, picking, selectable, lit, reduced, onOver, onOut, onSelect }: WellProps) {
  const tint = useRef<THREE.MeshBasicMaterial>(null)
  const edge = useRef<THREE.MeshBasicMaterial>(null)
  const level = useRef(0)

  useFrame((state, dt) => {
    const target = picking && selectable ? (lit ? 1 : 0.22) : 0
    const next = approach(level.current, target, 12, dt, reduced)
    if (Math.abs(next - target) > 1e-3) state.invalidate()
    level.current = Math.abs(next - target) <= 1e-3 ? target : next
    const k = level.current
    if (tint.current) {
      tint.current.opacity = (0.16 * Math.max(k - 0.22, 0)) / 0.78
      tint.current.visible = tint.current.opacity > 0.002
    }
    if (edge.current) {
      edge.current.opacity = 0.95 * k
      edge.current.visible = k > 0.002
    }
  })

  return (
    <group>
      <mesh geometry={floor} material={floorMaterial} position-z={TRAY.floor + 0.001} />
      <mesh geometry={floor} position-z={TRAY.floor + 0.002} renderOrder={1}>
        <meshBasicMaterial ref={tint} color={color} transparent opacity={0} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh geometry={ring} position-z={TRAY.floor + 0.003} renderOrder={2}>
        <meshBasicMaterial ref={edge} color={color} transparent opacity={0} depthWrite={false} toneMapped={false} />
      </mesh>
      {picking && selectable && (
        <mesh
          geometry={opening}
          position-z={TRAY.body + TRAY.bevel}
          onPointerOver={(e) => onOver(id, e)}
          onPointerOut={(e) => onOut(id, e)}
          onClick={(e) => onSelect(id, e)}
        >
          <meshBasicMaterial visible={false} />
        </mesh>
      )}
    </group>
  )
}

interface TrayModelProps {
  colors: GroupColors
  picking: boolean
  /** Compartments that can be tapped. Defaults to all. */
  available?: readonly GroupId[]
  /** Compartments with the full glaze rim showing (hovered, focused). */
  lit?: readonly GroupId[]
  reduced: boolean
  onOver: WellHandler
  onOut: WellHandler
  onSelect: WellHandler
}

/**
 * The tray in its own local space: centered on x/z, floor of the wells at y = TRAY.floor.
 * Food goes in separately, as children of the same parent group.
 */
export function TrayModel({ colors, picking, available, lit, reduced, onOver, onOut, onSelect }: TrayModelProps) {
  const geo = useMemo(() => buildTrayGeometries(), [])
  useEffect(() => () => disposeTrayGeometries(geo), [geo])
  const steel = useSteel()

  return (
    <group rotation-x={-Math.PI / 2}>
      <mesh geometry={geo.body} material={steel.polished} />
      <mesh geometry={geo.rim} material={steel.polished} />
      <mesh geometry={geo.base} material={steel.base} />
      {COMPARTMENTS.map((c) => (
        <Well
          key={c.id}
          id={c.id}
          color={colors[c.id]}
          {...geo.wells[c.id]}
          floorMaterial={steel.floor}
          picking={picking}
          selectable={!available || available.includes(c.id)}
          lit={!!lit?.includes(c.id)}
          reduced={reduced}
          onOver={onOver}
          onOut={onOut}
          onSelect={onSelect}
        />
      ))}
    </group>
  )
}
