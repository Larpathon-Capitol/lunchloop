import type { FoodGroupComponent } from '../shared/icons'

/** The kitchen's view of today's packed trays. Mirrors `tray` in GET /api/admin/summary. */
export interface TrayItemTally {
  item_id: string
  name: string
  picks: number
  /** picks / total, 0 to 1 */
  share: number
}

export interface TrayGroupTally {
  component: FoodGroupComponent
  skips: number
  items: TrayItemTally[]
}

export interface TraySummary {
  target_date: string
  total: number
  groups: TrayGroupTally[]
}

export const TRAY_ORDER: FoodGroupComponent[] = ['meat_alternate', 'grain', 'vegetable', 'fruit', 'milk']
