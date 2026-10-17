// Spring settings for the student view. Durations match tokens.css (300ms ceiling),
// except the reel, which is the one long moment.
import type { Transition } from 'framer-motion'
import { dur } from '../shared/motion'

/** Screen changes: settles in 300ms with a slight overshoot. */
export const screenSpring: Transition = { type: 'spring', duration: dur.slow, bounce: 0.18 }
/** Small things that pop in (checks, selection marks). */
export const popSpring: Transition = { type: 'spring', duration: dur.med, bounce: 0.35 }
/** Bars and fills. */
export const fillSpring: Transition = { type: 'spring', duration: dur.slow, bounce: 0.1 }
/** Bottom sheets: a plain glide up, no bounce off the bottom edge. */
export const sheetSpring: Transition = { type: 'spring', duration: dur.slow, bounce: 0 }
/**
 * The reel. Picked by simulating the spring over 40 rows of 64px: it reaches the
 * landing row at about 0.76s, overshoots by about 21px once, and is at rest by
 * about 1.47s. The choices become tappable the moment it first reaches them.
 */
export const reelSpring = { type: 'spring' as const, stiffness: 36, damping: 10, mass: 1, velocity: -900, restDelta: 2, restSpeed: 30 }

export const instant: Transition = { duration: 0 }
