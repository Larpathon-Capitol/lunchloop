// One pickable menu row: a toggle button (aria-pressed) with the food, plus an info
// button that opens the food sheet. Used by the spin ballot and by Called It, inside
// a role="group", so each row is a normal Tab stop with no arrow-key contract.
import { motion, useReducedMotion } from 'framer-motion'
import { copy } from '../shared/copy'
import { press } from '../shared/motion'
import { FoodGlyph } from './FoodGlyph'
import { popSpring } from './springs'

interface Props {
  item_id: string
  name: string
  on: boolean
  disabled?: boolean
  /** Spring the radio in, for when the reel lands. */
  popIn?: boolean
  onPick: () => void
  onInfo: () => void
}

export function ChoiceRow({ item_id, name, on, disabled, popIn, onPick, onInfo }: Props) {
  const reduce = useReducedMotion()
  return (
    <div className={on ? 'reel__row reel__row--on' : 'reel__row'}>
      <motion.button
        type="button"
        aria-pressed={on}
        className="reel__pick"
        onClick={onPick}
        disabled={disabled}
        whileTap={press}
      >
        <motion.span
          className="reel__radio"
          initial={reduce || !popIn ? false : { scale: 0 }}
          animate={{ scale: 1 }}
          transition={popSpring}
          aria-hidden="true"
        >
          {on && (
            <motion.svg viewBox="0 0 16 16" initial={reduce ? false : { scale: 0.4 }} animate={{ scale: 1 }} transition={popSpring}>
              <path d="m4 8.5 2.6 2.5L12 5.5" />
            </motion.svg>
          )}
        </motion.span>
        <FoodGlyph id={item_id} />
        <span className="reel__name">{name}</span>
      </motion.button>
      <button type="button" className="reel__info" onClick={onInfo} aria-label={copy.student.spin.info(name)}>
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="10" cy="10" r="7.5" />
          <path d="M10 9v5M10 6.2v.3" />
        </svg>
      </button>
    </div>
  )
}
