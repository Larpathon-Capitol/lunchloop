// Typed client for the LunchLoop API (see docs/backend-contract.md).
// VITE_API_URL points at the deployed backend; in dev the Vite proxy forwards /api.

import { getDemoDate } from './demo'
import { SIGNED_DEVICE, saveDeviceId } from './device'

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

export interface PrepItem extends DietInfo {
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

/** Diet tags the kitchen marks on each food. vegan always comes with vegetarian. */
export type DietTag = 'vegetarian' | 'vegan' | 'contains_pork' | 'contains_beef' | 'spicy'

/** Dietary facts on every food: tags from the kitchen, plus two worked out from the allergens. */
export interface DietInfo {
  diet: DietTag[]
  /** No wheat allergen. */
  gluten_free: boolean
  /** No milk allergen. */
  dairy_free: boolean
}

export interface SpinOption extends DietInfo {
  item_id: string
  name: string
  allergens: Allergen[]
}

/** Every entree, for the spinning reel. Only `options` can be voted for. */
export interface PoolItem extends DietInfo {
  item_id: string
  name: string
}

export interface Spin {
  date: string
  target_date: string
  target_slot: string
  /** Today's ballot: four entrees, at least one vegetarian. */
  options: SpinOption[]
  pool: PoolItem[]
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

/** A food whose leftovers staff made free today. `since` is an ISO time. */
export interface FreeItem {
  item_id: string
  name: string
  component: Component
  since: string
}

/** The tray this student packed earlier for today's lunch, and whether they checked in after eating. */
export interface TodayLunch {
  date: string
  picks: TrayPicks
  items: { component: Component; item_id: string; name: string }[]
  /** true = got their picks, false = something ran out, null = not checked in yet. */
  checked_in: boolean | null
}

/** Per-stamp progress counts on /api/me (api/game.py player_counts). Missing on older servers. */
export interface StampCounts {
  trays: number
  entrees: number
  checkins: number
  votes: number
  calls: number
  correct_calls: number
  longest_streak: number
}

export interface Me {
  device: string
  streak: number
  xp: number
  badges: string[]
  last_guess: { target_date: string; item_id: string; correct: boolean | null } | null
  /** Correct "call it" guesses so far. */
  correct_calls?: number
  /** This device voted today at this school. */
  voted_today: boolean
  /** This device packed a tray today at this school. */
  packed_today: boolean
  today_lunch: TodayLunch | null
  free_today: FreeItem[]
  /** Progress toward each stamp. */
  stamp_counts?: StampCounts
  simulated: true
}

/** One food on tomorrow's tray. */
export interface TrayItem extends DietInfo {
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
  today_lunch: TodayLunch | null
  free_today: FreeItem[]
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
  /** Today's lunch service: students who packed a tray for today and checked in after eating. Null when nobody packed for today. */
  service: ServiceView | null
  free: { item_id: string; name: string; since: string }[]
  simulated: true
}

export interface ServiceView {
  date: string
  packed: number
  checked_in: number
  got: number
  missed: number
  /** Every food on today's menu, in tray order. */
  items: {
    item_id: string
    name: string
    component: Component
    wanted: number
    got: number
    missed: number
    /** Wanted it but has not checked in yet. */
    waiting: number
    free: boolean
  }[]
}

export interface FreeList {
  date: string
  free: FreeItem[]
  simulated: true
}

export interface Health {
  ok: true
  today: string
  simulated: true
}

export type EventKind =
  | 'spin' | 'vote' | 'tray' | 'guess' | 'served' | 'free' | 'staff_sign_in' | 'staff_sign_in_failed'
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

export interface DemoCalendar {
  /** The simulated "today" this browser is on. */
  today: string
  school_days: string[]
  default_today: string
  simulated: true
}

export interface DemoCrowd {
  ok: true
  added: number
  date: string
  totals: { votes: number; trays: number }
  simulated: true
}

export type EventScope = 'live' | 'simulated'

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

// A presenter can step the simulated school's calendar. The day lives in this browser only and
// rides along as X-Demo-Date; the server ignores it for the live school.
function demoHeader(): Record<string, string> {
  const day = getDemoDate()
  return day ? { 'X-Demo-Date': day } : {}
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_ROOT}/api${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...demoHeader(), ...init?.headers },
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

// The server signs each browser's id so scripts can't invent voters. The first call that needs a
// player trades the plain id for a signed one (keeping its streak) and saves it. If the server is
// older and has no /device route yet, the plain id keeps working.
const signing = new Map<string, Promise<string>>()
function signed(device: string): Promise<string> {
  if (SIGNED_DEVICE.test(device)) return Promise.resolve(device)
  let pending = signing.get(device)
  if (!pending) {
    pending = request<{ device: string }>('/device', post({ legacy: device }))
      .then((r) => {
        if (SIGNED_DEVICE.test(r.device)) {
          saveDeviceId(r.device)
          return r.device
        }
        return device
      })
      .catch(() => {
        signing.delete(device)
        return device
      })
    signing.set(device, pending)
  }
  return pending
}

export const api = {
  health: () => request<Health>('/health'),
  prep: (date?: string, ratio?: number) => request<PrepList>(`/prep${query({ date, ratio })}`),
  savings: (weeks?: number, ratio?: number) => request<Savings>(`/savings${query({ weeks, ratio })}`),
  simulate: (body: { date?: string; attendance_multiplier: number; price_multiplier: number; ratio: number }) =>
    request<SimulateResult>('/simulate', post(body)),
  spin: async (device: string) => request<Spin>(`/spin${query({ device: await signed(device), school: school() })}`),
  vote: async (device: string, item_id: string) => request<VoteResult>('/vote', post({ device: await signed(device), item_id, school: school() })),
  guess: async (device: string, item_id: string) => request<GuessResult>('/guess', post({ device: await signed(device), item_id, school: school() })),
  /** Tomorrow's tray. 404 when there is no next school day. */
  getTray: async (device: string) => request<Tray>(`/tray${query({ device: await signed(device), school: school() })}`),
  /** Pack today's tray. 400 with a plain message for bad picks, 409 when already packed today. */
  postTray: async (device: string, picks: TrayPicks) => request<TrayResult>('/tray', post({ device: await signed(device), picks, school: school() })),
  me: async (device: string) => request<Me>(`/me${query({ device: await signed(device), school: school() })}`),
  meter: () => request<Meter>('/meter'),
  schools: () => request<Schools>('/schools'),
  adminLogin: (school_id: string, password: string) => request<AdminLogin>('/admin/login', post({ school_id, password })),
  adminSummary: (token: string) => request<AdminSummary>('/admin/summary', bearer(token)),
  events: (after = 0, limit?: number, scope?: EventScope) => request<Events>(`/events${query({ after, limit, scope })}`),
  /** After lunch: did the student get what they packed? Can be changed later the same day. */
  served: async (device: string, got: boolean) =>
    request<{ ok: true; date: string; got: boolean; simulated: true }>('/served', post({ device: await signed(device), got, school: school() })),
  /** Foods whose leftovers are free right now at the student's school. */
  free: () => request<FreeList>(`/free${query({ school: school() })}`),
  /** Staff: make a food's leftovers free, or end it. The token decides the school. */
  adminFree: (token: string, item_id: string, free: boolean) =>
    request<{ ok: true; date: string; free: { item_id: string; name: string; since: string }[]; simulated: true }>('/admin/free', {
      ...post({ item_id, free }),
      ...bearer(token),
    }),
  /** Simulated schools only. */
  demoCalendar: (schoolId = DEFAULT_SCHOOL) => request<DemoCalendar>(`/demo/calendar${query({ school: schoolId })}`),
  /** Adds 1 to 40 simulated students who vote, pack a tray and sometimes guess, on the current demo day. */
  demoCrowd: (count: number, schoolId = DEFAULT_SCHOOL) => request<DemoCrowd>('/demo/crowd', post({ school: schoolId, count })),
  traceForecast: (item_id: string, date?: string, ratio?: number) =>
    request<ForecastTrace>(`/trace/forecast${query({ item_id, date, ratio })}`),
}
