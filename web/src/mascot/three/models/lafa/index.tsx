// Placeholder until the real model lands: a soft capsule of the right size.
import type { MascotModelProps } from '../../contract'

export default function Placeholder(_: MascotModelProps) {
  return (
    <mesh position={[0, 0.5, 0]}>
      <capsuleGeometry args={[0.32, 0.36, 8, 24]} />
      <meshStandardMaterial color="#ffc2d1" roughness={0.6} />
    </mesh>
  )
}
