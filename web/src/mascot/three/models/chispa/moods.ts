// What Chispa's face and wing aim for in each mood. The model eases toward these every frame.
import type { UmeMood } from '../../../types'

export interface ChispaPose {
  /** Eye openness, 1 is normal. */
  open: number
  /** Overall eye size. */
  eyeScale: number
  /** Positive makes the left eye bigger than the right (a curious squint). */
  asym: number
  /** 0 open eyes, 1 closed happy arcs. */
  arc: number
  /** Pinches the arcs into a squeezed, content look; below 0 lifts them into a smug arch. */
  squeeze: number
  /** Where the pupils lean on their own, and how much that wins over the rig's look. */
  look: [number, number]
  lookMix: number
  /** Eyes slide down a little, for heavy sleepy lids. */
  droop: number
  /** Closed mouth shapes (morph weights): flat line, wide grin, sideways pout. */
  flat: number
  grin: number
  pout: number
  /** Open mouth amount and its proportions. */
  mouth: number
  mouthW: number
  mouthH: number
  tongue: number
  blush: number
  /** Little stars glinting on the glaze. */
  sparkle: number
  /** Wing tip: raise angle (rad, up is positive), forward sweep, wave size and speed. */
  wingZ: number
  wingY: number
  wingAmp: number
  wingSpeed: number
}

const BASE: ChispaPose = {
  open: 1,
  eyeScale: 1,
  asym: 0,
  arc: 0,
  squeeze: 0,
  look: [0, 0],
  lookMix: 0,
  droop: 0,
  flat: 0,
  grin: 0,
  pout: 0,
  mouth: 0,
  mouthW: 1,
  mouthH: 1,
  tongue: 1,
  blush: 0.55,
  sparkle: 0,
  wingZ: -0.95,
  wingY: 0,
  wingAmp: 0.06,
  wingSpeed: 2.2,
}

export const POSES: Record<UmeMood, ChispaPose> = {
  idle: BASE,
  happy: { ...BASE, arc: 1, mouth: 0.9, mouthW: 1, mouthH: 0.85, blush: 0.85, sparkle: 1, wingZ: 0.8, wingAmp: 0.42, wingSpeed: 11 },
  excited: { ...BASE, eyeScale: 1.2, mouth: 1, mouthW: 1.15, mouthH: 1.15, blush: 0.95, sparkle: 1, wingZ: 1.05, wingAmp: 0.55, wingSpeed: 17 },
  curious: { ...BASE, eyeScale: 1.06, asym: 0.24, look: [0.55, 0.4], lookMix: 0.55, mouth: 0.28, mouthW: 0.38, mouthH: 0.6, tongue: 0, blush: 0.45, wingZ: -0.35, wingY: -0.5, wingAmp: 0.05, wingSpeed: 2 },
  thinking: { ...BASE, open: 0.82, look: [-0.75, 0.9], lookMix: 0.85, pout: 1, blush: 0.4, wingZ: 0.55, wingY: -0.6, wingAmp: 0.05, wingSpeed: 3 },
  sleepy: { ...BASE, open: 0.24, droop: 1, mouth: 0.34, mouthW: 0.42, mouthH: 0.55, tongue: 0, blush: 0.35, wingZ: -1.3, wingAmp: 0.03, wingSpeed: 1.2 },
  proud: { ...BASE, arc: 1, squeeze: -0.6, grin: 1, blush: 0.7, sparkle: 0.55, wingZ: 0.45, wingY: 0.15, wingAmp: 0, wingSpeed: 0 },
  petted: { ...BASE, arc: 1, squeeze: 1, grin: 0.4, mouth: 0.55, mouthW: 0.78, mouthH: 0.62, blush: 1, wingZ: -0.45, wingAmp: 0.16, wingSpeed: 7 },
  surprised: { ...BASE, eyeScale: 1.26, open: 1.08, mouth: 1, mouthW: 0.5, mouthH: 1.3, tongue: 0.5, blush: 0.3, wingZ: 0.95, wingY: 0.25, wingAmp: 0.05, wingSpeed: 30 },
}
