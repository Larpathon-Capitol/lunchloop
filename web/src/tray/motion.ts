import * as THREE from 'three'

/** Frame-rate independent ease toward a target. Snaps when motion is reduced. */
export function approach(current: number, target: number, lambda: number, dt: number, reduced: boolean) {
  if (reduced) return target
  return THREE.MathUtils.damp(current, target, lambda, Math.min(dt, 0.1))
}
