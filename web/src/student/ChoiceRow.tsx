// One pickable menu row: a toggle button (aria-pressed) with the food, plus an info
// button that opens the food sheet. Used by the vote reel and by Call it, inside
// a role="group", so each row is a normal Tab stop with no arrow-key contract.
import { motion, useReducedMotion } from 'framer-motion'
import { copy } from '../shared/copy'
import { Check, Info } from '../shared/icons'
import { press } from '../shared/motion'
import { FoodGlyph } from './FoodGlyph'
import { popSpring } from './springs'

interface Props {
  item_id: string
  name: string
  on: boolean
  disabled?: boolean
  /** Spring the row in, for when the reel lands. */
  popIn?: boolean
  onPick: () => void
  onInfo: () => void
}

export function ChoiceRow({ item_id, name, on, disabled, popIn, onPick, onInfo }: Props) {
  const reduce = useReducedMotion()
  return (
    <div className={on ? 'choice choice--on' : 'choice'}>
      <motion.button type="button" aria-pressed={on} className="choice__main" onClick={onPick} disabled={disabled} whileTap={press}>
        <motion.span
          className="glyph-disc glyph-disc--entree"
          initial={reduce || !popIn ? false : { scale: 0.5 }}
          animate={{ scale: 1 }}
          transition={popSpring}
          aria-hidden="true"
        >
          <FoodGlyph id={item_id} />
        </motion.span>
        <span className="choice__name">{name}</span>
        <span className="choice__mark" aria-hidden="true">
          {on && (
            <motion.span className="choice__check" initial={reduce ? false : { scale: 0.3, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={popSpring}>
              <Check />
            </motion.span>
          )}
        </span>
      </motion.button>
      <button type="button" className="icon-btn choice__info" onClick={onInfo} aria-label={copy.student.spin.info(name)}>
        <Info />
      </button>
    </div>
  )
}
