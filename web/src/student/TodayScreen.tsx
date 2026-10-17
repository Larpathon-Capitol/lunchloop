// Home: streak and XP, the spin and vote, and the school waste meter. That's it.
import { motion, useReducedMotion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { api, ApiError, type Spin, type SpinOption, type VoteResult } from '../shared/api'
import { copy } from '../shared/copy'
import { fmtDay } from '../shared/format'
import { sound } from '../shared/sound'
import { ErrorNotice, Loading } from '../shared/ui/Notice'
import { SimulatedTag } from '../shared/ui/SimulatedTag'
import { LIVE_SCHOOL, activeStudentSchool, useGameBase } from '../shared/studentSchool'
import { useApi } from '../shared/useApi'
import { burstFrom } from './confetti'
import { FoodGlyph } from './FoodGlyph'
import { Reel } from './Reel'
import { readStoredVote, useStudent, type StoredVote } from './state'
import { Stats } from './Stats'
import { fillSpring, instant, popSpring } from './springs'
import { WasteMeter } from './WasteMeter'

const t = copy.student
type Phase = 'idle' | 'spinning' | 'landed' | 'voting' | 'voted' | 'done'
/** The streak sound and the flame pop land together, just after the vote sound. */
const STREAK_DELAY_MS = 450

export function TodayScreen() {
  const { device, me, meError, refreshMe, setMe, calendar, catalog, addToCatalog, showFood, lastVote, rememberVote } = useStudent()
  const [spin, reloadSpin] = useApi(() => api.spin(device), [device])
  const [meter, reloadMeter] = useApi(() => api.meter(), [])
  const [bump, setBump] = useState(0)
  const [announce, setAnnounce] = useState('')
  const streakTimer = useRef<number | undefined>(undefined)
  const today = calendar?.today ?? (spin.state === 'ready' ? spin.data.date : null)

  useEffect(() => () => window.clearTimeout(streakTimer.current), [])

  // When the server is down, say so once instead of three times.
  const spinError = spin.state === 'error' && spin.error.status !== 404 ? spin.error : null
  const meterError = meter.state === 'error' ? meter.error : null
  const offline = [meError, spinError, meterError].filter((e): e is ApiError => !!e && e.status === 0)
  const merged = offline.length >= 2
  const shows = (e: ApiError | null) => !!e && !(merged && e.status === 0)
  const retryAll = () => {
    if (meError) void refreshMe()
    if (spinError) reloadSpin()
    if (meterError) reloadMeter()
  }

  const last = me?.last_guess
  const guessed = !!(last && calendar?.next && last.target_date === calendar.next.date)
  const nextLabel = guessed ? t.voted.seeGuess : t.voted.next

  // A vote from earlier this session (or this tab) shows its tally again, but only if the server agrees we voted.
  const spinData = spin.state === 'ready' ? spin.data : null
  const stored = useMemo(() => {
    if (!spinData?.already_voted) return null
    if (lastVote && lastVote.date === spinData.date && lastVote.device === device) return lastVote
    return readStoredVote(spinData.date, device)
  }, [spinData, lastVote, device])

  const onVoted = (r: VoteResult, chosen: SpinOption, date: string) => {
    const gained = me ? r.xp - me.xp : null
    const beforeStreak = me?.streak ?? 0
    rememberVote({ date, device, chosen, result: r, gained })
    if (me) setMe({ ...me, streak: r.streak, xp: r.xp })
    setAnnounce(t.voted.announce(chosen.name, gained && gained > 0 ? gained : null))
    if (r.streak > beforeStreak) {
      window.clearTimeout(streakTimer.current)
      streakTimer.current = window.setTimeout(() => {
        setBump((b) => b + 1)
        sound.streak()
      }, STREAK_DELAY_MS)
    }
    void refreshMe()
  }

  return (
    <div className="screen">
      <header className="screen__head">
        <h1 className="screen__title">{today ? fmtDay(today) : t.tabs.today}</h1>
        <SimulatedTag live={activeStudentSchool() === LIVE_SCHOOL} />
      </header>

      {merged && <ErrorNotice error={offline[0]} onRetry={retryAll} />}

      {me ? (
        <Stats streak={me.streak} xp={me.xp} bump={bump} />
      ) : shows(meError) ? (
        <ErrorNotice error={meError!} onRetry={refreshMe} />
      ) : (
        !merged && <div className="stats stats--empty" aria-hidden="true" />
      )}

      {spin.state === 'loading' && <Loading label={t.loading.today} />}
      {spin.state === 'error' && spin.error.status === 404 && <NoVote />}
      {shows(spinError) && <ErrorNotice error={spinError!} onRetry={reloadSpin} />}
      {spinData &&
        (spinData.options.length === 0 ? (
          <NoVote />
        ) : (
          <SpinPanel
            key={spinData.date}
            spin={spinData}
            device={device}
            catalog={catalog}
            addToCatalog={addToCatalog}
            showFood={showFood}
            stored={stored}
            nextLabel={nextLabel}
            onVoted={onVoted}
            onAlreadyVoted={() => void refreshMe()}
          />
        ))}

      <p className="visually-hidden" role="status">
        {announce}
      </p>

      {meter.state === 'loading' && !merged && <Loading />}
      {shows(meterError) && <ErrorNotice error={meterError!} onRetry={reloadMeter} />}
      {meter.state === 'ready' && <WasteMeter meter={meter.data} />}
    </div>
  )
}

function CalledItLink({ children }: { children: ReactNode }) {
  const { base, search } = useGameBase()
  return (
    <Link to={`${base}/called-it${search}`} className="btn btn--quiet panel__cta">
      {children}
    </Link>
  )
}

function NoVote() {
  return (
    <section className="panel">
      <h2 className="section-title">{t.spin.noVote}</h2>
      <p className="panel__lead">{t.spin.noVoteBody}</p>
    </section>
  )
}

interface PanelProps {
  spin: Spin
  device: string
  catalog: ReturnType<typeof useStudent>['catalog']
  addToCatalog: ReturnType<typeof useStudent>['addToCatalog']
  showFood: ReturnType<typeof useStudent>['showFood']
  stored: StoredVote | null
  nextLabel: string
  onVoted: (r: VoteResult, chosen: SpinOption, date: string) => void
  onAlreadyVoted: () => void
}

function SpinPanel({ spin, device, catalog, addToCatalog, showFood, stored, nextLabel, onVoted, onAlreadyVoted }: PanelProps) {
  const reduce = useReducedMotion()
  const [phase, setPhase] = useState<Phase>(stored ? 'voted' : spin.already_voted ? 'done' : 'idle')
  const [selected, setSelected] = useState<string | null>(stored?.chosen.item_id ?? null)
  const [result, setResult] = useState<VoteResult | null>(stored?.result ?? null)
  const [fresh, setFresh] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [frozenPool, setFrozenPool] = useState<{ item_id: string; name: string }[] | null>(null)
  const voteRef = useRef<HTMLButtonElement>(null)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const day = fmtDay(spin.target_date)
  const slot = spin.target_slot

  // Learn food groups for the options (they're for a later menu day).
  useEffect(() => {
    addToCatalog(spin.options)
    api
      .prep(spin.target_date)
      .then((l) => addToCatalog(l.items))
      .catch(() => {})
  }, [spin, addToCatalog])

  // Reel filler comes from real entrees on the menu.
  const livePool = useMemo(() => {
    const entrees = Object.values(catalog).filter((i) => i.component === 'meat_alternate')
    return entrees.length > 2 ? entrees : spin.options
  }, [catalog, spin.options])
  const pool = frozenPool ?? livePool

  const startSpin = () => {
    if (phase !== 'idle') return
    sound.tap()
    setFrozenPool(livePool)
    setSelected(null)
    setError(null)
    setPhase('spinning')
  }

  const pick = (id: string) => {
    sound.tap()
    setSelected(id)
    setError(null)
  }

  const chosen = spin.options.find((o) => o.item_id === selected) ?? stored?.chosen

  const vote = async () => {
    if (!chosen || phase !== 'landed') return
    setPhase('voting')
    setError(null)
    try {
      const r = await api.vote(device, chosen.item_id)
      if (!alive.current) return
      sound.vote()
      burstFrom(voteRef.current, !!reduce)
      setResult(r)
      setFresh(true)
      setPhase('voted')
      onVoted(r, chosen, spin.date)
    } catch (e) {
      if (!alive.current) return
      const status = e instanceof ApiError ? e.status : 0
      if (status === 409) {
        setError(t.errors.alreadyVoted)
        setPhase('done')
        onAlreadyVoted()
      } else {
        setError(status === 400 ? t.errors.notOption : status === 404 ? t.errors.noVoting : t.errors.voteFailed)
        setPhase('landed')
        window.requestAnimationFrame(() => voteRef.current?.focus())
      }
    }
  }

  const info = (o: SpinOption) => showFood({ ...o, component: catalog[o.item_id]?.component })

  if (phase === 'voted' && result && chosen) {
    return <VotedPanel spin={spin} result={result} chosen={chosen} storedXp={stored?.gained ?? null} fresh={fresh} nextLabel={nextLabel} />
  }

  if (phase === 'done') {
    return (
      <section className="panel" aria-labelledby="done-title">
        <DoneMark />
        <h2 id="done-title" className="section-title">
          {t.done.heading}
        </h2>
        <p className="panel__lead">{t.done.body(slot, day)}</p>
        {error && <p className="panel__note">{error}</p>}
        <CalledItLink>{nextLabel}</CalledItLink>
      </section>
    )
  }

  const landed = phase === 'landed' || phase === 'voting'
  return (
    <section className="panel" aria-labelledby="spin-title">
      <h2 id="spin-title" className="section-title">
        {t.spin.heading(slot, day)}
      </h2>
      <p className="panel__lead">{t.spin.lead}</p>

      <Reel
        options={spin.options}
        pool={pool}
        phase={landed ? 'landed' : phase === 'spinning' ? 'spinning' : 'idle'}
        selected={selected}
        disabled={phase === 'voting'}
        onLanded={() => setPhase((p) => (p === 'spinning' ? 'landed' : p))}
        onSelect={pick}
        onInfo={info}
      />
      <p className="visually-hidden" aria-live="polite">
        {phase === 'spinning' ? t.spin.spinning : landed ? t.spin.landed(spin.options.map((o) => o.name)) : ''}
      </p>

      {error && (
        <p className="panel__error" role="alert">
          {error}
        </p>
      )}

      {landed ? (
        <motion.div
          key="vote"
          className="panel__action"
          initial={reduce ? false : { scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={reduce ? instant : popSpring}
        >
          <button
            ref={voteRef}
            type="button"
            className="btn btn--primary btn--big"
            disabled={!chosen || phase === 'voting'}
            onClick={vote}
          >
            {phase === 'voting' ? t.spin.voting : chosen ? t.spin.vote(chosen.name) : t.spin.pickFirst}
          </button>
        </motion.div>
      ) : (
        <button
          key="spin"
          type="button"
          className="btn btn--primary btn--big"
          onClick={startSpin}
          aria-disabled={phase === 'spinning' || undefined}
          data-busy={phase === 'spinning' || undefined}
        >
          {phase === 'spinning' ? t.spin.spinning : t.spin.button}
        </button>
      )}
    </section>
  )
}

function DoneMark() {
  return (
    <svg className="done-mark" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="m7.5 12.5 3 3 6-6.5" />
    </svg>
  )
}

interface VotedProps {
  spin: Spin
  result: VoteResult
  chosen: SpinOption
  /** XP the vote added, as saved with a restored vote. */
  storedXp: number | null
  /** True right after voting: animate in and take focus. False when coming back to the tab. */
  fresh: boolean
  nextLabel: string
}

function VotedPanel({ spin, result, chosen, storedXp, fresh, nextLabel }: VotedProps) {
  const reduce = useReducedMotion()
  const { lastVote } = useStudent()
  const titleRef = useRef<HTMLHeadingElement>(null)
  const still = reduce || !fresh
  const total = Object.values(result.tally).reduce((a, b) => a + b, 0)
  // A fresh vote is saved to shared state by the parent before this renders.
  const xp = lastVote?.date === spin.date ? lastVote.gained : storedXp

  useEffect(() => {
    if (fresh) titleRef.current?.focus({ preventScroll: true })
  }, [fresh])

  return (
    <motion.section
      className="panel"
      aria-labelledby="voted-title"
      initial={still ? false : { opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={still ? instant : popSpring}
    >
      <div className="voted__mark">
        <DoneMark />
        {xp !== null && xp > 0 && <span className="voted__xp num">{t.voted.xp(xp)}</span>}
      </div>
      <h2 id="voted-title" className="section-title" tabIndex={-1} ref={titleRef}>
        {t.voted.heading}
      </h2>
      <p className="panel__lead">{t.voted.body(chosen.name, spin.target_slot, fmtDay(spin.target_date))}</p>

      <ul className="tally">
        {spin.options.map((o, i) => {
          const n = result.tally[o.item_id] ?? 0
          const mine = o.item_id === chosen.item_id
          const share = total ? n / total : 0
          return (
            <li className="tally__row" key={o.item_id}>
              <div className="tally__top">
                <FoodGlyph id={o.item_id} />
                <span className="tally__name">{o.name}</span>
                {mine && <span className="tally__mine">{t.voted.yours}</span>}
                <span className="tally__count num">{t.voted.votes(n)}</span>
              </div>
              <div className="tally__track">
                <motion.span
                  className={mine ? 'tally__bar tally__bar--mine' : 'tally__bar'}
                  initial={still ? false : { scaleX: 0 }}
                  animate={{ scaleX: share }}
                  style={still ? { scaleX: share } : undefined}
                  transition={still ? instant : { ...fillSpring, delay: 0.08 * i }}
                />
              </div>
            </li>
          )
        })}
      </ul>
      <p className="panel__note num">{t.voted.total(total)}</p>
      <CalledItLink>{nextLabel}</CalledItLink>
    </motion.section>
  )
}
