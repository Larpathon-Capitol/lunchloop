// A bench for the 3D mascots: all three side by side under the shared lights,
// with controls for every rig input so each face and part can be checked.
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Suspense, useRef, useState, type MutableRefObject } from 'react'
import { MOODS, type UmeMood } from '../../types'
import type { MascotId } from '../../../theme/types'
import type { RigInput } from '../contract'
import { ToyLights } from '../lights'
import { MODELS } from '../models'

const IDS: MascotId[] = ['chispa', 'ume', 'lafa']

/** Advances the lab's rig input by one frame: the clock, and with auto on, a wandering look and a blink. */
function drive(i: RigInput, dt: number, auto: boolean) {
  i.time += dt
  if (auto) {
    const t = i.time
    i.look = { x: Math.sin(t * 0.7) * 0.8, y: Math.sin(t * 0.43) * 0.5 }
    i.blink = (t % 3.6) < 0.12 ? 1 : 0
  }
  i.bounce = Math.max(0, i.bounce - dt * 1.6)
}

function Driver({ input, auto }: { input: MutableRefObject<RigInput>; auto: boolean }) {
  useFrame((_, dt) => drive(input.current, dt, auto))
  return null
}

export function LabPage() {
  const input = useRef<RigInput>({ mood: 'idle', pet: 0, look: { x: 0, y: 0 }, blink: 0, talk: 0, time: 0, bounce: 0 })
  const [mood, setMood] = useState<UmeMood>('idle')
  const [auto, setAuto] = useState(true)
  const [only, setOnly] = useState<MascotId | 'all'>('all')
  const set = (patch: Partial<RigInput>) => Object.assign(input.current, patch)
  const shown = only === 'all' ? IDS : [only]
  return (
    <div style={{ display: 'grid', gridTemplateRows: 'auto 1fr', height: '100vh', background: '#ffe5ec', fontFamily: 'system-ui' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: 12 }}>
        {MOODS.map((m) => (
          <button key={m} aria-pressed={m === mood} onClick={() => { setMood(m); set({ mood: m }) }}>{m}</button>
        ))}
        <label>pet <input type="range" min={0} max={1} step={0.01} defaultValue={0} onChange={(e) => set({ pet: +e.target.value })} /></label>
        <label>talk <input type="range" min={0} max={1} step={0.01} defaultValue={0} onChange={(e) => set({ talk: +e.target.value })} /></label>
        <label>blink <input type="range" min={0} max={1} step={0.01} defaultValue={0} onChange={(e) => set({ blink: +e.target.value })} /></label>
        <button onClick={() => set({ bounce: 1 })}>bounce</button>
        <label><input type="checkbox" checked={auto} onChange={(e) => { setAuto(e.target.checked); if (!e.target.checked) set({ blink: 0, look: { x: 0, y: 0 } }) }} /> auto look and blink</label>
        <select value={only} onChange={(e) => setOnly(e.target.value as MascotId | 'all')}>
          <option value="all">all</option>
          {IDS.map((id) => <option key={id} value={id}>{id}</option>)}
        </select>
      </div>
      <Canvas camera={{ position: [0, 0.6, 3.4], fov: 32 }} dpr={[1, 2]}>
        <ToyLights />
        <Driver input={input} auto={auto} />
        <Suspense fallback={null}>
          {shown.map((id, k) => {
            const Model = MODELS[id]
            return (
              <group key={id} position={[(k - (shown.length - 1) / 2) * 1.35, 0, 0]}>
                <Model input={input} />
              </group>
            )
          })}
        </Suspense>
        <OrbitControls target={[0, 0.5, 0]} />
      </Canvas>
    </div>
  )
}
