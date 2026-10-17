import { COMPONENTS, type Component } from './store'

/** The five school lunch components, one per tray compartment. Same ids as the API. */
export const GROUP_IDS = COMPONENTS

export type GroupId = Component

export type GroupColors = Record<GroupId, string>

export interface FoodGroup {
  id: GroupId
  label: string
  /** Glaze color, used for the compartment rim highlight. */
  color: string
}

/** CSS token per compartment. The glaze colors live in tokens.css. */
export const GROUP_TOKENS: Record<GroupId, string> = {
  meat_alternate: '--g-entree',
  grain: '--g-grain',
  vegetable: '--g-vegetable',
  fruit: '--g-fruit',
  milk: '--g-milk',
}

/** Fallbacks, copied from tokens.css, for when the stylesheet is not loaded (the lab page). */
export const DEFAULT_GROUP_COLORS: GroupColors = {
  meat_alternate: '#b5523b',
  grain: '#93680f',
  vegetable: '#4f7f35',
  fruit: '#c94562',
  milk: '#3f729e',
}

export const GROUP_LABELS: Record<GroupId, string> = {
  meat_alternate: 'Main dish',
  grain: 'Grain',
  vegetable: 'Vegetable',
  fruit: 'Fruit',
  milk: 'Milk',
}

export const GROUPS: readonly FoodGroup[] = GROUP_IDS.map((id) => ({
  id,
  label: GROUP_LABELS[id],
  color: DEFAULT_GROUP_COLORS[id],
}))

/** Reads the glaze colors from the CSS tokens once, falling back to the hex values above. */
export function readTokenColors(): GroupColors {
  const out = { ...DEFAULT_GROUP_COLORS }
  if (typeof document === 'undefined') return out
  const css = getComputedStyle(document.documentElement)
  for (const id of GROUP_IDS) {
    const v = css.getPropertyValue(GROUP_TOKENS[id]).trim()
    if (v) out[id] = v
  }
  return out
}

export function resolveColors(colors?: Partial<GroupColors>): GroupColors {
  return { ...readTokenColors(), ...colors }
}
