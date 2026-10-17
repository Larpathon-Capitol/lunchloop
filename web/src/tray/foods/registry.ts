import type { BuiltFood } from './build'
import { BUILDERS, FALLBACK_BUILDERS, type Component, type FoodId } from './items'

/** Every item id with its own model. Anything else falls back to a model for its component. */
export const FOOD_IDS = Object.keys(BUILDERS) as FoodId[]

export function hasFoodModel(id: string): id is FoodId {
  return Object.hasOwn(BUILDERS, id)
}

// Geometry is built once per item, the first time it is shown, and kept for the page's lifetime.
const cache = new Map<string, BuiltFood>()

/** Built geometry for an item (or its component fallback). Also handy for triangle counts. */
export function foodGeometry(itemId: string, component?: Component): BuiltFood {
  const fallback = component ?? 'meat_alternate'
  const key = hasFoodModel(itemId) ? itemId : `fallback:${fallback}`
  let built = cache.get(key)
  if (!built) {
    built = hasFoodModel(itemId) ? BUILDERS[itemId]() : FALLBACK_BUILDERS[fallback]()
    cache.set(key, built)
  }
  return built
}
