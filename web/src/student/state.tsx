// Shared state for the student game: who this device is, today's date, the player's
// stats, tomorrow's tray (and the picks made so far), a small catalog of menu items,
// and the food info sheet. Tabs share it, so nothing resets on a tab switch.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { api, ApiError, type Allergen, type Component, type Me, type PrepList, type SpinOption, type Tray, type TrayPicks, type VoteResult } from '../shared/api'
import { addDays } from '../shared/format'
import { deviceId } from '../shared/device'
import { activeStudentSchool } from '../shared/studentSchool'

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

const voteKey = (date: string) => `lunchloop.vote.${activeStudentSchool()}.${date}`

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

const draftKey = (date: string) => `lunchloop.trayDraft.${activeStudentSchool()}.${date}`

/** Picks made before packing, kept for this tab session so a reload doesn't lose them. */
function readDraft(date: string, device: string): TrayPicks {
  try {
    const raw = sessionStorage.getItem(draftKey(date))
    if (!raw) return {}
    const v = JSON.parse(raw) as { device: string; picks: TrayPicks }
    return v && v.device === device && v.picks && typeof v.picks === 'object' ? v.picks : {}
  } catch {
    return {}
  }
}

function writeDraft(date: string, device: string, picks: TrayPicks) {
  try {
    sessionStorage.setItem(draftKey(date), JSON.stringify({ device, picks }))
  } catch {
    // Storage blocked: the in-memory copy still covers this visit.
  }
}

export type TrayLoad =
  | { state: 'loading' }
  | { state: 'error'; error: ApiError }
  | { state: 'ready'; data: Tray }

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
  tray: TrayLoad
  reloadTray: () => void
  /** Replace the loaded tray, for example with the tally after packing. */
  setTray: (t: Tray) => void
  /** Picks made so far (before packing). Only components on the tray count. */
  draft: TrayPicks
  setDraftPick: (component: Component, item_id: string | null) => void
  /** Changes whenever the streak should pop in the HUD. */
  hudBump: number
  bumpHud: () => void
  food: FoodInfo | null
  showFood: (item: FoodInfo) => void
  closeFood: () => void
}

const Ctx = createContext<StudentState | null>(null)

export { addDays }

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
  const [tray, setTrayLoad] = useState<TrayLoad>({ state: 'loading' })
  const [trayTick, setTrayTick] = useState(0)
  const [draft, setDraft] = useState<TrayPicks>({})
  const [hudBump, setHudBump] = useState(0)
  const bumpHud = useCallback(() => setHudBump((b) => b + 1), [])
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

  useEffect(() => {
    let live = true
    setTrayLoad((t) => (t.state === 'ready' ? t : { state: 'loading' }))
    api
      .getTray(device)
      .then((data) => {
        if (!live) return
        addToCatalog(data.groups.flatMap((g) => g.items.map((i) => ({ ...i, component: g.component }))))
        setDraft(data.picks ? {} : readDraft(data.open_date, device))
        setTrayLoad({ state: 'ready', data })
      })
      .catch((e) => {
        if (live) setTrayLoad({ state: 'error', error: asError(e) })
      })
    return () => {
      live = false
    }
  }, [device, trayTick, addToCatalog])

  const reloadTray = useCallback(() => setTrayTick((t) => t + 1), [])
  const setTray = useCallback((data: Tray) => setTrayLoad({ state: 'ready', data }), [])
  const trayDate = tray.state === 'ready' ? tray.data.open_date : null
  const setDraftPick = useCallback(
    (component: Component, item_id: string | null) => {
      setDraft((prev) => {
        const next = { ...prev, [component]: item_id }
        if (trayDate) writeDraft(trayDate, device, next)
        return next
      })
    },
    [trayDate, device],
  )

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
      tray,
      reloadTray,
      setTray,
      draft,
      setDraftPick,
      hudBump,
      bumpHud,
      food,
      showFood: setFood,
      closeFood,
    }),
    [device, me, meError, refreshMe, calendar, calendarError, reloadCalendar, catalog, addToCatalog, lastVote, rememberVote, tray, reloadTray, setTray, draft, setDraftPick, hudBump, bumpHud, food, closeFood],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStudent() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useStudent must be used inside StudentProvider')
  return v
}
