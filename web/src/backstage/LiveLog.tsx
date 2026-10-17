import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ServerEvent } from '../shared/api'
import type { ReactNode } from 'react'
import { backstage as t } from '../shared/copy/backstage'
import { fmtInt } from '../shared/format'
import { useReducedMotion } from '../shared/motion'
import { rowSpring } from './springs'
import type { Counts, FeedStatus } from './useEventFeed'

const ANNOUNCE_GAP_MS = 5000
const MERGE_WINDOW_MS = 5000
const WARN_KINDS = new Set(['staff_sign_in_failed', 'rate_limited'])

const timeFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' })
const fmtTime = (iso: string) => timeFmt.format(new Date(iso))
const fmtMs = (ms: number) => (ms < 10 ? ms.toFixed(1) : fmtInt(ms))

function schoolName(id: string | null) {
  if (!id) return null
  return id === 'live' ? t.log.schoolLive : t.log.schoolSimulated
}

interface Group {
  /** The oldest row's id. New rows join at the newest end, so the key stays put and the row does not re-animate. */
  key: number
  newest: ServerEvent
  oldestAt: number
  count: number
}

const LOOK_BACK_GROUPS = 4
const sameKind = (a: ServerEvent, b: ServerEvent) =>
  a.kind === b.kind && a.school_id === b.school_id && a.player === b.player && a.summary === b.summary

/**
 * Rows arrive newest first. Rows of the same kind, school, player and summary that landed within a
 * few seconds of each other become one row with a count. A page load logs prep and meter rows
 * interleaved, so a row may join one of the last few groups, not only the one just above it.
 */
function groupRows(rows: ServerEvent[]): Group[] {
  const groups: Group[] = []
  for (const e of rows) {
    const at = Date.parse(e.at)
    const home = groups
      .slice(-LOOK_BACK_GROUPS)
      .find((g) => sameKind(g.newest, e) && g.oldestAt - at <= MERGE_WINDOW_MS)
    if (home) {
      home.key = e.id
      home.oldestAt = at
      home.count++
    } else {
      groups.push({ key: e.id, newest: e, oldestAt: at, count: 1 })
    }
  }
  return groups
}

function Row({ e, count }: { e: ServerEvent; count: number }) {
  const school = schoolName(e.school_id)
  return (
    <>
      <span className="b-row__time num">{fmtTime(e.at)}</span>
      <span className="b-row__kind" data-warn={WARN_KINDS.has(e.kind) || undefined}>
        {t.kinds[e.kind] ?? e.kind}
        {count > 1 && <span className="b-row__count num"> {t.log.count(count)}</span>}
      </span>
      <span className="b-row__body">
        <span className="b-row__summary">{e.summary}</span>
        {(school || e.player) && (
          <span className="b-row__meta">
            {school && <span>{school}</span>}
            {e.player && <span className="num">{t.log.player(e.player)}</span>}
          </span>
        )}
      </span>
      <span className="b-row__ms num">{count === 1 && e.ms !== null ? t.log.ms(fmtMs(e.ms)) : ''}</span>
    </>
  )
}

/** Speaks at most one short line every few seconds, not every event. */
function useAnnouncer(fresh: { seq: number; events: ServerEvent[] }) {
  const [line, setLine] = useState('')
  const pending = useRef<ServerEvent[]>([])
  const lastAt = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (!fresh.events.length) return
    pending.current.push(...fresh.events)
    const flush = () => {
      const batch = pending.current
      pending.current = []
      timer.current = undefined
      if (!batch.length) return
      const newest = batch[batch.length - 1].summary
      setLine(batch.length === 1 ? t.log.announceOne(newest) : t.log.announceMany(batch.length, newest))
      lastAt.current = Date.now()
    }
    if (timer.current) return
    const waitMs = Math.max(0, lastAt.current + ANNOUNCE_GAP_MS - Date.now())
    timer.current = setTimeout(flush, waitMs)
  }, [fresh.seq])

  useEffect(() => () => clearTimeout(timer.current), [])
  return line
}

export function LiveLog({
  rows,
  status,
  fresh,
  empty,
}: {
  rows: ServerEvent[]
  status: FeedStatus
  fresh: { seq: number; events: ServerEvent[] }
  /** What to show before anything has happened. Defaults to the general hint. */
  empty?: ReactNode
}) {
  const reduce = useReducedMotion()
  const line = useAnnouncer(fresh)
  const groups = useMemo(() => groupRows(rows), [rows])
  const statusText =
    status === 'live' ? t.log.watching : status === 'paused' ? t.log.paused : status === 'offline' ? t.log.reconnecting : t.log.loading

  return (
    <section className="b-panel b-log" aria-labelledby="b-log-h">
      <div className="b-log__head">
        <h2 id="b-log-h" className="b-panel__title">
          {t.log.heading}
        </h2>
        <p className="b-status" data-status={status}>
          <span className="b-status__dot" aria-hidden="true" />
          {statusText}
        </p>
      </div>
      <p className="visually-hidden" aria-live="polite">
        {line}
      </p>

      {rows.length === 0 && status !== 'connecting' ? (
        <div className="b-log__empty">{empty ?? t.log.empty}</div>
      ) : (
        <ol className="b-log__list" aria-label={t.log.listLabel}>
          <AnimatePresence initial={false}>
            {groups.map((g) => (
              <motion.li
                key={g.key}
                className="b-row"
                layout={reduce ? false : 'position'}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, transition: { duration: 0.12 } }}
                transition={reduce ? { duration: 0 } : rowSpring}
              >
                <Row e={g.newest} count={g.count} />
              </motion.li>
            ))}
          </AnimatePresence>
        </ol>
      )}
      <p className="b-footnote">{t.log.footnote}</p>
    </section>
  )
}

export function CountsStrip({ counts }: { counts: Counts }) {
  const reduce = useReducedMotion()
  const items: [number, (n: number) => string][] = [
    [counts.votes, t.counts.votes],
    [counts.guesses, t.counts.guesses],
    [counts.trays, t.counts.trays],
    [counts.signIns, t.counts.signIns],
    [counts.forecasts, t.counts.forecasts],
  ]
  return (
    <section className="b-counts" aria-labelledby="b-counts-h">
      <h2 id="b-counts-h" className="b-counts__title">
        {t.counts.heading}
      </h2>
      <dl className="b-counts__list">
        {items.map(([n, label], i) => (
          <div className="b-counts__item" key={i}>
            <dt className="b-counts__label">{label(n)}</dt>
            <dd className="b-counts__num num">
              <motion.span
                key={n}
                initial={reduce ? false : { opacity: 0.4, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={rowSpring}
              >
                {fmtInt(n)}
              </motion.span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
