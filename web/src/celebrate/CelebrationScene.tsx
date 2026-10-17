import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { celebrateCopy } from './copy'
import { Flame } from '../shared/icons'
import { useKit } from '../theme/registry'
import { NumberRoll } from './NumberRoll'
import { StreakMilestone } from './StreakMilestone'
import { XpToast } from './XpToast'
import './celebrate.css'

export interface SceneState {
  stamp: boolean
  xp: number | null
  /** The streak after this pack. Shown as the new value, so it always matches the header. */
  streak: number | null
  milestone: number | null
}

interface SceneProps {
  x: number
  y: number
  size: number
  state: SceneState
  onMilestoneClose: () => void
}

/** What celebratePacked draws: the seal, the XP token and the streak chip at a point, then the milestone overlay. */
export function CelebrationScene({ x, y, size, state, onMilestoneClose }: SceneProps) {
  const reduce = useReducedMotion()
  const { Seal } = useKit()
  return (
    <>
      <div className="celebrate-layer">
        <div className="celebrate-spot" style={{ left: x, top: y }}>
          <div style={{ position: 'absolute', left: -size / 2, top: -size / 2 }}>
            <Seal visible={state.stamp} size={size} />
          </div>
          {state.xp !== null && (
            <div style={{ position: 'absolute', left: size * 0.12, top: -size / 2 - 26 }}>
              <XpToast amount={state.xp} />
            </div>
          )}
          <div style={{ position: 'absolute', left: 0, top: size / 2 + 12, transform: 'translateX(-50%)' }}>
            <AnimatePresence>
              {state.streak !== null && (
                <motion.span
                  key="chip"
                  className="celebrate-streak"
                  initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.7 }}
                  animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, transition: { duration: 0.2 } }}
                  transition={{ type: 'spring', duration: 0.4, bounce: 0.35 }}
                  role="status"
                  aria-label={celebrateCopy.streakNow(state.streak)}
                >
                  <Flame width={16} height={16} className="celebrate-streak__flame" />
                  <NumberRoll value={state.streak} />
                  <span aria-hidden="true">{celebrateCopy.streakLabel}</span>
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
      {state.milestone !== null && <StreakMilestone streak={state.milestone} onClose={onMilestoneClose} />}
    </>
  )
}
