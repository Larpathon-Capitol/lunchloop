// Springs for the student game. Everything physical moves on a spring; reduced motion
// swaps any of these for `instant` or `fade`.
import type { Transition } from 'framer-motion'

/** Tab changes: a soft slide that settles with a hint of overshoot. */
export const screenSpring: Transition = { type: 'spring', stiffness: 320, damping: 32, mass: 0.9 }
/** The active tab mark sliding between tabs. */
export const tabSpring: Transition = { type: 'spring', stiffness: 520, damping: 38 }
/** Small things that pop in (checks, chips, the pack button). */
export const popSpring: Transition = { type: 'spring', stiffness: 560, damping: 20 }
/** Bars and fills. */
export const fillSpring: Transition = { type: 'spring', stiffness: 160, damping: 24 }
/** Sheets: a quick glide with no bounce off the edge. */
export const sheetSpring: Transition = { type: 'spring', stiffness: 380, damping: 40 }
/**
 * The reel. Picked by simulating the spring over 40 rows of 64px: it reaches the
 * landing row at about 0.76s, overshoots by about 21px once, and is at rest by
 * about 1.47s. The choices become tappable the moment it first reaches them.
 */
export const reelSpring = { type: 'spring' as const, stiffness: 36, damping: 10, mass: 1, velocity: -900, restDelta: 2, restSpeed: 30 }

export const instant: Transition = { duration: 0 }
/** The calm path for reduced motion. */
export const fade: Transition = { duration: 0.12 }
