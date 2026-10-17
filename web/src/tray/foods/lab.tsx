import { ContactShadows, Environment, Lightformer, PerspectiveCamera, View } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { StrictMode, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import * as THREE from 'three'
import '../../shared/tokens.css'
import { FOOD_IDS, FoodDrop, foodGeometry, FoodModel } from './index'
import type { Component } from './items'
import './lab.css'

/*
 * Standalone page for the food models: /foods-lab.html
 * Query options: ?only=cheeseburger,broccoli (subset), ?cols=2, ?stats (triangle counts),
 * ?still (no turntable), ?drop (replay the drop-in animation).
 */

const NAMES: Record<string, string> = {
  cheese_pizza: 'Cheese pizza',
  beef_nachos: 'Beef nachos',
  chicken_nuggets: 'Chicken nuggets',
  cheeseburger: 'Cheeseburger',
  popcorn_chicken: 'Popcorn chicken',
  spicy_chicken_sandwich: 'Spicy chicken sandwich',
  dinner_roll: 'Dinner roll',
  brown_rice: 'Brown rice',
  steamed_carrots: 'Steamed carrots',
  broccoli: 'Broccoli',
  fruit_cup: 'Fruit cup',
  mandarin_oranges: 'Mandarin oranges',
  chocolate_milk: 'Chocolate milk',
  milk_1pct: '1% milk',
  milk_fat_free: 'Fat-free milk',
  bean_cheese_burrito: 'Bean and cheese burrito',
  veggie_burger: 'Veggie burger',
  black_bean_quesadilla: 'Black bean quesadilla',
  chickpea_curry_rice: 'Chickpea curry with rice',
  falafel_wrap: 'Falafel wrap',
  teriyaki_tofu_bowl: 'Teriyaki tofu bowl',
  chicken_shawarma_wrap: 'Chicken shawarma wrap',
  orange_chicken: 'Orange chicken',
  whole_wheat_tortilla: 'Whole wheat tortilla',
  whole_wheat_pita: 'Whole wheat pita',
  side_salad: 'Side salad',
  black_beans: 'Seasoned black beans',
  seasoned_corn: 'Seasoned corn',
  apple_slices: 'Apple slices',
  banana: 'Banana',
}

const FALLBACKS: Component[] = ['meat_alternate', 'grain', 'vegetable', 'fruit', 'milk']

interface Entry {
  id: string
  component?: Component
  label: string
}

const params = new URLSearchParams(window.location.search)
const only = params.get('only')?.split(',').filter(Boolean)
const all: Entry[] = [
  ...FOOD_IDS.map((id) => ({ id, label: NAMES[id] ?? id })),
  ...FALLBACKS.map((c) => ({ id: `unknown_${c}`, component: c, label: `Fallback: ${c.replace('_', ' ')}` })),
]
const entries = only ? all.filter((e) => only.includes(e.id) || only.includes(e.component ?? '')) : all
const narrow = window.innerWidth < 700
const cols = Number(params.get('cols')) || (narrow ? 2 : only ? Math.min(entries.length, 2) : 6)
const showStats = params.has('stats')
const spin = !params.has('still')
const drop = params.has('drop')

function Turntable({ index, children }: { index: number; children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null)
  useFrame((state) => {
    if (ref.current && spin) ref.current.rotation.y = state.clock.getElapsedTime() * 0.35 + index * 0.6
  })
  return (
    <group ref={ref} rotation-y={spin ? 0 : -0.45}>
      {children}
    </group>
  )
}

/** Soft studio light from Lightformers: rendered once on the GPU, no network fetch. */
function Studio() {
  return (
    <Environment resolution={128} frames={1}>
      <color attach="background" args={['#7a8088']} />
      <Lightformer form="rect" intensity={2.4} color="#ffffff" position={[0, 6, 1]} rotation-x={Math.PI / 2} scale={[10, 5, 1]} />
      <Lightformer form="rect" intensity={1.6} color="#fff3e2" position={[-6, 2, 2]} rotation-y={Math.PI / 2} scale={[8, 2, 1]} />
      <Lightformer form="rect" intensity={1.2} color="#e9f1ff" position={[6, 2, -1]} rotation-y={-Math.PI / 2} scale={[8, 2, 1]} />
      <Lightformer form="rect" intensity={1} color="#ffffff" position={[0, 2, 7]} scale={[10, 2, 1]} />
    </Environment>
  )
}

const elev = THREE.MathUtils.degToRad(34)
/** Close-ups (?only=...) sit the camera nearer. */
const DIST = only ? 2.3 : 3.1

function Cell({ entry, index }: { entry: Entry; index: number }) {
  const tris = showStats ? Math.round(foodGeometry(entry.id, entry.component).triangles) : 0
  return (
    <figure className="foods-cell">
      <View className="foods-view">
        <PerspectiveCamera
          makeDefault
          fov={24}
          position={[0, 0.3 + Math.sin(elev) * DIST, Math.cos(elev) * DIST]}
          onUpdate={(c) => c.lookAt(0, 0.22, 0)}
        />
        <Studio />
        <directionalLight position={[3, 6, 4]} intensity={1.1} color="#fff8ee" />
        <ambientLight intensity={0.2} />
        <Turntable index={index}>
          {drop ? (
            <FoodDrop itemId={entry.id} component={entry.component} delay={0.4 + index * 0.08} />
          ) : (
            <FoodModel itemId={entry.id} component={entry.component} />
          )}
        </Turntable>
        <ContactShadows position={[0, 0.001, 0]} scale={2} far={1} blur={2} opacity={0.45} resolution={256} color="#1f2a36" />
      </View>
      <figcaption>
        {entry.label}
        {showStats && <small>{tris} triangles</small>}
      </figcaption>
    </figure>
  )
}

export function Lab() {
  const root = useRef<HTMLDivElement>(null!)
  return (
    <div className="foods-lab" ref={root} data-close={only ? '' : undefined}>
      <div className="foods-grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {entries.map((e, i) => (
          <Cell key={e.id} entry={e} index={i} />
        ))}
      </div>
      <Canvas
        className="foods-canvas"
        eventSource={root}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, toneMapping: THREE.NeutralToneMapping }}
      >
        <View.Port />
      </Canvas>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Lab />
  </StrictMode>,
)
