import type { BuiltFood } from './build'
import type { Component } from '../../shared/api'
import { MODELS as ENTREES_A } from './models/entrees-a'
import { FALLBACKS as BOWL_FALLBACKS, MODELS as BOWLS } from './models/entrees-bowls'
import { MODELS as WRAPS } from './models/entrees-wraps'
import { FALLBACKS as FRUIT_FALLBACKS, MODELS as FRUITS } from './models/fruits'
import { FALLBACKS as GRAIN_FALLBACKS, MODELS as GRAINS } from './models/grains-milk'
import { FALLBACKS as VEG_FALLBACKS, MODELS as VEGETABLES } from './models/vegetables'

/*
 * The food catalog: one builder per menu item, plus a fallback per compartment for anything new.
 * The models live in ./models, grouped by kind. Units: each item rests on y = 0, centered on the
 * origin, and fills its home compartment's footprint (FOOT in fit.ts).
 */

export type { Component }

const COMPONENT_OF = {
  cheese_pizza: 'meat_alternate',
  beef_nachos: 'meat_alternate',
  chicken_nuggets: 'meat_alternate',
  cheeseburger: 'meat_alternate',
  popcorn_chicken: 'meat_alternate',
  spicy_chicken_sandwich: 'meat_alternate',
  dinner_roll: 'grain',
  brown_rice: 'grain',
  steamed_carrots: 'vegetable',
  broccoli: 'vegetable',
  fruit_cup: 'fruit',
  mandarin_oranges: 'fruit',
  chocolate_milk: 'milk',
  milk_1pct: 'milk',
  milk_fat_free: 'milk',
  bean_cheese_burrito: 'meat_alternate',
  veggie_burger: 'meat_alternate',
  black_bean_quesadilla: 'meat_alternate',
  chickpea_curry_rice: 'meat_alternate',
  falafel_wrap: 'meat_alternate',
  teriyaki_tofu_bowl: 'meat_alternate',
  chicken_shawarma_wrap: 'meat_alternate',
  orange_chicken: 'meat_alternate',
  whole_wheat_tortilla: 'grain',
  whole_wheat_pita: 'grain',
  side_salad: 'vegetable',
  black_beans: 'vegetable',
  seasoned_corn: 'vegetable',
  apple_slices: 'fruit',
  banana: 'fruit',
} as const satisfies Record<string, Component>

export type FoodId = keyof typeof COMPONENT_OF

/** Which tray component each known item belongs to. */
export const FOOD_COMPONENT: Record<FoodId, Component> = COMPONENT_OF

export const BUILDERS = {
  ...ENTREES_A,
  ...WRAPS,
  ...BOWLS,
  ...GRAINS,
  ...VEGETABLES,
  ...FRUITS,
} as Record<FoodId, () => BuiltFood>

export const FALLBACK_BUILDERS = {
  ...BOWL_FALLBACKS,
  ...GRAIN_FALLBACKS,
  ...VEG_FALLBACKS,
  ...FRUIT_FALLBACKS,
} as Record<Component, () => BuiltFood>

if (import.meta.env.DEV) {
  const missing = [
    ...Object.keys(FOOD_COMPONENT).filter((id) => !Object.hasOwn(BUILDERS, id)),
    ...(['meat_alternate', 'grain', 'vegetable', 'fruit', 'milk'] as const).filter((c) => !FALLBACK_BUILDERS[c]),
  ]
  if (missing.length) console.warn('Food models missing for:', missing.join(', '))
}
