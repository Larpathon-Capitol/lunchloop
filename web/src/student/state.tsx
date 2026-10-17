// Shared state for the student view: who this device is, today's date,
// the player's stats, a small catalog of menu items, and the food info sheet.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { api, ApiError, type Allergen, type Component, type Me, type PrepList, type SpinOption, type VoteResult } from '../shared/api'
import { deviceId } from '../shared/device'

export interface FoodInfo {
  item_id: string
  name: string
  allergens: Allergen[]
  component?: Component
}

export interface Calendar {
  today: string
  /** The next day with a menu, which is what Called It guesses are scored against. */
  next: PrepList | null
}

/** Today's vote as this device cast it, so the tally survives a tab switch. */
export interface StoredVote {
  date: string
  device: string
  chosen: SpinOption
  result: VoteResult
  /** XP the vote added, from the API's before and after totals. Null if we didn't know the before. */
  gained: number | null
}

const voteKey = (date: string) => `lunchloop.vote.${date}`

/** Reads today's stored vote. Storage can be blocked (private modes), so this never throws. */
export function readStoredVote(date: string, device: string): StoredVote | null {
  try {
    const raw = sessionStorage.getItem(voteKey(date))
    if (!raw) return null
    const v = JSON.parse(raw) as StoredVote
    return v && v.device === device && v.date === date && v.result && v.chosen ? v : null
  } catch {
    return null
  }
}

function writeStoredVote(v: StoredVote) {
  try {
    sessionStorage.setItem(voteKey(v.date), JSON.stringify(v))
  } catch {
    // Storage blocked: the in-memory copy still covers tab switches.
  }
}

interface StudentState {
  device: string
  me: Me | null
  meError: ApiError | null
  setMe: (me: Me) => void
  refreshMe: () => Promise<void>
  calendar: Calendar | null
  calendarError: ApiError | null
  reloadCalendar: () => void
  catalog: Record<string, FoodInfo>
  addToCatalog: (items: FoodInfo[]) => void
  lastVote: StoredVote | null
  rememberVote: (v: StoredVote) => void
  food: FoodInfo | null
  showFood: (item: FoodInfo) => void
  closeFood: () => void
}

const Ctx = createContext<StudentState | null>(null)

/** "2026-10-19" plus n days, as a local date so it never shifts. */
export function addDays(iso: string, n: number) {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d + n)
  const pad = (v: number) => String(v).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Finds the next day after `today` that has a menu (skips weekends and breaks). */
async function nextMenuDay(today: string): Promise<PrepList | null> {
  for (let i = 1; i <= 10; i++) {
    try {
      return await api.prep(addDays(today, i))
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) continue
      throw e
    }
  }
  return null
}

function asError(e: unknown) {
  return e instanceof ApiError ? e : new ApiError(0, String(e))
}

export function StudentProvider({ children }: { children: ReactNode }) {
  const [device] = useState(deviceId)
  const [me, setMe] = useState<Me | null>(null)
  const [meError, setMeError] = useState<ApiError | null>(null)
  const [calendar, setCalendar] = useState<Calendar | null>(null)
  const [calendarError, setCalendarError] = useState<ApiError | null>(null)
  const [calendarTick, setCalendarTick] = useState(0)
  const [catalog, setCatalog] = useState<Record<string, FoodInfo>>({})
  const [food, setFood] = useState<FoodInfo | null>(null)
  const [lastVote, setLastVote] = useState<StoredVote | null>(null)
  const alive = useRef(true)
  const meRequest = useRef(0)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const closeFood = useCallback(() => setFood(null), [])
  const reloadCalendar = useCallback(() => setCalendarTick((t) => t + 1), [])

  const rememberVote = useCallback((v: StoredVote) => {
    setLastVote(v)
    writeStoredVote(v)
  }, [])

  const addToCatalog = useCallback((items: FoodInfo[]) => {
    setCatalog((prev) => {
      const next = { ...prev }
      for (const item of items) next[item.item_id] = { ...prev[item.item_id], ...item, component: item.component ?? prev[item.item_id]?.component }
      return next
    })
  }, [])

  // Only the newest request may update state, and never after the view is gone.
  const refreshMe = useCallback(async () => {
    const n = ++meRequest.current
    try {
      const fresh = await api.me(device)
      if (!alive.current || n !== meRequest.current) return
      setMe(fresh)
      setMeError(null)
    } catch (e) {
      if (!alive.current || n !== meRequest.current) return
      setMeError(asError(e))
    }
  }, [device])

  useEffect(() => {
    void refreshMe()
  }, [refreshMe])

  useEffect(() => {
    let live = true
    setCalendarError(null)
    ;(async () => {
      const { today } = await api.health()
      const [todayMenu, next] = await Promise.all([
        api.prep(today).catch(() => null),
        nextMenuDay(today),
      ])
      if (!live) return
      for (const list of [todayMenu, next]) if (list) addToCatalog(list.items)
      setCalendar({ today, next })
    })().catch((e) => {
      if (live) setCalendarError(asError(e))
    })
    return () => {
      live = false
    }
  }, [calendarTick, addToCatalog])

  const value = useMemo<StudentState>(
    () => ({
      device,
      me,
      meError,
      setMe,
      refreshMe,
      calendar,
      calendarError,
      reloadCalendar,
      catalog,
      addToCatalog,
      lastVote,
      rememberVote,
      food,
      showFood: setFood,
      closeFood,
    }),
    [device, me, meError, refreshMe, calendar, calendarError, reloadCalendar, catalog, addToCatalog, lastVote, rememberVote, food, closeFood],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStudent() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useStudent must be used inside StudentProvider')
  return v
}
