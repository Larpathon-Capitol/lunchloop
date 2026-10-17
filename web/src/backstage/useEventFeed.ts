import { useEffect, useState } from 'react'
import { api } from '../shared/api'
import type { EventKind, EventScope, ServerEvent } from '../shared/api'

const POLL_MS = 1500
const PAGE = 100
/** Rows kept on screen. */
export const MAX_ROWS = 40
/** The server keeps this many events per scope. */
export const BUFFER = 300

export type FeedStatus = 'connecting' | 'live' | 'paused' | 'offline'

export interface Counts {
  votes: number
  guesses: number
  trays: number
  signIns: number
  forecasts: number
}

const FORECAST_KINDS: EventKind[] = ['prep', 'savings', 'simulate', 'meter']

function tally(counts: Counts, events: ServerEvent[]): Counts {
  const next = { ...counts }
  for (const e of events) {
    if (e.kind === 'vote') next.votes++
    else if (e.kind === 'guess') next.guesses++
    else if (e.kind === 'tray') next.trays++
    else if (e.kind === 'staff_sign_in') next.signIns++
    else if (FORECAST_KINDS.includes(e.kind)) next.forecasts++
  }
  return next
}

const ZERO: Counts = { votes: 0, guesses: 0, trays: 0, signIns: 0, forecasts: 0 }

interface Feed {
  /** The scope this state belongs to. State left over from another scope is never shown. */
  scope: EventScope
  rows: ServerEvent[]
  counts: Counts
  status: FeedStatus
  held: number
  fresh: { seq: number; events: ServerEvent[] }
}

const makeBlank = (scope: EventScope): Feed => ({ scope, rows: [], counts: ZERO, status: 'connecting', held: 0, fresh: { seq: 0, events: [] } })
// One stable blank per scope, so a render before the first response hands out the same objects.
const BLANK: Record<EventScope, Feed> = { live: makeBlank('live'), simulated: makeBlank('simulated') }
const blank = (scope: EventScope) => BLANK[scope]

/**
 * Polls GET /api/events for one scope (live or simulated) while the tab is visible. Opens with
 * the newest rows the server still has, then pages forward from the last id seen. Rows are
 * newest first. `counts` covers every event the server is holding for this scope. `fresh` is
 * the batch that just arrived, for the diagram and the screen reader line. `held` is how many
 * events of this scope the server is holding right now.
 *
 * Changing the scope starts over: a new cursor, empty rows and zero counts. A response that
 * was in flight for the old scope is dropped.
 */
export function useEventFeed(scope: EventScope) {
  const [feed, setFeed] = useState<Feed>(() => blank(scope))
  useEffect(() => {
    // Each run of this effect is one generation for one scope. Cleanup retires it, so a
    // response still in flight from an old scope is dropped instead of landing in the new one.
    let alive = true
    const current = () => alive
    /** Applies a change to this scope's state, starting from blank if the state is another scope's. */
    const update = (fn: (f: Feed) => Feed) => {
      if (current()) setFeed((prev) => fn(prev.scope === scope ? prev : blank(scope)))
    }
    // The last event id seen in this scope; null until the first read.
    let last: number | null = null
    let timer: ReturnType<typeof setTimeout> | undefined
    let running = false
    // Slows down after errors (up to 15 s) so a struggling server isn't hammered.
    let delay = POLL_MS

    async function open() {
      // Ids are shared by both scopes, so this scope's newest rows can sit anywhere below the
      // newest id. The buffer is small (300), so read it all: at most a few pages.
      const events: ServerEvent[] = []
      let after = 0
      let latest = 0
      for (;;) {
        const page = await api.events(after, PAGE, scope)
        if (!current()) return
        latest = page.latest_id
        events.push(...page.events)
        if (page.events.length) after = page.events[page.events.length - 1].id
        if (page.events.length < PAGE) break
      }
      last = Math.max(latest, after)
      update((f) => ({
        ...f,
        rows: events.slice(-MAX_ROWS).reverse(),
        counts: tally(ZERO, events),
        held: Math.min(events.length, BUFFER),
      }))
    }

    async function pull() {
      const arrived: ServerEvent[] = []
      // Page forward until caught up, so a burst never falls behind.
      for (;;) {
        const page = await api.events(last ?? 0, PAGE, scope)
        if (!current()) return
        if (page.latest_id < (last ?? 0)) {
          // The server restarted and its ids began again.
          last = null
          update((f) => ({ ...f, rows: [], counts: ZERO, held: 0 }))
          return
        }
        arrived.push(...page.events)
        if (page.events.length) last = page.events[page.events.length - 1].id
        if (page.events.length < PAGE) break
      }
      if (arrived.length === 0) return
      update((f) => ({
        ...f,
        rows: [...arrived.slice(-MAX_ROWS).reverse(), ...f.rows].slice(0, MAX_ROWS),
        counts: tally(f.counts, arrived),
        held: Math.min(f.held + arrived.length, BUFFER),
        fresh: { seq: f.fresh.seq + 1, events: arrived },
      }))
    }

    const setStatus = (status: FeedStatus) => update((f) => (f.status === status ? f : { ...f, status }))

    async function tick() {
      if (!current() || running) return
      if (document.hidden) {
        setStatus('paused')
        return
      }
      running = true
      try {
        if (last === null) await open()
        else await pull()
        setStatus('live')
        delay = POLL_MS
      } catch {
        setStatus('offline')
        delay = Math.min(delay * 2, 15000)
      } finally {
        running = false
      }
      if (current() && !document.hidden) timer = setTimeout(tick, delay)
    }

    function onVisibility() {
      clearTimeout(timer)
      if (document.hidden) setStatus('paused')
      else tick()
    }

    tick()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      alive = false
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [scope])

  const shown = feed.scope === scope ? feed : blank(scope)
  return { rows: shown.rows, counts: shown.counts, status: shown.status, fresh: shown.fresh, held: shown.held }
}
