// "My needs": a button that opens a sheet of diet and allergy toggles. Each toggle saves
// right away (shared/needs.ts); the mascot says a short line when the sheet closes with changes.
import { motion } from 'framer-motion'
import { useRef, useState } from 'react'
import { ume } from '../mascot'
import type { Allergen } from '../shared/api'
import { copy } from '../shared/copy'
import { allergenName } from '../shared/format'
import { Check, Needs as NeedsIcon } from '../shared/icons'
import { press } from '../shared/motion'
import { ALLERGENS, DIET_NEEDS, needsCount, needsStore, useNeeds, type DietNeed } from '../shared/needs'
import { sound } from '../shared/sound'
import { Sheet } from './Sheet'

const t = copy.student.needs

function Toggle({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <motion.button type="button" className="need" aria-pressed={on} onClick={onClick} whileTap={press}>
      <span className="need__box" aria-hidden="true">
        {on && <Check />}
      </span>
      {label}
    </motion.button>
  )
}

function Body({ onDone }: { onDone: () => void }) {
  const needs = useNeeds()
  const flip = (fn: () => void) => () => {
    sound.tap()
    fn()
  }
  return (
    <div className="needs">
      <p className="needs__lead">{t.lead}</p>
      <fieldset className="needs__group">
        <legend className="needs__legend">{t.dietHeading}</legend>
        <div className="needs__grid">
          {DIET_NEEDS.map((d: DietNeed) => (
            <Toggle key={d} on={needs.diet.includes(d)} label={t.options[d]} onClick={flip(() => needsStore.toggleDiet(d))} />
          ))}
        </div>
      </fieldset>
      <fieldset className="needs__group">
        <legend className="needs__legend">{t.allergyHeading}</legend>
        <div className="needs__grid">
          {ALLERGENS.map((a: Allergen) => (
            <Toggle key={a} on={needs.allergies.includes(a)} label={allergenName(a)} onClick={flip(() => needsStore.toggleAllergy(a))} />
          ))}
        </div>
      </fieldset>
      <p className="needs__note">{t.note}</p>
      <p className="needs__note">{t.saved}</p>
      <div className="needs__actions">
        <button type="button" className="btn-ink needs__clear" onClick={flip(() => needsStore.clear())} disabled={!needsCount(needs)}>
          {t.clear}
        </button>
        <motion.button type="button" className="btn-press" onClick={onDone} whileTap={press}>
          {t.done}
        </motion.button>
      </div>
    </div>
  )
}

/** The "My needs" button and its sheet. Drop it in any header. */
export function NeedsButton({ className }: { className?: string }) {
  const needs = useNeeds()
  const [open, setOpen] = useState(false)
  const before = useRef('')
  const n = needsCount(needs)

  const show = () => {
    sound.tap()
    before.current = JSON.stringify(needsStore.get())
    setOpen(true)
  }
  const close = () => {
    setOpen(false)
    const now = needsStore.get()
    if (JSON.stringify(now) !== before.current) ume.say(needsCount(now) ? t.mascot : t.mascotCleared)
  }

  return (
    <>
      <motion.button
        type="button"
        className={`needs-btn${className ? ` ${className}` : ''}`}
        onClick={show}
        whileTap={press}
        aria-haspopup="dialog"
        aria-label={n ? t.buttonCount(n) : undefined}
      >
        <NeedsIcon />
        <span className="needs-btn__label">{t.button}</span>
        {n > 0 && (
          <span className="needs-btn__count num" aria-hidden="true">
            {n}
          </span>
        )}
      </motion.button>
      <Sheet open={open} onClose={close} labelledBy="needs-title" className="sheet__panel--needs" head={<h2 id="needs-title" className="sheet__title">{t.title}</h2>}>
        <Body onDone={close} />
      </Sheet>
    </>
  )
}
