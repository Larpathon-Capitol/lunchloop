// The call, as a card from the world: a loteria card (Americas), an omikuji fortune slip
// (East Asia) or a sealed tile postcard (Mediterranean). One DOM for all three; the look comes
// from callit.css. Blank until a pick, filled while choosing, and stamped with the world's seal
// once the call is locked.
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { callit } from '../../shared/copy/callit'
import { fmtDay } from '../../shared/format'
import { useKit } from '../../theme/registry'
import { useThemeId } from '../../theme/store'
import { FoodGlyph } from '../FoodGlyph'
import { popSpring } from '../springs'

interface Props {
  item_id: string | null
  name: string | null
  /** The day the call is for (YYYY-MM-DD). */
  date: string
  /** Show the world's seal on the card. */
  sealed: boolean
  /** Play the seal's landing (sound and squash). False for a call made on an earlier visit. */
  fresh?: boolean
  className?: string
}

/** Americas: the loteria star in the badge. */
function Star() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M10 1.8l2.3 5.6 6 .5-4.6 3.9 1.4 5.9L10 14.6l-5.1 3.1 1.4-5.9L1.7 7.9l6-.5Z" />
    </svg>
  )
}

export function CallCard({ item_id, name, date, sealed, fresh = false, className }: Props) {
  const world = useThemeId()
  const kit = useKit()
  const reduce = useReducedMotion()
  const words = callit.cards[world]
  const dayNum = Number(date.slice(8, 10))
  const short = fmtDay(date, { weekday: 'short', month: 'short', day: 'numeric' })
  const blank = !item_id

  return (
    <div
      className={`ct ct--${world}${blank ? ' ct--blank' : ''}${sealed ? ' ct--sealed' : ''}${className ? ` ${className}` : ''}`}
      role="img"
      aria-label={blank ? `${words.kind}, blank` : `${words.kind}: ${name}, ${short}${sealed ? `, ${words.seal.toLowerCase()}` : ''}`}
    >
      <motion.div
        className="ct__card"
        // The card gives a little under the seal as it lands.
        animate={sealed && fresh && !reduce ? { scale: [1, 1, 0.965, 1.015, 1] } : { scale: 1 }}
        transition={sealed && fresh && !reduce ? { duration: 0.62, times: [0, 0.3, 0.42, 0.66, 1], delay: 0.1 } : { duration: 0 }}
      >
        <div className="ct__top">
          {world === 'americas' && (
            <span className="ct__badge">
              <Star />
            </span>
          )}
          <span className="ct__toptext">{words.top}</span>
          {world === 'americas' && <span className="ct__num num">{dayNum}</span>}
        </div>

        <div className="ct__art">
          {world === 'asia' && (
            <span className="ct__grade" aria-hidden="true">
              大吉
            </span>
          )}
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={item_id ?? 'blank'}
              className="ct__glyph"
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.4, rotate: -20 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6, transition: { duration: 0.12 } }}
              transition={reduce ? { duration: 0.12 } : popSpring}
            >
              {item_id ? <FoodGlyph id={item_id} /> : <span className="ct__q">?</span>}
            </motion.span>
          </AnimatePresence>
        </div>

        <div className="ct__name">
          <span>{name ?? words.blank}</span>
        </div>
        <div className="ct__foot num">{short}</div>
        {world === 'medi' && <span className="ct__postmark num" aria-hidden="true">{short.split(', ')[1] ?? short}</span>}
      </motion.div>
      <span className="ct__seal">
        <kit.Seal visible={sealed} silent={!fresh} size={78} label={words.seal} />
      </span>
    </div>
  )
}
