import { useEffect, useRef, useState } from 'react'
import { api } from '../shared/api'
import type { EventKind, ServerEvent } from '../shared/api'

const POLL_MS = 1500
const PAGE = 100
/** Rows kept on screen. */
export const MAX_ROWS = 40

export type FeedStatus = 'connecting' | 'live' | 'paused' | 'offline'

export interface Counts {
  votes: number
  guesses: number
  signIns: number
  forecasts: number
}

const FORECAST_KINDS: EventKind[] = ['prep', 'savings', 'simulate', 'meter']

function tally(counts: Counts, events: ServerEvent[]): Counts {
  const next = { ...counts }
  for (const e of events) {
    if (e.kind === 'vote') next.votes++
    else if (e.kind === 'guess') next.guesses++
    else if (e.kind === 'staff_sign_in') next.signIns++
    else if (FORECAST_KINDS.includes(e.kind)) next.forecasts++
  }
  return next
}

const ZERO: Counts = { votes: 0, guesses: 0, signIns: 0, forecasts: 0 }

/**
 * Polls GET /api/events while the tab is visible. Opens with the newest rows the server
 * still has (not counted), then pages forward from the last id seen. Rows are newest first.
 * `fresh` is the batch that just arrived, for the diagram and the screen reader line.
 */
export function useEventFeed() {
  const [rows, setRows] = useState<ServerEvent[]>([])
  const [counts, setCounts] = useState<Counts>(ZERO)
  const [status, setStatus] = useState<FeedStatus>('connecting')
  const [fresh, setFresh] = useState<{ seq: number; events: ServerEvent[] }>({ seq: 0, events: [] })
  const last = useRef<number | null>(null)

  useEffect(() => {
    let live = true
    let timer: ReturnType<typeof setTimeout> | undefined
    let running = false
    // Slows down after errors (up to 15 s) so a struggling server isn't hammered.
    let delay = POLL_MS

    async function open() {
      // One tiny call to learn the newest id, then the newest rows behind it.
      const head = await api.events(0, 1)
      const latest = head.latest_id
      const start = Math.max(0, latest - MAX_ROWS)
      const backlog = latest > 0 ? await api.events(start, MAX_ROWS) : head
      const events = backlog.events.filter((e) => e.id > start)
      last.current = Math.max(latest, ...events.map((e) => e.id), 0)
      if (live) setRows(events.slice().reverse())
    }

    async function pull() {
      const arrived: ServerEvent[] = []
      // Page forward until caught up, so a burst never falls behind.
      for (;;) {
        const page = await api.events(last.current ?? 0, PAGE)
        if (page.latest_id < (last.current ?? 0)) {
          // The server restarted and its ids began again.
          last.current = null
          if (live) setRows([])
          return
        }
        arrived.push(...page.events)
        if (page.events.length) last.current = page.events[page.events.length - 1].id
        if (page.events.length < PAGE) break
      }
      if (!live || arrived.length === 0) return
      setRows((prev) => [...arrived.slice(-MAX_ROWS).reverse(), ...prev].slice(0, MAX_ROWS))
      setCounts((c) => tally(c, arrived))
      setFresh((f) => ({ seq: f.seq + 1, events: arrived }))
    }

    async function tick() {
      if (!live || running) return
      if (document.hidden) {
        setStatus('paused')
        return
      }
      running = true
      try {
        if (last.current === null) await open()
        else await pull()
        if (live) setStatus('live')
        delay = POLL_MS
      } catch {
        if (live) setStatus('offline')
        delay = Math.min(delay * 2, 15000)
      } finally {
        running = false
      }
      if (live && !document.hidden) timer = setTimeout(tick, delay)
    }

    function onVisibility() {
      clearTimeout(timer)
      if (document.hidden) setStatus('paused')
      else tick()
    }

    tick()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      live = false
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return { rows, counts, status, fresh }
}
