// The core loop: pack tomorrow's tray. One pick or skip per food group, then pack it,
// get stamped, and see what everyone else packed.
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { api, ApiError, type Component, type Tray, type TrayPicks } from '../shared/api'
import { BrushProgress, HankoStamp, isStreakMilestone, useCelebrate } from '../celebrate'
import { UmeInline, lines, pickLine, ume } from '../mascot'
import { copy } from '../shared/copy'
import { fmtLongDay } from '../shared/format'
import { Skip, foodGroupIcon } from '../shared/icons'
import { PlumSprig } from '../shared/art/PlumSprig'
import { press } from '../shared/motion'
import { sound } from '../shared/sound'
import { ErrorNotice } from '../shared/ui/Notice'
import { useApi } from '../shared/useApi'
import { TraySlot, trayEvents, trayStore } from '../tray/store'
import { GLAZE, groupName } from './groups'
import { PickerSheet } from './PickerSheet'
import { Quests } from './Quests'
import { Reveal } from './Reveal'
import { popSpring } from './springs'
import { useStudent } from './state'
import { WasteMeter } from './WasteMeter'

const t = copy.student.tray

/** Server messages are lowercase fragments; show them as a sentence. */
function sentence(msg: string) {
  const s = msg.trim()
  if (!s) return t.failed
  return `${s[0].toUpperCase()}${s.slice(1)}${/[.!?]$/.test(s) ? '' : '.'}`
}

export function TrayScreen() {
  const { tray, reloadTray } = useStudent()
  const [meter, reloadMeter] = useApi(() => api.meter(), [])

  let body
  if (tray.state === 'loading') body = <TraySkeleton />
  else if (tray.state === 'error' && tray.error.status === 404) body = <NoMenu />
  else if (tray.state === 'error')
    body = (
      <div className="screen-pad">
        <ErrorNotice error={tray.error} onRetry={reloadTray} />
      </div>
    )
  else body = <Packing key={tray.data.open_date} data={tray.data} />

  return (
    <div className="traytab">
      {body}
      {meter.state === 'error' && meter.error.status !== 0 && <ErrorNotice error={meter.error} onRetry={reloadMeter} />}
      {meter.state === 'ready' && <WasteMeter meter={meter.data} />}
    </div>
  )
}

function NoMenu() {
  return (
    <section className="empty-state">
      <EmptyTray />
      <p className="empty-state__text">{t.noMenu}</p>
    </section>
  )
}

/** A quiet line drawing of an empty tray, for the no-menu state. */
function EmptyTray() {
  return (
    <svg className="empty-tray" viewBox="0 0 160 100" aria-hidden="true">
      <rect x="4" y="6" width="152" height="88" rx="12" />
      <rect x="14" y="16" width="64" height="40" rx="7" />
      <rect x="84" y="16" width="62" height="40" rx="7" />
      <rect x="14" y="62" width="40" height="24" rx="6" />
      <rect x="60" y="62" width="40" height="24" rx="6" />
      <rect x="106" y="62" width="40" height="24" rx="6" />
    </svg>
  )
}

function TraySkeleton() {
  useEffect(() => {
    ume.react('thinking')
    return () => ume.react('idle')
  }, [])
  return (
    <div className="pack pack--loading" role="status" aria-live="polite">
      <span className="visually-hidden">{t.loading}</span>
      <div className="pack__head" aria-hidden="true">
        <span className="skel skel--title" />
        <span className="skel skel--line" />
      </div>
      {/* The real slot, so the 3D tray lands where it will stay once the menu arrives. */}
      <div className="pack__stage" aria-hidden="true">
        <TraySlot className="pack__slot" />
      </div>
      <div className="pack__side" aria-hidden="true">
        <ul className="chips">
          {[0, 1, 2, 3, 4].map((i) => (
            <li key={i} className="chip chip--skel">
              <span className="skel skel--disc" />
              <span className="skel skel--word" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function Packing({ data }: { data: Tray }) {
  const { device, me, setMe, refreshMe, setTray, reloadTray, draft, setDraftPick, bumpHud } = useStudent()
  const reduce = useReducedMotion()
  const celebrate = useCelebrate()
  const [open, setOpen] = useState<Component | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [announce, setAnnounce] = useState('')
  // A tray that comes back already packed shows everything at once; a fresh pack waits for the stamp.
  const [revealed, setRevealed] = useState(!!data.picks)
  const stageRef = useRef<HTMLDivElement>(null)
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const packed = !!data.picks
  const picks: TrayPicks = data.picks ?? draft
  const groups = data.groups
  const decided = groups.filter((g) => picks[g.component] !== undefined).length
  const pickedCount = groups.filter((g) => typeof picks[g.component] === 'string').length
  const left = groups.length - decided
  const ready = !packed && left === 0 && pickedCount > 0
  const openGroup = open ? (groups.find((g) => g.component === open) ?? null) : null

  // The tray's own taps open the picker for that compartment.
  useEffect(
    () =>
      trayEvents.on((e) => {
        if (e.type !== 'compartment' || packed) return
        if (groups.some((g) => g.component === e.component)) setOpen(e.component)
      }),
    [groups, packed],
  )

  useEffect(() => {
    trayStore.set({ focus: open })
  }, [open])
  useEffect(() => () => trayStore.set({ focus: null }), [])

  const choose = (component: Component, item_id: string | null) => {
    const before = groups.filter((g) => picks[g.component] !== undefined && g.component !== component).length
    setDraftPick(component, item_id)
    setOpen(null)
    setError(null)
    const name = groupName(component)
    if (item_id) {
      sound.pluck(before)
      ume.react('happy', pickLine(lines.pick))
      const item = groups.find((g) => g.component === component)?.items.find((i) => i.item_id === item_id)
      setAnnounce(t.picked(item?.name ?? name))
    } else {
      sound.skip()
      ume.react('idle', pickLine(lines.skip))
      setAnnounce(t.skippedAnnounce(name))
    }
  }

  const pack = async () => {
    if (!ready || busy) return
    const sent: TrayPicks = {}
    for (const g of groups) sent[g.component] = picks[g.component] ?? null
    setBusy(true)
    setError(null)
    sound.tok()
    try {
      const r = await api.postTray(device, sent)
      if (!alive.current) return
      const before = me
      // /api/me may still be loading: then assume the standard 10 XP and reload me after.
      const gained = before ? r.xp - before.xp : 10
      const milestone = isStreakMilestone(r.streak) && r.streak > (before?.streak ?? 0)
      setTray({ ...data, picks: sent, tally: r.tally })
      trayStore.set({ phase: 'packed', picks: sent, focus: null })
      setAnnounce(t.packedAnnounce(gained > 0 ? gained : null, r.streak))
      ume.react('excited', pickLine(milestone ? lines.milestone : lines.trayPacked))
      await celebrate.packed({
        anchorEl: stageRef.current,
        streak: r.streak,
        xpGained: gained,
        isMilestone: milestone,
        onStep: (step) => {
          if (step === 'xp' && before) setMe({ ...before, xp: r.xp })
          if (step === 'streak') {
            if (before) setMe({ ...before, xp: r.xp, streak: r.streak, packed_today: true })
            else void refreshMe()
            bumpHud()
          }
        },
      })
      if (!alive.current) return
      setRevealed(true)
      void refreshMe()
    } catch (e) {
      if (!alive.current) return
      const err = e instanceof ApiError ? e : new ApiError(0, String(e))
      if (err.status === 409) {
        setError(t.already)
        setRevealed(true)
        reloadTray()
        void refreshMe()
      } else if (err.status === 400) setError(sentence(err.message))
      else if (err.status === 0) setError(t.offline)
      else setError(t.failed)
    } finally {
      if (alive.current) setBusy(false)
    }
  }

  return (
    <div className={packed ? 'pack pack--packed' : 'pack'}>
      <header className="pack__head">
        <h1 className="pack__title">{packed ? t.headingPacked : t.heading}</h1>
        <p className="pack__day">{t.forDay(fmtLongDay(data.target_date))}</p>
        <PlumSprig variant="corner" className="pack__plum" />
      </header>

      <div className="pack__stage" ref={stageRef}>
        <TraySlot className="pack__slot" />
        {packed && revealed && (
          <span className="pack__seal">
            <HankoStamp visible silent size={76} label={t.packedSeal} />
          </span>
        )}
      </div>

      <div className="pack__side">
        <ul className="chips" aria-label={t.chipsLabel}>
          {groups.map((g) => {
            const pick = picks[g.component]
            const item = typeof pick === 'string' ? g.items.find((i) => i.item_id === pick) : null
            const state = item ? item.name : pick === null ? t.skipped : t.choose
            const Icon = foodGroupIcon(g.component)
            const kind = item ? 'picked' : pick === null ? 'skipped' : 'open'
            const inner = (
              <>
                <motion.span
                  key={`${kind}-${pick ?? ''}`}
                  className="chip__disc"
                  style={kind === 'picked' ? { background: GLAZE[g.component] } : { color: GLAZE[g.component] }}
                  initial={reduce || kind === 'open' || packed ? false : { scale: 0.6 }}
                  animate={{ scale: 1 }}
                  transition={popSpring}
                >
                  {kind === 'skipped' ? <Skip /> : <Icon />}
                </motion.span>
                <span className="chip__text">
                  <span className="chip__group">{groupName(g.component)}</span>
                  <span className="chip__state">{state}</span>
                </span>
              </>
            )
            return (
              <li
                key={g.component}
                className={`chip chip--${kind}${open === g.component ? ' chip--focus' : ''}`}
                style={{ ['--glaze' as string]: GLAZE[g.component] }}
              >
                {packed ? (
                  <span className="chip__body">{inner}</span>
                ) : (
                  <motion.button
                    type="button"
                    className="chip__body"
                    onClick={() => {
                      sound.tap()
                      setOpen(g.component)
                    }}
                    aria-label={t.chipLabel(groupName(g.component), state)}
                    aria-haspopup="dialog"
                    whileTap={press}
                  >
                    {inner}
                  </motion.button>
                )}
              </li>
            )
          })}
        </ul>

        {/* Ume sits in the layout here, beside the progress line, with room above it for a line. */}
        <UmeInline size={56} className="pack__ume">
          {!packed && (
            <div className="pack__progress">
              <BrushProgress value={groups.length ? decided / groups.length : 0} height={16} label={t.progress} />
              <p className="pack__count num">{t.progressText(decided, groups.length)}</p>
            </div>
          )}
        </UmeInline>

        {error && (
          <p className="pack__error" role="alert">
            {error}
          </p>
        )}

        {!packed && (
          <div className="pack__action">
            <AnimatePresence mode="popLayout" initial={false}>
              {ready ? (
                <motion.button
                  key="pack"
                  type="button"
                  className="btn-shu btn-shu--big"
                  onClick={pack}
                  disabled={busy}
                  initial={reduce ? { opacity: 0 } : { scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={reduce ? { duration: 0.12 } : popSpring}
                  whileTap={press}
                >
                  {busy ? t.packing : t.pack}
                </motion.button>
              ) : (
                <motion.p key="hint" className="pack__hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  {left > 0 ? t.left(left) : t.needOne}
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {packed && revealed && data.tally && (
        <div className="pack__after">
          <Reveal tally={data.tally} picks={picks} />
          <Quests />
        </div>
      )}

      <p className="visually-hidden" role="status">
        {announce}
      </p>

      <PickerSheet group={openGroup} current={open ? picks[open] : undefined} onPick={choose} onClose={() => setOpen(null)} />
    </div>
  )
}
