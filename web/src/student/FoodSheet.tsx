// Food info as a bottom sheet: food group, allergens exactly as listed, and the staff note.
import { AnimatePresence, motion, useReducedMotion, type PanInfo } from 'framer-motion'
import { useEffect, useRef } from 'react'
import { copy } from '../shared/copy'
import { allergenName, componentName } from '../shared/format'
import { FoodGlyph } from './FoodGlyph'
import { useStudent } from './state'
import { instant, sheetSpring } from './springs'

const t = copy.student.food

/**
 * Makes everything outside `el` inert (not focusable, hidden from screen readers),
 * by marking the siblings of `el` and of each of its ancestors. Returns an undo.
 */
function inertOutside(el: HTMLElement) {
  const changed: HTMLElement[] = []
  for (let node: HTMLElement | null = el; node && node !== document.body; node = node.parentElement) {
    const parent: HTMLElement | null = node.parentElement
    if (!parent) break
    for (const sib of Array.from(parent.children)) {
      if (sib === node || !(sib instanceof HTMLElement) || sib.inert) continue
      sib.inert = true
      changed.push(sib)
    }
  }
  return () => changed.forEach((n) => (n.inert = false))
}

export function FoodSheet() {
  const { food, catalog, closeFood } = useStudent()
  const reduce = useReducedMotion()
  const closeRef = useRef<HTMLButtonElement>(null)
  const returnTo = useRef<HTMLElement | null>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const open = !!food

  // While open: focus Close, keep Tab inside the sheet, Escape closes, then focus goes back.
  useEffect(() => {
    if (!open || !sheetRef.current) return
    returnTo.current = document.activeElement as HTMLElement | null
    const undoInert = inertOutside(sheetRef.current)
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeFood()
      if (e.key !== 'Tab' || !sheetRef.current) return
      // Wrap Tab and Shift+Tab around the sheet's own controls.
      const items = Array.from(sheetRef.current.querySelectorAll<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])'))
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      const inside = sheetRef.current.contains(document.activeElement)
      if (e.shiftKey && (document.activeElement === first || !inside)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (document.activeElement === last || !inside)) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      undoInert()
      returnTo.current?.focus({ preventScroll: true })
    }
  }, [open, closeFood])

  const component = food ? (food.component ?? catalog[food.item_id]?.component) : undefined
  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 80 || info.velocity.y > 500) closeFood()
  }

  return (
    <AnimatePresence>
      {food && (
        <div className="sheet" key="sheet" ref={sheetRef}>
          <motion.div
            className="sheet__scrim"
            onClick={closeFood}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            exit={{ opacity: 0 }}
            transition={reduce ? instant : sheetSpring}
          />
          <motion.div
            className="sheet__panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="food-sheet-title"
            initial={reduce ? { y: 0 } : { y: '100%' }}
            animate={{ y: 0 }}
            exit={reduce ? { opacity: 0 } : { y: '100%' }}
            transition={reduce ? instant : sheetSpring}
            drag={reduce ? false : 'y'}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={onDragEnd}
          >
            <span className="sheet__grip" aria-hidden="true" />
            <div className="sheet__head">
              <FoodGlyph id={food.item_id} large />
              <h2 id="food-sheet-title" className="sheet__title">
                {food.name}
              </h2>
            </div>
            <dl className="sheet__facts">
              <div className="sheet__fact">
                <dt>{t.group}</dt>
                <dd>{component ? componentName(component) : t.unknownGroup}</dd>
              </div>
              <div className="sheet__fact">
                <dt>{t.allergens}</dt>
                <dd>{food.allergens.length ? food.allergens.map(allergenName).join(', ') : t.noAllergens}</dd>
              </div>
            </dl>
            <p className="sheet__note">
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <circle cx="10" cy="10" r="7.5" />
                <path d="M10 6v5M10 13.8v.3" />
              </svg>
              {t.note}
            </p>
            <button ref={closeRef} type="button" className="btn btn--quiet sheet__close" onClick={closeFood}>
              {t.close}
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
