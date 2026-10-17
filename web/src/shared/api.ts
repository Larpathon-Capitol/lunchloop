// Typed client for the LunchLoop API (see docs/backend-contract.md).
// VITE_API_URL points at the deployed backend; in dev the Vite proxy forwards /api.

const API_ROOT = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

export type Allergen =
  | 'milk' | 'egg' | 'fish' | 'shellfish' | 'tree_nuts'
  | 'peanuts' | 'wheat' | 'soybeans' | 'sesame'

export type Component = 'meat_alternate' | 'grain' | 'vegetable' | 'fruit' | 'milk'

export interface MealCheck {
  ok: boolean
  missing_components: string[]
  below_floor: { item_id: string; prep: number; floor: number }[]
}

export interface PrepItem {
  item_id: string
  name: string
  component: Component
  predicted: number
  buffer: number
  prep: number
  floor: number
  reason: string
  allergens: Allergen[]
}

export interface PrepList {
  date: string
  attendance: number
  ratio: number
  simulated: true
  items: PrepItem[]
  meal_check: MealCheck
}

export interface Totals {
  prep_servings: number
  expected_leftover_servings: number
  food_cost: number
  expected_waste_cost: number
}

export interface SimulateResult extends PrepList {
  totals: Totals
}

export interface BacktestSide {
  avg_miss: number
  leftover_servings: number
  dollars_wasted: number
  servings_short: number
}

export interface Savings {
  simulated: true
  weeks: number
  ratio: number
  lunchloop: BacktestSide
  usual: BacktestSide
  leftover_cut_pct: number
  series: { date: string; item_id: string; prep_lunchloop: number; prep_usual: number; taken: number }[]
}

export interface SpinOption {
  item_id: string
  name: string
  allergens: Allergen[]
}

export interface Spin {
  date: string
  target_date: string
  target_slot: string
  options: SpinOption[]
  already_voted: boolean
  simulated: true
}

export interface VoteResult {
  ok: true
  streak: number
  xp: number
  tally: Record<string, number>
  simulated: true
}

export interface GuessResult {
  ok: true
  target_date: string
  simulated: true
}

export interface Me {
  device: string
  streak: number
  xp: number
  badges: string[]
  last_guess: { target_date: string; item_id: string; correct: boolean | null } | null
  simulated: true
}

export interface Meter {
  simulated: true
  week_start: string
  servings_saved: number
  dollars_saved: number
}

export interface Health {
  ok: true
  today: string
  simulated: true
}

/** An error the UI can show as-is. `status` is 0 when the server couldn't be reached. */
export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_ROOT}/api${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    })
  } catch {
    throw new ApiError(0, 'unreachable')
  }
  const body = await res.json().catch(() => null)
  // No JSON at all means we reached something that isn't the LunchLoop API.
  if (body === null) throw new ApiError(0, 'unreachable')
  if (!res.ok) {
    throw new ApiError(res.status, body?.error ?? `Request failed (${res.status})`)
  }
  return body as T
}

function query(params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined) q.set(k, String(v))
  const s = q.toString()
  return s ? `?${s}` : ''
}

const post = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) })

export const api = {
  health: () => request<Health>('/health'),
  prep: (date?: string, ratio?: number) => request<PrepList>(`/prep${query({ date, ratio })}`),
  savings: (weeks?: number, ratio?: number) => request<Savings>(`/savings${query({ weeks, ratio })}`),
  simulate: (body: { date?: string; attendance_multiplier: number; price_multiplier: number; ratio: number }) =>
    request<SimulateResult>('/simulate', post(body)),
  spin: (device: string) => request<Spin>(`/spin${query({ device })}`),
  vote: (device: string, item_id: string) => request<VoteResult>('/vote', post({ device, item_id })),
  guess: (device: string, item_id: string) => request<GuessResult>('/guess', post({ device, item_id })),
  me: (device: string) => request<Me>(`/me${query({ device })}`),
  meter: () => request<Meter>('/meter'),
}
