// Food group helpers for the game: names, glaze colors, icons, and Ume's names for them.
import type { Component } from '../shared/api'
import { copy } from '../shared/copy'
import type { FoodGroup } from '../mascot'

export const GLAZE: Record<Component, string> = {
  meat_alternate: 'var(--g-entree)',
  grain: 'var(--g-grain)',
  vegetable: 'var(--g-vegetable)',
  fruit: 'var(--g-fruit)',
  milk: 'var(--g-milk)',
}

export const groupName = (c: Component) => copy.student.groups[c] ?? c

/** Ume calls the entree slot "entree". */
export const umeGroup = (c: Component): FoodGroup => (c === 'meat_alternate' ? 'entree' : c)
