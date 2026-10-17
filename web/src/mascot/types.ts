export type UmeMood =
  | 'idle'
  | 'happy'
  | 'excited'
  | 'curious'
  | 'thinking'
  | 'sleepy'
  | 'proud'
  | 'petted'
  | 'surprised'

export const MOODS: readonly UmeMood[] = [
  'idle',
  'happy',
  'excited',
  'curious',
  'thinking',
  'sleepy',
  'proud',
  'petted',
  'surprised',
]

export type FoodGroup = 'entree' | 'grain' | 'vegetable' | 'fruit' | 'milk'

/** A point in viewport (client) pixels. */
export type Point = { x: number; y: number }

/** Anything with a viewport rect: a DOMRect, or a plain object. */
export type RectLike = { left: number; top: number; width: number; height: number }
