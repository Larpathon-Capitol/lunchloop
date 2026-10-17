// Diet badges, the allergen line and the "fits you" line for one food. Used on the vote
// ballot, the tray picker and the food sheet so a food reads the same everywhere.
// Everything is spans, so it can sit inside a button. Every icon has its text beside it.
import type { ComponentType } from 'react'
import { copy } from '../shared/copy'
import { allergenName } from '../shared/format'
import { Allergen, Check, Chili, HeadsUp, Leaf, Meat, NoMilk, NoWheat, Sprout, type IconProps } from '../shared/icons'
import { checkFood, useNeeds, type FoodFacts } from '../shared/needs'

const t = copy.student.diet

type Badge = { key: string; label: string; Icon: ComponentType<IconProps>; tone?: 'leaf' }

function badgesFor(food: FoodFacts, full: boolean): Badge[] {
  const diet = food.diet ?? []
  const out: Badge[] = []
  if (diet.includes('vegan')) out.push({ key: 'vegan', label: t.vegan, Icon: Sprout, tone: 'leaf' })
  else if (diet.includes('vegetarian')) out.push({ key: 'veg', label: t.vegetarian, Icon: Leaf, tone: 'leaf' })
  if (diet.includes('spicy')) out.push({ key: 'spicy', label: t.spicy, Icon: Chili })
  if (diet.includes('contains_beef')) out.push({ key: 'beef', label: t.beef, Icon: Meat })
  if (diet.includes('contains_pork')) out.push({ key: 'pork', label: t.pork, Icon: Meat })
  if (full && food.gluten_free) out.push({ key: 'gf', label: t.glutenFree, Icon: NoWheat })
  if (full && food.dairy_free) out.push({ key: 'df', label: t.dairyFree, Icon: NoMilk })
  return out
}

/** Small outlined chips: vegetarian or vegan, spicy, contains beef or pork. `full` adds gluten-free and dairy-free. */
export function DietBadges({ food, full = false }: { food: FoodFacts; full?: boolean }) {
  const badges = badgesFor(food, full)
  if (!badges.length) return null
  return (
    <span className="diet">
      {badges.map(({ key, label, Icon, tone }) => (
        <span key={key} className={tone ? `diet__chip diet__chip--${tone}` : 'diet__chip'}>
          <Icon />
          {label}
        </span>
      ))}
    </span>
  )
}

/**
 * "Has milk, wheat", or "No listed allergens". With `also`, the allergens are the ones left
 * after the needs warning already named some, and the line reads "Also has wheat".
 */
export function AllergenLine({ allergens, also = false }: { allergens: FoodFacts['allergens']; also?: boolean }) {
  const list = allergens.map((a) => allergenName(a).toLowerCase()).join(', ')
  return (
    <span className="food-line">
      {allergens.length ? (
        <>
          <Allergen />
          {also ? t.alsoHas(list) : t.has(list)}
        </>
      ) : (
        t.noAllergens
      )}
    </span>
  )
}

/** The line about the student's own needs: a kind warning, a quiet "Fits you", or nothing when no needs are set. */
export function NeedsLine({ food }: { food: FoodFacts }) {
  const needs = useNeeds()
  const check = checkFood(food, needs)
  if (check.status === 'none') return null
  if (check.status === 'fits')
    return (
      <span className="food-line food-line--fits">
        <Check />
        {t.fits}
      </span>
    )
  if (check.status === 'unknown')
    return (
      <span className="food-line">
        <HeadsUp />
        {t.unknown}
      </span>
    )
  const parts = check.diet.map((d) => t.miss[d])
  if (check.allergens.length) {
    const list = check.allergens.map((a) => allergenName(a).toLowerCase()).join(', ')
    parts.push(parts.length ? t.hasAllergy(list) : t.has(list))
  }
  return (
    <span className="food-line food-line--warn">
      <HeadsUp />
      {parts.join(', ')}
    </span>
  )
}

/**
 * All three, stacked: badges, the needs line, then the allergen line. An allergen the needs
 * warning already names is said once, in the warning: the allergen line drops it, and is left
 * out when nothing else is left.
 */
export function FoodMeta({ food, full = false }: { food: FoodFacts; full?: boolean }) {
  const needs = useNeeds()
  const check = checkFood(food, needs)
  const named = check.status === 'conflict' ? check.allergens : []
  const rest = food.allergens.filter((a) => !named.includes(a))
  return (
    <span className="food-meta">
      <DietBadges food={food} full={full} />
      <NeedsLine food={food} />
      {named.length === 0 ? <AllergenLine allergens={food.allergens} /> : rest.length > 0 && <AllergenLine allergens={rest} also />}
    </span>
  )
}
