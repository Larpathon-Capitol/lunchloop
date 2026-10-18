// Stamps: a stamp book in four sections (streaks, packing, voting, calling it). Earned stamps
// are inked in the world's style and land with its motion; the rest are dashed ghosts filled
// from the bottom, each with a brush progress bar and "x of y" under it. A stamp earned since
// the last visit lands with the stamp sound and a burst of petals.
import { motion, useReducedMotion, type Variants } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { BrushProgress, burstPetals } from '../celebrate'
import { UmeInline } from '../mascot'
import { copy } from '../shared/copy'
import { stamps as t } from '../shared/copy/stamps'
import { sound } from '../shared/sound'
import { ErrorNotice } from '../shared/ui/Notice'
import { PanelSkeleton } from './VoteScreen'
import { useStudent } from './state'
import { GROUPS, stampsFor, type StampId, type StampView } from './stamps/catalog'
import { StampArt } from './stamps/StampArt'
import './stampbook.css'

// A hand never stamps perfectly square; each slot leans its own way.
const TILTS = [-4, 3, -2, 5, -3, 2, -5, 4, -1, 3, -3, 2]
const STAGGER = 0.07

const pageMotion: Variants = { hidden: {}, shown: { transition: { staggerChildren: 0.04 } } }
const cellMotion: Variants = {
  hidden: { opacity: 0, y: 8 },
  shown: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 380, damping: 26 } },
}
const cellMotionReduced: Variants = { hidden: { opacity: 0 }, shown: { opacity: 1, transition: { duration: 0.15 } } }

const seenKey = (device: string) => `lunchloop.stamps.seen.${device}`

/** Earned stamps this device hasn't seen in the book yet. Remembers them once shown. */
function useNewlyEarned(device: string, earned: readonly StampId[]) {
  const key = seenKey(device)
  const [fresh] = useState(() => {
    try {
      const seen = new Set<string>(JSON.parse(localStorage.getItem(key) ?? '[]'))
      return new Set(earned.filter((id) => !seen.has(id)))
    } catch {
      return new Set<StampId>()
    }
  })
  const list = earned.join(',')
  useEffect(() => {
    try {
      const seen = new Set<string>(JSON.parse(localStorage.getItem(key) ?? '[]'))
      for (const id of list.split(',')) if (id) seen.add(id)
      localStorage.setItem(key, JSON.stringify([...seen]))
    } catch {
      /* private mode: every visit just looks like a first one */
    }
  }, [key, list])
  return fresh
}

function StampCell({ stamp, index, delay, isNew }: { stamp: StampView; index: number; delay: number; isNew: boolean }) {
  const info = t.list[stamp.id]
  const reduce = useReducedMotion()
  return (
    <motion.li
      className={`sbook__stamp${stamp.earned ? ' is-earned' : ''}`}
      data-stamp={stamp.id}
      variants={reduce ? cellMotionReduced : cellMotion}
    >
      <span className="sbook__art">
        <StampArt
          shape={stamp.shape}
          label={info.seal}
          tone={stamp.tone}
          tilt={stamp.earned ? TILTS[index % TILTS.length] : 0}
          earned={stamp.earned}
          progress={stamp.have / stamp.goal}
          delay={delay}
        />
        {isNew && <span className="sbook__new">{t.newlyEarned}</span>}
      </span>
      <span className="sbook__text">
        <span className="sbook__name">{info.name}</span>
        {stamp.earned ? (
          <span className="sbook__state">{t.earned}</span>
        ) : (
          <>
            <span className="sbook__state num">{t.units[stamp.unit](stamp.have, stamp.goal)}</span>
            <BrushProgress className="sbook__brush" value={stamp.have / stamp.goal} height={11} color="var(--pink-4, #FF8FAB)" label={info.how} />
          </>
        )}
      </span>
    </motion.li>
  )
}

function StampBook({ list, device }: { list: StampView[]; device: string }) {
  const reduce = useReducedMotion()
  const earnedIds = useMemo(() => list.filter((s) => s.earned).map((s) => s.id), [list])
  const fresh = useNewlyEarned(device, earnedIds)
  const book = useRef<HTMLDivElement>(null)

  // Each earned stamp lands in turn, in book order.
  const delays = new Map<StampId, number>()
  earnedIds.forEach((id, i) => delays.set(id, 0.15 + i * STAGGER))

  // The newest stamp gets the sound and the petals, once, as it lands.
  const firstFresh = earnedIds.find((id) => fresh.has(id))
  useEffect(() => {
    if (!firstFresh) return
    const wait = reduce ? 0 : ((delays.get(firstFresh) ?? 0) + 0.15) * 1000
    const id = window.setTimeout(() => {
      sound.stamp()
      const el = book.current?.querySelector<HTMLElement>(`[data-stamp="${firstFresh}"] .sbook__art`)
      if (el) burstPetals(el, { count: 28 })
    }, wait)
    return () => window.clearTimeout(id)
    // Runs once per visit for the stamp that was new when the page opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstFresh])

  let index = 0
  return (
    <div className="sbook" ref={book}>
      <div className="sbook__summary">
        <p className="sbook__count num">{t.summary(earnedIds.length, list.length)}</p>
        <BrushProgress className="sbook__total" value={list.length ? earnedIds.length / list.length : 0} height={14} label={t.summaryProgress} />
      </div>
      {GROUPS.map((group) => {
        const items = list.filter((s) => s.group === group)
        if (!items.length) return null
        const got = items.filter((s) => s.earned).length
        return (
          <section key={group} className="sbook__group" aria-labelledby={`sbook-${group}`}>
            <header className="sbook__ghead">
              <h2 id={`sbook-${group}`} className="sbook__gtitle">
                {t.groups[group]}
              </h2>
              <span className="sbook__gcount num">{t.groupCount(got, items.length)}</span>
            </header>
            <motion.ul className="sbook__grid" variants={pageMotion} initial="hidden" animate="shown">
              {items.map((stamp) => (
                <StampCell key={stamp.id} stamp={stamp} index={index++} delay={delays.get(stamp.id) ?? 0} isNew={fresh.has(stamp.id)} />
              ))}
            </motion.ul>
          </section>
        )
      })}
      <p className="sbook__rule">{t.rule}</p>
    </div>
  )
}

export function StampsScreen() {
  const { me, meError, refreshMe } = useStudent()
  const list = useMemo(() => (me ? stampsFor(me) : []), [me])
  return (
    <div className="tabscreen tabscreen--stamps">
      <header className="tabscreen__head">
        <h1 className="tabscreen__title">{t.title}</h1>
        <UmeInline size={48} />
      </header>
      {meError && <ErrorNotice error={meError} onRetry={refreshMe} />}
      {!me && !meError && (
        <div role="status" aria-live="polite">
          <span className="visually-hidden">{copy.student.loading.badges}</span>
          <PanelSkeleton />
        </div>
      )}
      {me && <StampBook list={list} device={me.device} />}
    </div>
  )
}
