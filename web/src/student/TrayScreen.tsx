// The core loop: pack tomorrow's tray. One pick or skip per food group, then pack it,
// get stamped, and see what everyone else packed.
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { api, ApiError, type Component, type Tray, type TrayPicks } from '../shared/api'
import { BrushProgress, isStreakMilestone, useCelebrate } from '../celebrate'
import { UmeInline, lines, pickLine, ume } from '../mascot'
import { copy } from '../shared/copy'
import { fmtLongDay } from '../shared/format'
import { Check, Skip, foodGroupIcon } from '../shared/icons'
import { press } from '../shared/motion'
import { sound } from '../shared/sound'
import { ErrorNotice } from '../shared/ui/Notice'
import { useApi } from '../shared/useApi'
import { useKit } from '../theme/registry'
import { TraySlot, trayEvents, trayStore, useTrayLanded } from '../tray/store'
import { flyToTray } from './flyToTray'
import { GLAZE, groupName } from './groups'
import { PickerSheet } from './PickerSheet'
import { NeedsButton } from './NeedsSheet'
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

/**
 * True once the 3D tray has settled into this screen's slot after the hero glide, so the
 * columns beside it can fade in without drawing over a tray that is still flying.
 * Falls back to showing everything after 2.5s in case the stage never reports.
 */
function useLandedGate(): boolean {
  const landed = useTrayLanded()
  const [late, setLate] = useState(false)
  useEffect(() => {
    const id = window.setTimeout(() => setLate(true), 2500)
    return () => window.clearTimeout(id)
  }, [])
  return landed || late
}

export function TrayScreen() {
  const { tray, reloadTray } = useStudent()
  const [meter, reloadMeter] = useApi(() => api.meter(), [])
  const shown = useLandedGate()

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
    <div className={shown ? 'traytab' : 'traytab traytab--waiting'}>
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

/** A small chevron: this group still needs a choice. */
function Chevron() {
  return (
    <svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M9.5 6.5 15 12l-5.5 5.5" />
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
              <span className="skel chip__icon" />
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
  const { Seal, Corner } = useKit()
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
  // The next group still to decide: the dock's button opens it.
  const next = packed ? null : (groups.find((g) => picks[g.component] === undefined)?.component ?? null)
  // The soft pill rests on the open group, or on the next one still to decide.
  const pillOn = packed ? null : (open ?? next)

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
    // Where the pick was tapped: the sheet's button if it still has focus, else the chip.
    const active = document.activeElement
    const fromEl = active instanceof HTMLElement && active.closest('[role="dialog"]') ? active : document.querySelector<HTMLElement>(`[data-chip="${component}"]`)
    if (item_id && fromEl) void flyToTray(fromEl.getBoundingClientRect(), component, GLAZE[component])
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
        <div className="pack__titles">
          <h1 className="pack__title">{packed ? t.headingPacked : t.heading}</h1>
          <p className="pack__day">{t.forDay(fmtLongDay(data.target_date))}</p>
        </div>
        <NeedsButton className="pack__needs" />
        <Corner className="pack__plum" />
      </header>

      <div className="pack__stage" ref={stageRef}>
        <TraySlot className="pack__slot" />
        {packed && revealed && (
          <span className="pack__seal">
            <Seal visible silent size={76} label={t.packedSeal} />
          </span>
        )}
      </div>

      <div className="pack__side">
        <LayoutGroup id="tray-chips">
        <ul className="chips" aria-label={t.chipsLabel}>
          {groups.map((g, i) => {
            const pick = picks[g.component]
            const item = typeof pick === 'string' ? g.items.find((i) => i.item_id === pick) : null
            const state = item ? item.name : pick === null ? t.skipped : t.choose
            const Icon = foodGroupIcon(g.component)
            const kind = item ? 'picked' : pick === null ? 'skipped' : 'open'
            const inner = (
              <>
                <motion.span
                  key={`${kind}-${pick ?? ''}`}
                  className="chip__icon"
                  initial={reduce || kind === 'open' || packed ? false : { scale: 0.6, rotate: -8 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={popSpring}
                >
                  {kind === 'skipped' ? <Skip /> : <Icon />}
                </motion.span>
                <span className="chip__text">
                  <span className="chip__group">{groupName(g.component)}</span>
                  <span className="chip__state">{state}</span>
                </span>
                <span className="chip__mark" aria-hidden="true">
                  {kind === 'picked' ? <Check /> : kind === 'open' && !packed ? <Chevron /> : null}
                </span>
              </>
            )
            return (
              <motion.li
                key={g.component}
                data-chip={g.component}
                initial={reduce ? false : { opacity: 0, y: 16, scale: 0.92 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 380, damping: 22, mass: 0.8, delay: 0.12 + i * 0.06 }}
                className={`chip chip--${kind}${open === g.component ? ' chip--focus' : ''}`}
                style={{ ['--glaze' as string]: GLAZE[g.component] }}
              >
                {pillOn === g.component && (
                  <motion.span
                    layoutId="chip-pill"
                    className="chip__pill"
                    aria-hidden="true"
                    transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 22, mass: 0.8 }}
                  />
                )}
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
              </motion.li>
            )
          })}
        </ul>
        </LayoutGroup>

        {/* Once packed the mascot sits under the food groups; before that it rides in the dock. */}
        {packed && <UmeInline size={56} className="pack__ume" />}

        {error && (
          <p className="pack__error" role="alert">
            {error}
          </p>
        )}

        {/* Progress and the one next step. On phones this dock sticks just above the tab bar. */}
        {!packed && (
          <div className="pack__dock">
            {/* The mascot, with its line above and the progress beside it. */}
            <UmeInline size={56} className="pack__ume">
              <div className="pack__progress">
                <BrushProgress value={groups.length ? decided / groups.length : 0} height={12} label={t.progress} />
                <p className="pack__count num">{t.progressText(decided, groups.length)}</p>
              </div>
            </UmeInline>
            <div className="pack__action">
              <AnimatePresence mode="popLayout" initial={false}>
                {ready ? (
                  <motion.button
                    key="pack"
                    type="button"
                    className="btn-press btn-press--big"
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
                ) : next ? (
                  <motion.button
                    key="next"
                    type="button"
                    className="btn-press btn-press--big pack__next"
                    onClick={() => {
                      sound.tap()
                      setOpen(next)
                    }}
                    aria-haspopup="dialog"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    whileTap={press}
                  >
                    {t.next(groupName(next))}
                    <Chevron />
                  </motion.button>
                ) : (
                  <motion.p key="hint" className="pack__hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    {t.needOne}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
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
