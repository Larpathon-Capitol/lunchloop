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
  dollars_short: number
}

export interface Savings {
  simulated: true
  weeks: number
  ratio: number
  lunchloop: BacktestSide
  usual: BacktestSide
  shortage_ratio: number
  leftover_cut_pct: number
  /** Leftover dollars saved minus shortages priced at shortage_ratio times food cost. Can be negative. */
  net_dollars_saved: number
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
  /** This device voted today at this school. */
  voted_today: boolean
  /** This device packed a tray today at this school. */
  packed_today: boolean
  simulated: true
}

/** One food on tomorrow's tray. */
export interface TrayItem {
  item_id: string
  name: string
  allergens: Allergen[]
}

export interface TrayGroup {
  component: Component
  items: TrayItem[]
}

/** item_id = picked, null = skipped on purpose. */
export type TrayPicks = Partial<Record<Component, string | null>>

/** Trays packed today at this school, for today's target day. share is 0 to 1. */
export interface TrayTally {
  target_date: string
  total: number
  groups: {
    component: Component
    skips: number
    items: { item_id: string; name: string; picks: number; share: number }[]
  }[]
}

export interface Tray {
  open_date: string
  target_date: string
  /** Components on the target day, in tray order. Groups with no food that day are left out. */
  groups: TrayGroup[]
  /** This device's tray for today, or null when it hasn't packed yet. */
  picks: TrayPicks | null
  /** Only when this device already packed today. */
  tally: TrayTally | null
  simulated: true
}

export interface TrayResult {
  ok: true
  target_date: string
  streak: number
  xp: number
  tally: TrayTally
  simulated: true
}

export interface Meter {
  simulated: true
  week_start: string
  /** Leftover-only values. */
  servings_saved: number
  dollars_saved: number
  /** Leftover savings minus extra shortages priced at 3 times food cost. Can be negative. */
  net_dollars_saved: number
  extra_short_servings: number
}

export interface School {
  school_id: string
  name: string
  /** Set only for the public demo school. */
  demo_password: string | null
}

export interface Schools {
  schools: School[]
  simulated: true
}

export interface AdminLogin {
  token: string
  school: { school_id: string; name: string }
  /** ISO UTC time. */
  expires_at: string
  simulated: true
}

export interface AdminSummary {
  school: { school_id: string; name: string; students: number }
  today: string
  vote: {
    target_date: string
    target_slot: string
    total: number
    options: { item_id: string; name: string; votes: number; share: number }[]
  } | null
  recent_votes: {
    open_date: string
    target_date: string
    total: number
    winner: { item_id: string; name: string; votes: number }
  }[]
  past_winners: { date: string; item_id: string; name: string; vote_share: number }[]
  /** Trays packed today for the next school day, or null when there is no tray menu. */
  tray: TrayTally | null
  guesses: { target_date: string; total: number; items: { item_id: string; name: string; guesses: number }[] } | null
  players: { total: number; voted_today: number; voted_last_5_days: number }
  simulated: true
}

export interface Health {
  ok: true
  today: string
  simulated: true
}

export type EventKind =
  | 'spin' | 'vote' | 'tray' | 'guess' | 'staff_sign_in' | 'staff_sign_in_failed'
  | 'prep' | 'savings' | 'simulate' | 'meter' | 'rate_limited'

export interface ServerEvent {
  id: number
  at: string
  kind: EventKind
  school_id: string | null
  /** Anonymous 6-character tag for one device, or null. */
  player: string | null
  summary: string
  detail: Record<string, unknown>
  ms: number | null
}

export interface Events {
  events: ServerEvent[]
  latest_id: number
  simulated: true
}

export interface ForecastTrace {
  item_id: string
  name: string
  date: string
  weekday: string
  ratio: number
  history: { date: string; attendance: number; taken: number; rate: number }[]
  mean_rate: number
  attendance: number
  attendance_history: { date: string; attendance: number }[]
  predicted: number
  misses: number[]
  sigma: number
  sigma_fallback: boolean
  service_level: number
  z: number
  buffer: number
  floor: number
  prep: number
  reason: string
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
const bearer = (token: string): RequestInit => ({ headers: { Authorization: `Bearer ${token}` } })

// Students belong to the demo school unless the link said otherwise (?school=<id>).
// Only a non-default school is sent, so requests stay the same for the demo.
const DEFAULT_SCHOOL = 'demo'
let currentSchool = DEFAULT_SCHOOL
export function setStudentSchool(id: string | null | undefined) {
  currentSchool = id && /^[a-z0-9-]{1,40}$/.test(id) ? id : DEFAULT_SCHOOL
}
const school = () => (currentSchool === DEFAULT_SCHOOL ? undefined : currentSchool)

export const api = {
  health: () => request<Health>('/health'),
  prep: (date?: string, ratio?: number) => request<PrepList>(`/prep${query({ date, ratio })}`),
  savings: (weeks?: number, ratio?: number) => request<Savings>(`/savings${query({ weeks, ratio })}`),
  simulate: (body: { date?: string; attendance_multiplier: number; price_multiplier: number; ratio: number }) =>
    request<SimulateResult>('/simulate', post(body)),
  spin: (device: string) => request<Spin>(`/spin${query({ device, school: school() })}`),
  vote: (device: string, item_id: string) => request<VoteResult>('/vote', post({ device, item_id, school: school() })),
  guess: (device: string, item_id: string) => request<GuessResult>('/guess', post({ device, item_id, school: school() })),
  /** Tomorrow's tray. 404 when there is no next school day. */
  getTray: (device: string) => request<Tray>(`/tray${query({ device, school: school() })}`),
  /** Pack today's tray. 400 with a plain message for bad picks, 409 when already packed today. */
  postTray: (device: string, picks: TrayPicks) => request<TrayResult>('/tray', post({ device, picks, school: school() })),
  me: (device: string) => request<Me>(`/me${query({ device, school: school() })}`),
  meter: () => request<Meter>('/meter'),
  schools: () => request<Schools>('/schools'),
  adminLogin: (school_id: string, password: string) => request<AdminLogin>('/admin/login', post({ school_id, password })),
  adminSummary: (token: string) => request<AdminSummary>('/admin/summary', bearer(token)),
  events: (after = 0, limit?: number) => request<Events>(`/events${query({ after, limit })}`),
  traceForecast: (item_id: string, date?: string, ratio?: number) =>
    request<ForecastTrace>(`/trace/forecast${query({ item_id, date, ratio })}`),
}
