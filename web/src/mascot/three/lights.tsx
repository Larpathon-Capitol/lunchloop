// The light every mascot is seen under: a warm key from the upper left, a pink fill from
// the right and a cool rim from behind, plus a soft room environment for the gloss.
import { Environment, Lightformer } from '@react-three/drei'

export function ToyLights() {
  return (
    <>
      <ambientLight intensity={0.55} color="#fff4f7" />
      <directionalLight position={[-2.2, 3, 2.6]} intensity={2.1} color="#fff1e0" />
      <directionalLight position={[2.6, 1.2, 1.6]} intensity={0.8} color="#ffc2d1" />
      <directionalLight position={[0, 2.2, -3]} intensity={1.2} color="#d8f0ff" />
      <Environment resolution={64} frames={1}>
        <Lightformer form="rect" intensity={2} position={[0, 3, 2]} scale={[4, 2, 1]} color="#ffffff" />
        <Lightformer form="rect" intensity={1} position={[3, 0, 1]} scale={[2, 3, 1]} color="#ffb3c6" />
        <Lightformer form="rect" intensity={0.6} position={[-3, 0, 1]} scale={[2, 3, 1]} color="#c9f0d6" />
      </Environment>
    </>
  )
}
