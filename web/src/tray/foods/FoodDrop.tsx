import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import type * as THREE from 'three'
import { FoodModel, type FoodModelProps } from './FoodModel'

/** Drop height, in the parent's units. */
const FALL = 0.6
/** Seconds to fall (accelerating, like gravity). */
const FALL_TIME = 0.3
/** Squash peak: about 8% shorter on impact. */
const SQUASH = 0.08
const DAMP = 6
const FREQ = 18
// Peak of e^(-DAMP t) sin(FREQ t), so the squash amplitude comes out exactly SQUASH.
const PEAK_T = Math.atan(FREQ / DAMP) / FREQ
const AMP = SQUASH / (Math.exp(-DAMP * PEAK_T) * Math.sin(FREQ * PEAK_T))
/** After this long on the floor the wobble is under 0.1% and the animation stops. */
const SETTLE_TIME = 1.1

export interface FoodDropProps extends FoodModelProps {
  /** Seconds to wait before falling. */
  delay?: number
  /** Skip the fall and appear in place. */
  reducedMotion?: boolean
}

/**
 * A food item that falls into place, squashes on landing and settles. Remount (or change
 * `itemId`) to replay. Works with frameloop="demand": it keeps requesting frames until settled.
 */
export function FoodDrop({ itemId, component, size = 1, delay = 0, reducedMotion = false }: FoodDropProps) {
  const ref = useRef<THREE.Group>(null)
  const start = useRef<number | null>(null)
  const invalidate = useThree((s) => s.invalidate)

  useEffect(() => {
    start.current = null
    invalidate()
  }, [itemId, invalidate])

  useFrame((state) => {
    const g = ref.current
    if (!g) return
    if (reducedMotion) {
      g.visible = true
      g.position.y = 0
      g.scale.set(1, 1, 1)
      return
    }
    const now = state.clock.getElapsedTime()
    if (start.current === null) start.current = now
    const t = now - start.current - delay
    if (t < 0) {
      g.visible = false
      state.invalidate()
      return
    }
    g.visible = true
    if (t < FALL_TIME) {
      const k = t / FALL_TIME
      g.position.y = FALL * (1 - k * k)
      // A slight stretch while falling
      const s = 1 + 0.04 * k
      g.scale.set(1 / Math.sqrt(s), s, 1 / Math.sqrt(s))
      state.invalidate()
      return
    }
    const tl = t - FALL_TIME
    g.position.y = 0
    if (tl > SETTLE_TIME) {
      g.scale.set(1, 1, 1)
      return
    }
    const squash = AMP * Math.exp(-DAMP * tl) * Math.sin(FREQ * tl)
    const sy = 1 - squash
    // Keep the volume roughly constant: shorter means wider.
    const sxz = 1 / Math.sqrt(sy)
    g.scale.set(sxz, sy, sxz)
    state.invalidate()
  })

  return (
    <group ref={ref} visible={reducedMotion}>
      <FoodModel itemId={itemId} component={component} size={size} />
    </group>
  )
}
