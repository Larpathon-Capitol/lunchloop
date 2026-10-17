// Springs for the behind the scenes page. All settle within the 300ms ceiling.
import type { Transition } from 'framer-motion'
import { dur } from '../shared/motion'

/** One hop of the request dot between two boxes: a small overshoot, then settle. */
export const hopSpring: Transition = { type: 'spring', duration: dur.slow, bounce: 0.2 }
/** New log rows sliding in, and older rows making room. */
export const rowSpring: Transition = { type: 'spring', duration: dur.slow, bounce: 0.15 }
/** Step panels when a new dish is picked. */
export const stepSpring: Transition = { type: 'spring', duration: dur.slow, bounce: 0.1 }
