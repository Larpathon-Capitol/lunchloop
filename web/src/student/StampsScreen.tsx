// Stamps: a page from a stamp book. Earned stamps carry the world's seal; the rest are a faint
// pencil outline, with progress under them. Streak and XP live in the HUD, so the page stops there.
import { motion, useReducedMotion, type Variants } from 'framer-motion'
import { BrushProgress } from '../celebrate'
import { UmeInline } from '../mascot'
import type { Me } from '../shared/api'
import { copy } from '../shared/copy'
import { ErrorNotice } from '../shared/ui/Notice'
import { useKit } from '../theme/registry'
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

function Pencil({ size, label }: { size: number; label: string }) {
  return (
    <span className="sbook__pencil" style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 100 100">
        <rect x="6" y="6" width="88" height="88" rx="5" />
        <rect x="12" y="12" width="76" height="76" rx="2" />
      </svg>
      <span className="sbook__pencil-label">{label}</span>
    </span>
  )
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
                    {earned ? <Seal visible silent size={size} label={info.seal} /> : <Pencil size={size} label={info.seal} />}
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
