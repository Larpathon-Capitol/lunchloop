import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import type { AdminSummary } from '../shared/api'
import { copy } from '../shared/copy'
import { fmtDay, fmtInt } from '../shared/format'
import { useReducedMotion } from '../shared/motion'
import { DEMO_SCHOOL, LIVE_SCHOOL } from '../shared/studentSchool'
import { ErrorNotice, Loading } from '../shared/ui/Notice'
import { SimulatedTag } from '../shared/ui/SimulatedTag'
import { LiveCount } from './LiveCount'
import type { SchoolSession } from './session'
import { ServicePanel } from './ServicePanel'
import { TrayPanel } from './TrayPanel'
import { useSummary } from './useSummary'

const t = copy.school.wants

const barSpring = { type: 'spring', stiffness: 170, damping: 24, mass: 0.9 } as const
const rowSpring = { type: 'spring', stiffness: 380, damping: 36 } as const
const shortDay = { weekday: 'short', month: 'short', day: 'numeric' } as const

function studentLink(schoolId: string) {
  const base = `${window.location.origin}${import.meta.env.BASE_URL}`
  if (schoolId === LIVE_SCHOOL) return `${base}live`
  const query = schoolId === DEMO_SCHOOL ? '' : `?school=${encodeURIComponent(schoolId)}`
  return `${base}student${query}`
}

function CopyLink({ schoolId }: { schoolId: string }) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const link = studentLink(schoolId)
  useEffect(() => () => clearTimeout(timer.current), [])

  async function copyIt() {
    clearTimeout(timer.current)
    try {
      await navigator.clipboard.writeText(link)
      setStatus('copied')
      timer.current = setTimeout(() => setStatus('idle'), 2400)
    } catch {
      setStatus('failed')
    }
  }

  return (
    <div className="s-copy">
      <button type="button" className="btn btn--quiet s-copy__btn" onClick={() => void copyIt()}>
        {status === 'copied' ? t.copied : t.copyLink}
      </button>
      <span className="visually-hidden" role="status">
        {status === 'copied' ? t.copied : ''}
      </span>
      {status === 'failed' && (
        <>
          <p className="s-copy__note">{t.copyFailed}</p>
          <input
            className="s-input s-copy__link"
            readOnly
            value={link}
            aria-label={t.linkLabel}
            onFocus={(e) => e.currentTarget.select()}
          />
        </>
      )}
    </div>
  )
}

function VoteRows({ vote, reduce }: { vote: NonNullable<AdminSummary['vote']>; reduce: boolean }) {
  const top = Math.max(0, ...vote.options.map((o) => o.votes))
  // Most votes first. Ties keep the order the server sent, so rows only move when the standings do.
  const ordered = vote.options
    .map((o, i) => ({ o, i }))
    .sort((a, b) => b.o.votes - a.o.votes || a.i - b.i)
    .map(({ o }) => o)
  return (
    <ul className="s-rows">
      {ordered.map((o) => {
        const lead = top > 0 && o.votes === top
        const pct = Math.round(o.share * 100)
        return (
          <motion.li key={o.item_id} className="s-row" layout="position" transition={reduce ? { duration: 0 } : rowSpring}>
            <div className="s-row__head">
              <span className="s-row__name">{o.name}</span>
              <span className="s-row__figs">
                <span className="s-row__big">
                  <LiveCount value={pct} format={(n) => t.share(Math.round(n))} />
                </span>
                <span className="s-row__sub">
                  <LiveCount value={o.votes} format={(n) => t.votes(Math.round(n))} />
                </span>
              </span>
            </div>
            <div className="s-meter" aria-hidden="true">
              <motion.div
                className={lead ? 's-meter__fill s-meter__fill--lead' : 's-meter__fill'}
                initial={{ scaleX: reduce ? o.share : 0 }}
                animate={{ scaleX: o.share }}
                transition={reduce ? { duration: 0 } : barSpring}
              />
            </div>
          </motion.li>
        )
      })}
    </ul>
  )
}

function Stat({ value, label, of }: { value: number; label: string; of: string | null }) {
  return (
    <div className="s-stat">
      <dt className="s-stat__label">{label}</dt>
      <dd className="s-stat__value">
        <span className="s-stat__big">
          <LiveCount value={value} />
        </span>
        {of && <span className="s-stat__of">{of}</span>}
      </dd>
    </div>
  )
}

export function Wants({ session, onExpired }: { session: SchoolSession; onExpired: () => void }) {
  const reduce = !!useReducedMotion()
  const [summary, retry, refresh] = useSummary(session.token, onExpired)

  if (summary.state === 'loading') return <Loading label={t.loading} />
  if (summary.state === 'error') return <ErrorNotice error={summary.error} onRetry={retry} />

  const { data, stale } = summary
  const { vote, players, guesses } = data
  const tray = data.tray ?? null
  const students = data.school.students
  const empty = !vote || vote.total === 0
  const ofPlayers = t.ofPlayers(fmtInt(players.total))

  const hint = stale ? t.stale : !vote ? t.noVoteOpen : vote.total === 0 ? t.emptyToday : t.live

  return (
    <div className="s-wants">
      <header className="s-head">
        <div>
          <h1 className="s-head__title">{t.title}</h1>
          <p className="s-head__sub">{fmtDay(data.today)}</p>
        </div>
        <SimulatedTag live={session.school.school_id === LIVE_SCHOOL} />
      </header>

      <ServicePanel
        service={data.service ?? null}
        freeList={data.free ?? []}
        token={session.token}
        onChanged={refresh}
        onExpired={onExpired}
      />

      <TrayPanel tray={tray} reduce={reduce} />

      <div className="s-grid">
        <section className="s-vote" aria-labelledby="s-vote-h">
          <div className="s-sec-head">
            <div>
              <h2 id="s-vote-h" className="s-sec-title">
                {t.todayHeading}
              </h2>
              {vote && <p className="s-sec-sub">{t.todaySub(vote.target_slot, fmtDay(vote.target_date))}</p>}
            </div>
            <CopyLink schoolId={data.school.school_id} />
          </div>
          {vote && <VoteRows vote={vote} reduce={reduce} />}
          <p className={empty && !stale ? 's-hint s-hint--empty' : 's-hint'}>{hint}</p>
        </section>

        <section className="s-people" aria-labelledby="s-people-h">
          <h2 id="s-people-h" className="s-sec-title">
            {t.peopleHeading}
          </h2>
          <dl className="s-stats">
            <Stat value={players.voted_today} label={t.votedToday} of={ofPlayers} />
            <Stat value={players.voted_last_5_days} label={t.votedLast5} of={ofPlayers} />
            <Stat
              value={players.total}
              label={t.playersTotal}
              of={students ? t.ofStudents(fmtInt(students)) : null}
            />
          </dl>
        </section>

        <section className="s-guesses" aria-labelledby="s-guess-h">
          <h2 id="s-guess-h" className="s-sec-title">
            {t.guessesHeading}
          </h2>
          {guesses && guesses.total > 0 ? (
            <>
              <p className="s-sec-sub">{t.guessesSub(fmtDay(guesses.target_date))}</p>
              <ul className="s-list">
                {guesses.items.map((g) => (
                  <li key={g.item_id} className="s-line">
                    <span className="s-line__name">{g.name}</span>
                    <span className="s-line__val num">{t.guesses(g.guesses)}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="s-empty">{t.guessesEmpty}</p>
          )}
        </section>

        <section className="s-recent" aria-labelledby="s-recent-h">
          <h2 id="s-recent-h" className="s-sec-title">
            {t.recentHeading}
          </h2>
          {data.recent_votes.length > 0 ? (
            <ul className="s-list">
              {data.recent_votes.map((r) => (
                <li key={`${r.open_date}-${r.target_date}`} className="s-line">
                  <span className="s-line__main">
                    <span className="s-line__name">{r.winner.name}</span>
                    <span className="s-line__note">
                      {t.recentRow(fmtDay(r.open_date, shortDay), fmtDay(r.target_date, shortDay))}
                    </span>
                  </span>
                  <span className="s-line__val num">{t.recentVotes(r.winner.votes, r.total)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="s-empty">{t.recentEmpty}</p>
          )}
        </section>

        <section className="s-past" aria-labelledby="s-past-h">
          <h2 id="s-past-h" className="s-sec-title">
            {t.pastHeading}
          </h2>
          <p className="s-sec-sub">{t.pastSub}</p>
          {data.past_winners.length > 0 ? (
            <ul className="s-list">
              {data.past_winners.map((w) => (
                <li key={w.date} className="s-line">
                  <span className="s-line__main">
                    <span className="s-line__name">{w.name}</span>
                    <span className="s-line__note">{fmtDay(w.date, shortDay)}</span>
                  </span>
                  <span className="s-line__val num">{t.pastShare(Math.round(w.vote_share * 100))}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="s-empty">{t.pastEmpty}</p>
          )}
        </section>
      </div>
    </div>
  )
}
