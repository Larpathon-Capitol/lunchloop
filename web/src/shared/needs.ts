// The student's food needs (diet choices and allergies). Saved per browser, read with
// useNeeds(). checkFood() compares one food against them so every screen flags the
// same things the same way.
import { useSyncExternalStore } from 'react'
import type { Allergen, DietInfo } from './api'
import { storeGet, storeSet } from './device'

export const DIET_NEEDS = ['vegetarian', 'vegan', 'no_pork', 'no_beef', 'gluten_free', 'dairy_free', 'not_spicy'] as const
export type DietNeed = (typeof DIET_NEEDS)[number]

export const ALLERGENS: readonly Allergen[] = ['milk', 'egg', 'fish', 'shellfish', 'tree_nuts', 'peanuts', 'wheat', 'soybeans', 'sesame']

export interface Needs {
  diet: DietNeed[]
  allergies: Allergen[]
}

const KEY = 'lunchloop.needs'
const EMPTY: Needs = { diet: [], allergies: [] }

function read(): Needs {
  try {
    const raw = storeGet(KEY)
    if (!raw) return EMPTY
    const v = JSON.parse(raw) as Partial<Needs>
    return {
      diet: Array.isArray(v.diet) ? v.diet.filter((d): d is DietNeed => (DIET_NEEDS as readonly string[]).includes(d)) : [],
      allergies: Array.isArray(v.allergies) ? v.allergies.filter((a): a is Allergen => ALLERGENS.includes(a)) : [],
    }
  } catch {
    return EMPTY
  }
}

let current: Needs = read()
const listeners = new Set<() => void>()

export const needsStore = {
  get: () => current,
  set(next: Needs) {
    current = { diet: DIET_NEEDS.filter((d) => next.diet.includes(d)), allergies: ALLERGENS.filter((a) => next.allergies.includes(a)) }
    storeSet(KEY, JSON.stringify(current))
    listeners.forEach((l) => l())
  },
  toggleDiet(need: DietNeed) {
    const on = current.diet.includes(need)
    needsStore.set({ ...current, diet: on ? current.diet.filter((d) => d !== need) : [...current.diet, need] })
  },
  toggleAllergy(a: Allergen) {
    const on = current.allergies.includes(a)
    needsStore.set({ ...current, allergies: on ? current.allergies.filter((x) => x !== a) : [...current.allergies, a] })
  },
  clear() {
    needsStore.set(EMPTY)
  },
  subscribe(l: () => void) {
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  },
}

export function useNeeds(): Needs {
  return useSyncExternalStore(needsStore.subscribe, needsStore.get, () => EMPTY)
}

export const needsCount = (n: Needs) => n.diet.length + n.allergies.length

/** What we know about a food. Diet facts can be missing (older data), allergens can't. */
export type FoodFacts = { allergens: Allergen[] } & Partial<DietInfo>

export interface FoodCheck {
  /** 'none' when no needs are set; 'unknown' when diet facts are missing for a diet need. */
  status: 'none' | 'fits' | 'conflict' | 'unknown'
  /** Diet needs this food doesn't meet. */
  diet: DietNeed[]
  /** The student's allergens this food lists. */
  allergens: Allergen[]
}

function meets(need: DietNeed, f: DietInfo): boolean {
  switch (need) {
    case 'vegetarian':
      return f.diet.includes('vegetarian') || f.diet.includes('vegan')
    case 'vegan':
      return f.diet.includes('vegan')
    case 'no_pork':
      return !f.diet.includes('contains_pork')
    case 'no_beef':
      return !f.diet.includes('contains_beef')
    case 'gluten_free':
      return f.gluten_free
    case 'dairy_free':
      return f.dairy_free
    case 'not_spicy':
      return !f.diet.includes('spicy')
  }
}

export function checkFood(food: FoodFacts, needs: Needs): FoodCheck {
  if (!needsCount(needs)) return { status: 'none', diet: [], allergens: [] }
  const allergens = needs.allergies.filter((a) => food.allergens.includes(a))
  const known = Array.isArray(food.diet) && typeof food.gluten_free === 'boolean' && typeof food.dairy_free === 'boolean'
  const diet = known ? needs.diet.filter((n) => !meets(n, food as DietInfo)) : []
  const status = diet.length || allergens.length ? 'conflict' : !known && needs.diet.length ? 'unknown' : 'fits'
  return { status, diet, allergens }
}

/** Foods that fit come first; the order is otherwise kept. Nothing moves when no needs are set. */
export function sortByNeeds<T extends FoodFacts>(foods: T[], needs: Needs): T[] {
  if (!needsCount(needs)) return foods
  const rank = (f: T) => (checkFood(f, needs).status === 'conflict' ? 1 : 0)
  return foods
    .map((f, i) => ({ f, i, r: rank(f) }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.f)
}

/** True when this food doesn't fit the student's needs, for styling a row. */
export function useConflict(food: FoodFacts | null | undefined): boolean {
  const needs = useNeeds()
  return !!food && checkFood(food, needs).status === 'conflict'
}
