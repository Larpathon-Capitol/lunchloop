// Stamps: a page from a stamp book. Earned stamps carry the world's seal; the rest are a faint
// silhouette of that seal, filled from the bottom as far as the student has got, with progress
// under them. Streak and XP live in the HUD, so the page stops there.
import { motion, useReducedMotion, type Variants } from 'framer-motion'
import { BrushProgress } from '../celebrate'
import { UmeInline } from '../mascot'
import type { Me } from '../shared/api'
import { copy } from '../shared/copy'
import { ErrorNotice } from '../shared/ui/Notice'
import { useKit } from '../theme/registry'
import { useThemeId } from '../theme/store'
import type { ThemeId } from '../theme/types'
import { PanelSkeleton } from './VoteScreen'
import { useStudent } from './state'
import './stampbook.css'

const t = copy.student.stamps
type StampId = keyof typeof t.list
// The week streak is the headline stamp, so it is drawn largest.
const ORDER: readonly { id: StampId; size: number; tilt: number }[] = [
  { id: 'streak_7', size: 132, tilt: -4 },
  { id: 'streak_3', size: 96, tilt: 5 },
  { id: 'called_it_5', size: 104, tilt: -2 },
]

const pageMotion: Variants = { hidden: {}, shown: { transition: { staggerChildren: 0.06 } } }
const stampMotion: Variants = {
  hidden: { opacity: 0, scale: 0.7, y: 10 },
  shown: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 380, damping: 22 } },
}
const stampMotionReduced: Variants = {
  hidden: { opacity: 0 },
  shown: { opacity: 1, transition: { duration: 0.15 } },
}

/** A rounded starburst like the block party sticker, n points between radius r0 and r1. */
function burst(n: number, r0: number, r1: number) {
  let d = ''
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2
    const r = i % 2 ? r0 : r1
    d += `${i ? 'L' : 'M'}${(50 + Math.cos(a) * r).toFixed(2)} ${(50 + Math.sin(a) * r).toFixed(2)}`
  }
  return `${d}Z`
}

/** The courtyard tile medallion: an eight-point star, two squares with one turned 45deg. */
function star(R: number) {
  const r = R * 0.7654
  let d = ''
  for (let i = 0; i < 16; i++) {
    const a = ((i * 22.5 - 90) * Math.PI) / 180
    const k = i % 2 ? r : R
    d += `${i ? 'L' : 'M'}${(50 + Math.cos(a) * k).toFixed(2)} ${(50 + Math.sin(a) * k).toFixed(2)}`
  }
  return `${d}Z`
}

// Each world's seal outline, in a 100 by 100 box: the sticker, the hanko and the tile star.
const OUTLINE: Record<ThemeId, { outer: string; inner: string }> = {
  americas: { outer: burst(14, 42, 48), inner: burst(14, 36, 42) },
  asia: { outer: 'M15 5h70a10 10 0 0 1 10 10v70a10 10 0 0 1-10 10H15A10 10 0 0 1 5 85V15A10 10 0 0 1 15 5Z', inner: 'M17 11h66a6 6 0 0 1 6 6v66a6 6 0 0 1-6 6H17a6 6 0 0 1-6-6V17a6 6 0 0 1 6-6Z' },
  medi: { outer: star(47), inner: star(40) },
}

/**
 * An unearned stamp: the world's seal as a faint silhouette, filled from the bottom by `progress`
 * (0 to 1) so the page reads as a collection to fill. Decorative; the caption under it says the same.
 */
function Silhouette({ size, label, progress }: { size: number; label: string; progress: number }) {
  const world = useThemeId()
  const reduce = useReducedMotion()
  const clip = `sbook-clip-${world}-${label.replace(/\W+/g, '')}`
  const { outer, inner } = OUTLINE[world]
  const level = 100 - Math.max(0, Math.min(1, progress)) * 100
  return (
    <span className="sbook__ghost" style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 100 100">
        <defs>
          <clipPath id={clip}>
            <path d={outer} />
          </clipPath>
        </defs>
        <path d={outer} className="sbook__ghost-base" />
        {progress > 0 && (
          <motion.rect
            x="0"
            width="100"
            height="100"
            className="sbook__ghost-fill"
            clipPath={`url(#${clip})`}
            // attrY moves the SVG attribute; a plain y would be a CSS pixel transform.
            initial={reduce ? false : { attrY: 100 }}
            animate={{ attrY: level }}
            transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 120, damping: 20, delay: 0.2 }}
          />
        )}
        <path d={inner} className="sbook__ghost-line" />
      </svg>
      <span className="sbook__ghost-label">{label}</span>
    </span>
  )
}

/** How far along an unearned stamp is, 0 to 1. */
function progressOf(me: Me, days?: number, calls?: number) {
  if (days) return Math.min(me.streak, days) / days
  if (calls && typeof me.correct_calls === 'number') return Math.max(0, Math.min(me.correct_calls, calls)) / calls
  return 0
}

/** What sits under a stamp's name: earned, days so far, calls so far, or nothing. */
function Progress({ me, earned, days, calls }: { me: Me; earned: boolean; days?: number; calls?: number }) {
  if (earned) return <span className="sbook__state">{t.earned}</span>
  if (days) return <span className="sbook__state num">{t.daysOf(Math.min(me.streak, days), days)}</span>
  if (calls && typeof me.correct_calls === 'number') {
    const n = Math.max(0, Math.min(me.correct_calls, calls))
    return (
      <>
        <span className="sbook__state num">{t.callsOf(n, calls)}</span>
        <BrushProgress className="sbook__brush" value={n / calls} height={12} color="var(--pink-4, #FF8FAB)" label={t.callsProgress} />
      </>
    )
  }
  return null
}

export function StampsScreen() {
  const { me, meError, refreshMe } = useStudent()
  const { Seal } = useKit()
  const reduce = useReducedMotion()
  return (
    <div className="tabscreen">
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
      {me && (
        <div className="sbook">
          <motion.ul className="sbook__page" variants={pageMotion} initial="hidden" animate="shown">
            {ORDER.map(({ id, size, tilt }) => {
              const earned = me.badges.includes(id)
              const info = t.list[id]
              return (
                <motion.li key={id} className={`sbook__stamp sbook__stamp--${id}${earned ? ' is-earned' : ''}`} variants={reduce ? stampMotionReduced : stampMotion}>
                  <span className="sbook__art" style={{ width: size, height: size, transform: `rotate(${tilt}deg)` }}>
                    {earned ? (
                      <Seal visible silent size={size} label={info.seal} />
                    ) : (
                      <Silhouette size={size} label={info.seal} progress={progressOf(me, info.days, info.calls)} />
                    )}
                  </span>
                  <span className="sbook__text">
                    <span className="sbook__name">{info.name}</span>
                    <Progress me={me} earned={earned} days={info.days} calls={info.calls} />
                  </span>
                </motion.li>
              )
            })}
          </motion.ul>
          <p className="sbook__rule">{t.rule}</p>
        </div>
      )}
    </div>
  )
}
