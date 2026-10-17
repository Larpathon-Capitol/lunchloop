// Face and filling targets for each of Lafa's moods. The model eases toward these every frame.
import type { UmeMood } from '../../../types'

export interface FacePose {
  /** Eye size multiplier. */
  eye: number
  /** Vertical eye openness, 1 is normal; sleepy droops below 1. */
  eyeOpen: number
  /** Right eye size relative to the left (curious squints one eye). */
  eyeAsym: number
  /** 0 open eyes, 1 closed happy arcs. */
  arc: number
  /** Squeezes the arcs flatter and closer (petted). */
  squeeze: number
  /** Turns the arcs over into peaceful downward curves (sleepy). */
  arcFlip: number
  /** Mouth openness 0 to 1. */
  open: number
  /** Open mouth shape: 0 a wide D smile, 1 a round O. */
  round: number
  /** Mouth width and height multipliers for the open mouth. */
  mouthW: number
  mouthH: number
  /** Closed mouth shape: 0 small smile, below 0 toward flat, above 0 toward a big grin. */
  grin: number
  /** Sideways shift and tilt of the mouth, for a thinking smirk. */
  mouthX: number
  mouthTilt: number
  /** Blush opacity. */
  blush: number
  /** Brows: how much they show, lift above the eyes, inner tilt, and an extra lift on the right brow. */
  brow: number
  browLift: number
  browTilt: number
  browAsym: number
  /** Where the eyes drift on their own, added to input.look. */
  lookX: number
  lookY: number
  /** Filling rises (or slumps when negative). */
  lift: number
  /** How lively the filling sways. */
  sway: number
  /** Sauce sparkle 0 to 1. */
  sparkle: number
}

const BASE: FacePose = {
  eye: 1, eyeOpen: 1, eyeAsym: 1, arc: 0, squeeze: 0, arcFlip: 0,
  open: 0, round: 0, mouthW: 1, mouthH: 1, grin: 0, mouthX: 0, mouthTilt: 0,
  blush: 0.55, brow: 0, browLift: 0, browTilt: 0, browAsym: 0,
  lookX: 0, lookY: 0, lift: 0, sway: 1, sparkle: 0,
}

export const POSES: Record<UmeMood, FacePose> = {
  idle: BASE,
  happy: { ...BASE, arc: 1, open: 0.8, mouthW: 1.15, blush: 0.85, lift: 0.03, sway: 1.4, sparkle: 0.7 },
  excited: {
    ...BASE, eye: 1.2, eyeOpen: 1.1, open: 1, mouthW: 1.25, mouthH: 1.1, blush: 1,
    brow: 0.8, browLift: 0.02, lift: 0.055, sway: 2.2, sparkle: 1,
  },
  curious: {
    ...BASE, eye: 1.05, eyeAsym: 0.8, open: 0.3, round: 1, mouthW: 0.55, mouthH: 1.1, blush: 0.5,
    brow: 1, browLift: 0.008, browAsym: 0.025, lookX: 0.55, lookY: 0.15, lift: 0.015,
  },
  thinking: {
    ...BASE, eye: 0.95, grin: -0.8, mouthX: 0.03, mouthTilt: 0.22, blush: 0.35,
    brow: 1, browTilt: -0.35, browLift: 0.005, browAsym: -0.012, lookX: -0.6, lookY: 0.75, sway: 0.4,
  },
  sleepy: {
    ...BASE, arc: 1, arcFlip: 1, open: 0.22, round: 1, mouthW: 0.5, mouthH: 1.2, blush: 0.4,
    lookY: -0.5, lift: -0.03, sway: 0.35,
  },
  proud: {
    ...BASE, eyeOpen: 0.5, grin: 1, mouthW: 1.25, blush: 0.75, lookY: 0.35,
    brow: 1, browLift: 0.012, browTilt: -0.2, lift: 0.04, sway: 0.8, sparkle: 0.85,
  },
  petted: { ...BASE, arc: 1, squeeze: 1, open: 0.35, mouthW: 0.85, blush: 1, lift: 0.01, sway: 0.6 },
  surprised: {
    ...BASE, eye: 1.3, eyeOpen: 1.15, open: 1, round: 1, mouthW: 0.55, mouthH: 1.45, blush: 0.4,
    brow: 1, browLift: 0.03, lift: 0.05, sway: 0.3,
  },
}
