// One pickable menu row: a toggle button (aria-pressed) with the food, plus an info
// button that opens the food sheet. Used by the vote reel and by Call it, inside
// a role="group", so each row is a normal Tab stop with no arrow-key contract. When the
// food's facts are known the row also shows diet badges, the needs line and allergens.
import { motion, useReducedMotion } from 'framer-motion'
import { sparkBurst } from '../celebrate/burst'
import { copy } from '../shared/copy'
import { Check, Info } from '../shared/icons'
import { useConflict, type FoodFacts } from '../shared/needs'
import { press } from '../shared/motion'
import { FoodGlyph } from './FoodGlyph'
import { FoodMeta } from './FoodFacts'
import { resolveColor } from './flyToTray'
import { popSpring } from './springs'

interface Props {
  item_id: string
  name: string
  on: boolean
  disabled?: boolean
  /** Spring the row in, for when the reel lands. */
  popIn?: boolean
  /** Diet and allergen facts. Without them the row shows just the name. */
  facts?: FoodFacts
  onPick: () => void
  onInfo: () => void
}

export function ChoiceRow({ item_id, name, on, disabled, popIn, facts, onPick, onInfo }: Props) {
  const reduce = useReducedMotion()
  const conflict = useConflict(facts)
  return (
    <div className={`choice${on ? ' choice--on' : ''}${facts ? ' choice--facts' : ''}${conflict ? ' choice--miss' : ''}`}>
      <motion.button type="button" aria-pressed={on} className="choice__main" onClick={(e) => {
          // A little spark of food color off the disc when a row becomes the pick.
          if (!on) {
            const disc = e.currentTarget.querySelector('.glyph-disc')
            if (disc) sparkBurst(disc as HTMLElement, { colors: [resolveColor('var(--g-entree)'), resolveColor('var(--pink-4)', '#ff8fab')] })
          }
          onPick()
        }}
        disabled={disabled}
        whileTap={press}
      >
        <motion.span
          className="glyph-disc glyph-disc--entree"
          initial={reduce || !popIn ? false : { scale: 0.5 }}
          animate={{ scale: 1 }}
          transition={popSpring}
          aria-hidden="true"
        >
          <FoodGlyph id={item_id} />
        </motion.span>
        {facts ? (
          <span className="choice__text">
            <span className="choice__name">{name}</span>
            <FoodMeta food={facts} />
          </span>
        ) : (
          <span className="choice__name">{name}</span>
        )}
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
