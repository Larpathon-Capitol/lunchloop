// The picker for one food group: Ume's nudge, each of tomorrow's foods in that group as a
// big row, and a gentle "Skip this one". Picks can change any time before packing.
import { motion } from 'framer-motion'
import { useState } from 'react'
import type { Component, TrayGroup } from '../shared/api'
import { copy } from '../shared/copy'
import { allergenName } from '../shared/format'
import { Allergen, Check, Info, Skip, foodGroupIcon } from '../shared/icons'
import { encourageLine } from '../mascot'
import { press } from '../shared/motion'
import { FoodGlyph } from './FoodGlyph'
import { GLAZE, groupName, umeGroup } from './groups'
import { Sheet } from './Sheet'

const t = copy.student.picker

interface Props {
  group: TrayGroup | null
  /** item_id, null for skipped, undefined for not decided. */
  current: string | null | undefined
  onPick: (component: Component, item_id: string | null) => void
  onClose: () => void
}

function Content({ group, current, onPick }: { group: TrayGroup; current: string | null | undefined; onPick: Props['onPick'] }) {
  const [openInfo, setOpenInfo] = useState<string | null>(null)
  const name = groupName(group.component)
  return (
    <ul className="picks" aria-label={t.items(name)}>
        {group.items.map((item) => {
          const on = current === item.item_id
          const infoOpen = openInfo === item.item_id
          return (
            <li key={item.item_id} className={on ? 'pick pick--on' : 'pick'}>
              <div className="pick__row">
                <motion.button type="button" className="pick__main" aria-pressed={on} onClick={() => onPick(group.component, item.item_id)} whileTap={press}>
                  <span className="glyph-disc" style={{ color: GLAZE[group.component] }}>
                    <FoodGlyph id={item.item_id} />
                  </span>
                  <span className="pick__text">
                    <span className="pick__name">{item.name}</span>
                    <span className="pick__allergens">
                      {item.allergens.length ? (
                        <>
                          <Allergen />
                          {t.contains(item.allergens.map((a) => allergenName(a).toLowerCase()).join(', '))}
                        </>
                      ) : (
                        t.noAllergens
                      )}
                    </span>
                  </span>
                  {on && (
                    <span className="pick__check" aria-hidden="true">
                      <Check />
                    </span>
                  )}
                  {on && <span className="visually-hidden">{t.current}</span>}
                </motion.button>
                <button
                  type="button"
                  className="icon-btn pick__info"
                  aria-expanded={infoOpen}
                  aria-controls={`note-${item.item_id}`}
                  aria-label={t.info(item.name)}
                  onClick={() => setOpenInfo(infoOpen ? null : item.item_id)}
                >
                  <Info />
                </button>
              </div>
              <p id={`note-${item.item_id}`} className="pick__note" hidden={!infoOpen}>
                {t.note}
              </p>
            </li>
          )
        })}
        <li className={current === null ? 'pick pick--skip pick--on' : 'pick pick--skip'}>
          <motion.button type="button" className="pick__main" aria-pressed={current === null} onClick={() => onPick(group.component, null)} whileTap={press}>
            <span className="glyph-disc glyph-disc--quiet">
              <Skip />
            </span>
            <span className="pick__text">
              <span className="pick__name">{t.skip}</span>
              <span className="pick__allergens">{t.skipLine}</span>
            </span>
          </motion.button>
        </li>
    </ul>
  )
}

function Head({ component }: { component: Component }) {
  const Icon = foodGroupIcon(component)
  // One nudge per opening, so it doesn't change while the sheet re-renders.
  const [line] = useState(() => encourageLine(umeGroup(component)))
  return (
    <>
      <span className="glyph-disc glyph-disc--solid" style={{ background: GLAZE[component] }}>
        <Icon />
      </span>
      <span className="sheet__titles">
        <h2 id="picker-title" className="sheet__title">
          {groupName(component)}
        </h2>
        <span className="sheet__line">{line}</span>
      </span>
    </>
  )
}

export function PickerSheet({ group, current, onPick, onClose }: Props) {
  return (
    <Sheet
      open={!!group}
      onClose={onClose}
      labelledBy="picker-title"
      className="sheet__panel--picker"
      head={group && <Head key={group.component} component={group.component} />}
    >
      {group && <Content key={group.component} group={group} current={current} onPick={onPick} />}
    </Sheet>
  )
}
