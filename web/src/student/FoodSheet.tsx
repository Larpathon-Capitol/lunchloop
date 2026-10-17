// Food info: food group, allergens exactly as listed, and the staff note.
import { copy } from '../shared/copy'
import { allergenName } from '../shared/format'
import { Allergen } from '../shared/icons'
import { FoodGlyph } from './FoodGlyph'
import { Sheet } from './Sheet'
import { useStudent } from './state'

const t = copy.student.food

export function FoodSheet() {
  const { food, catalog, closeFood } = useStudent()
  const component = food ? (food.component ?? catalog[food.item_id]?.component) : undefined
  return (
    <Sheet
      open={!!food}
      onClose={closeFood}
      labelledBy="food-sheet-title"
      head={
        food && (
          <>
            <span className="glyph-disc">
              <FoodGlyph id={food.item_id} />
            </span>
            <h2 id="food-sheet-title" className="sheet__title">
              {food.name}
            </h2>
          </>
        )
      }
    >
      {food && (
        <>
          <dl className="facts">
            <div className="facts__row">
              <dt>{t.group}</dt>
              <dd>{component ? copy.student.groups[component] : t.unknownGroup}</dd>
            </div>
            <div className="facts__row">
              <dt>{t.allergens}</dt>
              <dd>{food.allergens.length ? food.allergens.map(allergenName).join(', ') : t.noAllergens}</dd>
            </div>
          </dl>
          <p className="staff-note">
            <Allergen />
            {t.note}
          </p>
        </>
      )}
    </Sheet>
  )
}
