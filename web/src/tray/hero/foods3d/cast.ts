import * as THREE from 'three'
import { foodGeometry, type Component } from '../../foods'

/*
 * Who sits along the bottom of the hero. Foods that read as a solid little object (a burger,
 * a carton, an apple) hold their own at this size; flat scoops like rice or corn do not, so those
 * are never cast even when they are on the menu.
 */

export interface Buddy {
  itemId: string
  component: Component
}

/** Character-friendly items per component, best first. */
const FRIENDLY: Record<Component, string[]> = {
  meat_alternate: ['cheeseburger', 'veggie_burger', 'spicy_chicken_sandwich', 'chicken_shawarma_wrap'],
  grain: ['dinner_roll', 'whole_wheat_pita'],
  vegetable: ['broccoli'],
  fruit: ['fruit_cup', 'apple', 'banana', 'mandarin_oranges'],
  milk: ['milk_1pct', 'chocolate_milk', 'milk_fat_free'],
}

/** The fixed mix used when the menu is not known (or has too few friendly items). */
const DEFAULT_CAST: Buddy[] = [
  { itemId: 'apple', component: 'fruit' },
  { itemId: 'cheeseburger', component: 'meat_alternate' },
  { itemId: 'milk_1pct', component: 'milk' },
  { itemId: 'broccoli', component: 'vegetable' },
  { itemId: 'dinner_roll', component: 'grain' },
  { itemId: 'chocolate_milk', component: 'milk' },
  { itemId: 'fruit_cup', component: 'fruit' },
  { itemId: 'cheese_pizza', component: 'meat_alternate' },
  { itemId: 'veggie_burger', component: 'meat_alternate' },
]

/** Component order along the row, so neighbours differ (tall carton next to a round apple). */
const ROW: Component[] = ['fruit', 'meat_alternate', 'milk', 'vegetable', 'grain']

/**
 * Up to `count` buddies: friendly items from tomorrow's menu first (one per component, then
 * seconds), topped up from the fixed mix. Always the same order for the same menu.
 */
export function pickCast(menu: { component: Component; itemIds: string[] }[] | null, count: number): Buddy[] {
  const picked: Buddy[] = []
  const used = new Set<string>()
  const add = (b: Buddy) => {
    if (picked.length >= count || used.has(b.itemId)) return
    used.add(b.itemId)
    picked.push(b)
  }
  if (menu) {
    const byComp = new Map<Component, string[]>()
    for (const g of menu) {
      byComp.set(
        g.component,
        FRIENDLY[g.component].filter((id) => g.itemIds.includes(id)),
      )
    }
    for (let round = 0; round < 2; round++) {
      for (const c of ROW) {
        const id = byComp.get(c)?.[round]
        if (id) add({ itemId: id, component: c })
      }
    }
  }
  for (const b of DEFAULT_CAST) add(b)
  // Interleave by component so two cartons never stand side by side.
  const order = (b: Buddy) => ROW.indexOf(b.component)
  const rounds: Buddy[][] = []
  const seen = new Map<Component, number>()
  for (const b of picked) {
    const r = seen.get(b.component) ?? 0
    seen.set(b.component, r + 1)
    ;(rounds[r] ??= []).push(b)
  }
  return rounds.flatMap((r) => r.sort((a, b) => order(a) - order(b)))
}

// ---------------------------------------------------------------- per item measurements

export interface BuddyShape {
  /** Model-space bounds of the item at FoodModel size 1. */
  box: THREE.Box3
  /** What the on-screen size is matched against: height, or most of the width for wide portions. */
  extent: number
  /** Widest side of the footprint, for the contact shadow. */
  footprint: number
  triangles: number
}

const shapes = new Map<string, BuddyShape>()

/** Bounds and cost of an item, measured once. */
export function buddyShape(itemId: string, component: Component): BuddyShape {
  const key = `${itemId}:${component}`
  const hit = shapes.get(key)
  if (hit) return hit
  const built = foodGeometry(itemId, component)
  const box = new THREE.Box3()
  for (const g of [built.matte, built.soft, built.clear]) {
    if (!g) continue
    if (!g.boundingBox) g.computeBoundingBox()
    box.union(g.boundingBox!)
  }
  const size = box.getSize(new THREE.Vector3())
  const shape: BuddyShape = {
    box,
    // Wide, low portions (two burger halves side by side) would come out tiny if their full width
    // had to fit; letting them run a little wider keeps every food about the same visual weight.
    extent: Math.max(size.y * 1.05, size.x * 0.78, size.z * 0.9, 0.2),
    footprint: Math.max(size.x, size.z),
    triangles: built.triangles,
  }
  shapes.set(key, shape)
  return shape
}
