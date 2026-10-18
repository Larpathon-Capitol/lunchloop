// Vote: spin the reel through every entree, land on four for a future menu day, then vote for one.
import { motion, useReducedMotion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { BrushProgress, XpToast, burstPetals } from '../celebrate'
import { UmeInline, lines, pickLine, ume } from '../mascot'
import { api, ApiError, type Spin, type SpinOption, type VoteResult } from '../shared/api'
import { copy } from '../shared/copy'
import { sortByNeeds, useNeeds } from '../shared/needs'
import { fmtDay } from '../shared/format'
import { Check } from '../shared/icons'
import { press } from '../shared/motion'
import { sound } from '../shared/sound'
import { useGameBase } from '../shared/studentSchool'
import { ErrorNotice } from '../shared/ui/Notice'
import { useApi } from '../shared/useApi'
import { FoodGlyph } from './FoodGlyph'
import { Reel } from './Reel'
import { isTomorrow, schoolDaysBetween } from './days'
import { NeedsButton } from './NeedsSheet'
import { fade, popSpring } from './springs'
import { readStoredVote, useStudent, type StoredVote } from './state'
import './vote.css'

const t = copy.student
type Phase = 'idle' | 'spinning' | 'landed' | 'voting' | 'voted' | 'done'

export function VoteScreen() {
  const { device, me, setMe, refreshMe, calendar, catalog, addToCatalog, showFood, lastVote, rememberVote, bumpHud } = useStudent()
  const [spin, reloadSpin] = useApi(() => api.spin(device), [device])
  const [announce, setAnnounce] = useState('')

  const last = me?.last_guess
  const guessed = !!(last && calendar?.next && last.target_date === calendar.next.date)
  const nextLabel = guessed ? t.voted.seeGuess : t.voted.next

  // A vote from earlier this session shows its tally again, but only if the server agrees we voted.
  const spinData = spin.state === 'ready' ? spin.data : null
  const stored = useMemo(() => {
    if (!spinData?.already_voted) return null
    if (lastVote && lastVote.date === spinData.date && lastVote.device === device) return lastVote
    return readStoredVote(spinData.date, device)
  }, [spinData, lastVote, device])

  const onVoted = (r: VoteResult, chosen: SpinOption, date: string) => {
    // /api/me may still be loading: then assume the standard 10 XP; refreshMe() below catches up.
    const gained = me ? r.xp - me.xp : 10
    const beforeStreak = me?.streak ?? 0
    rememberVote({ date, device, chosen, result: r, gained })
    if (me) setMe({ ...me, streak: r.streak, xp: r.xp, voted_today: true })
    if (r.streak > beforeStreak) bumpHud()
    setAnnounce(t.voted.announce(chosen.name, gained && gained > 0 ? gained : null))
    void refreshMe()
  }

  return (
    <div className="tabscreen">
      <header className="tabscreen__head">
        <h1 className="tabscreen__title">{t.tabs.vote}</h1>
        <NeedsButton className="tabscreen__needs" />
        <UmeInline size={48} />
      </header>

      {spin.state === 'loading' && <PanelSkeleton />}
      {spin.state === 'error' && spin.error.status === 404 && <NoVote />}
      {spin.state === 'error' && spin.error.status !== 404 && <ErrorNotice error={spin.error} onRetry={reloadSpin} />}
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
    </div>
  )
}

/** A shuffled copy (Fisher-Yates). */
function shuffle<T>(list: T[]): T[] {
  const out = list.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export function PanelSkeleton() {
  return (
    <div className="paper paper--skel" aria-hidden="true">
      <span className="skel skel--title" />
      <span className="skel skel--line" />
      <span className="skel skel--block" />
    </div>
  )
}

function CallItLink({ children }: { children: ReactNode }) {
  const { base, search } = useGameBase()
  return (
    <Link to={`${base}/call-it${search}`} className="btn-ink">
      {children}
    </Link>
  )
}

function NoVote() {
  return (
    <section className="paper">
      <h2 className="section-title">{t.spin.noVote}</h2>
      <p className="paper__lead">{t.spin.noVoteBody}</p>
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
  const [frozenPool, setFrozenPool] = useState<Spin['pool'] | null>(null)
  const needs = useNeeds()
  const voteRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const day = fmtDay(spin.target_date)
  const shortDay = fmtDay(spin.target_date, { weekday: 'short', month: 'short', day: 'numeric' })
  const when = t.spin.when(schoolDaysBetween(spin.date, spin.target_date), isTomorrow(spin.date, spin.target_date))

  // Learn food groups for the options (they're for a later menu day).
  useEffect(() => {
    addToCatalog(spin.options)
    api
      .prep(spin.target_date)
      .then((l) => addToCatalog(l.items))
      .catch(() => {})
  }, [spin, addToCatalog])

  // The reel shows every entree (spin.pool), shuffled fresh for each spin.
  const pool = frozenPool ?? spin.pool
  // Ballot options that fit the student's needs come first.
  const options = useMemo(() => sortByNeeds(spin.options, needs), [spin.options, needs])

  const startSpin = () => {
    if (phase !== 'idle') return
    sound.tap()
    setFrozenPool(shuffle(spin.pool.length > 1 ? spin.pool : spin.options))
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
      const row = panelRef.current?.querySelector<HTMLElement>('.choice--on') ?? voteRef.current
      if (row) burstPetals(row, { count: 28 })
      ume.react('happy', pickLine(lines.pick))
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
      <section className="paper" aria-labelledby="done-title">
        <span className="done-seal" aria-hidden="true">
          <Check />
        </span>
        <h2 id="done-title" className="section-title">
          {t.done.heading}
        </h2>
        <p className="paper__lead">{t.done.body(day)}</p>
        {error && <p className="paper__note">{error}</p>}
        <CallItLink>{nextLabel}</CallItLink>
      </section>
    )
  }

  const landed = phase === 'landed' || phase === 'voting'
  return (
    <section className="paper" aria-labelledby="spin-title" ref={panelRef}>
      <div className="vote-day">
        <h2 id="spin-title" className="section-title">
          {t.spin.heading(day)}
        </h2>
        <span className="vote-day__when">{when}</span>
      </div>
      <p className="paper__lead">{t.spin.lead}</p>

      <div className="lacquer">
        <Reel
          options={options}
          pool={pool}
          phase={landed ? 'landed' : phase === 'spinning' ? 'spinning' : 'idle'}
          selected={selected}
          disabled={phase === 'voting'}
          onLanded={() => setPhase((p) => (p === 'spinning' ? 'landed' : p))}
          onSelect={pick}
          onInfo={info}
        />
      </div>
      <p className="vote-served">{t.spin.served(shortDay)}</p>
      <p className="visually-hidden" aria-live="polite">
        {phase === 'spinning' ? t.spin.spinning : landed ? t.spin.landed(options.map((o) => o.name)) : ''}
      </p>

      {error && (
        <p className="paper__error" role="alert">
          {error}
        </p>
      )}

      {landed ? (
        <motion.div
          key="vote"
          className="paper__action"
          initial={reduce ? false : { scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={reduce ? fade : popSpring}
        >
          <motion.button
            ref={voteRef}
            type="button"
            className="btn-press btn-press--big"
            disabled={!chosen || phase === 'voting'}
            onClick={vote}
            whileTap={press}
          >
            {phase === 'voting' ? t.spin.voting : chosen ? t.spin.vote(chosen.name) : t.spin.pickFirst}
          </motion.button>
        </motion.div>
      ) : (
        <motion.button
          key="spin"
          type="button"
          className="btn-press btn-press--big"
          onClick={startSpin}
          aria-disabled={phase === 'spinning' || undefined}
          data-busy={phase === 'spinning' || undefined}
          whileTap={press}
        >
          {phase === 'spinning' ? t.spin.spinning : t.spin.button}
        </motion.button>
      )}
    </section>
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
  const xp = lastVote?.date === spin.date ? lastVote.gained : storedXp

  useEffect(() => {
    if (fresh) titleRef.current?.focus({ preventScroll: true })
  }, [fresh])

  return (
    <motion.section
      className="paper"
      aria-labelledby="voted-title"
      initial={still ? false : { opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={still ? fade : popSpring}
    >
      <div className="voted__top">
        <span className="done-seal" aria-hidden="true">
          <Check />
        </span>
        {fresh && xp !== null && xp > 0 && <XpToast amount={xp} className="voted__toast" />}
      </div>
      <h2 id="voted-title" className="section-title" tabIndex={-1} ref={titleRef}>
        {t.voted.heading}
      </h2>
      <p className="paper__lead">{t.voted.body(chosen.name, fmtDay(spin.target_date))}</p>

      <ul className="tally">
        {spin.options.map((o) => {
          const n = result.tally[o.item_id] ?? 0
          const mine = o.item_id === chosen.item_id
          const share = total ? n / total : 0
          return (
            <li className={mine ? 'tally__row tally__row--mine' : 'tally__row'} key={o.item_id}>
              <div className="tally__top">
                <span className="glyph-disc glyph-disc--small glyph-disc--entree">
                  <FoodGlyph id={o.item_id} />
                </span>
                <span className="tally__name">{o.name}</span>
                {mine && <span className="share__you">{t.voted.yours}</span>}
                <span className="tally__count num">{t.voted.votes(n)}</span>
              </div>
              <BrushProgress value={share} color={mine ? 'var(--shu)' : 'var(--g-entree)'} height={14} label={`${o.name}, ${t.voted.votes(n)}`} />
            </li>
          )
        })}
      </ul>
      <p className="paper__note num">{t.voted.total(total)}</p>
      <CallItLink>{nextLabel}</CallItLink>
    </motion.section>
  )
}
