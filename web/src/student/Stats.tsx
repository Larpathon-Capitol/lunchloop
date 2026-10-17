import { motion, useReducedMotion } from 'framer-motion'
import { copy } from '../shared/copy'
import { CountUp } from './CountUp'
import { popSpring } from './springs'

const t = copy.student.stats

export function Flame({ lit = true }: { lit?: boolean }) {
  return (
    <svg className={lit ? 'flame' : 'flame flame--off'} viewBox="0 0 20 24" aria-hidden="true">
      <path d="M10 1.5c.6 3.6 3 5.4 4.9 7.9A8 8 0 0 1 10 22.5 7.6 7.6 0 0 1 2.5 15c0-3 1.6-5 3.4-6.5.2 2 1 3.2 2.3 3.9C8.3 8 8.9 4.6 10 1.5z" />
    </svg>
  )
}

/** Streak and XP, side by side. `bump` changes when a vote raises the streak, so the flame pops. */
export function Stats({ streak, xp, bump = 0 }: { streak: number; xp: number; bump?: number }) {
  const reduce = useReducedMotion()
  return (
    <div className="stats">
      <div className="stats__item">
        <motion.span
          key={bump}
          className="stats__flame"
          initial={reduce || !bump ? false : { scale: 0.6 }}
          animate={{ scale: 1 }}
          transition={popSpring}
        >
          <Flame lit={streak > 0} />
        </motion.span>
        <span className="stats__value">
          <CountUp id="streak" value={streak} />
        </span>
        <span className="stats__label">{t.streak}</span>
      </div>
      <div className="stats__item">
        <span className="stats__value">
          <CountUp id="xp" value={xp} />
        </span>
        <span className="stats__label">{t.xp}</span>
      </div>
    </div>
  )
}
