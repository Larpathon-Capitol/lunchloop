import type { PrepItem } from '../shared/api'
import { copy } from '../shared/copy'
import { allergenName, fmtInt } from '../shared/format'

const t = copy.kitchen.prep
const ta = copy.kitchen.allergenSummary

export function PrepList({ items }: { items: PrepItem[] }) {
  if (items.length === 0) {
    return (
      <section className="k-panel" aria-labelledby="prep-title">
        <h2 id="prep-title" className="k-panel__title">{t.heading}</h2>
        <p className="k-panel__empty">{t.empty}</p>
      </section>
    )
  }

  // Group identical allergens: one line per allergen with a count and the item names.
  const byAllergen = new Map<string, string[]>()
  for (const item of items) {
    for (const a of item.allergens) byAllergen.set(a, [...(byAllergen.get(a) ?? []), item.name])
  }
  const groups = [...byAllergen.entries()].sort((a, b) => b[1].length - a[1].length)

  return (
    <section className="k-panel" aria-labelledby="prep-title">
      <h2 id="prep-title" className="k-panel__title">{t.heading}</h2>
      <ul className="k-rows">
        {items.map((item) => (
          <li key={item.item_id} className="k-row">
            <div className="k-row__main">
              <h3 className="k-row__name">{item.name}</h3>
              <p className="k-row__reason">{item.reason}</p>
              {item.allergens.length > 0 ? (
                <ul className="k-tags" aria-label={t.containsLabel}>
                  {item.allergens.map((a) => (
                    <li key={a} className="k-tag">{allergenName(a)}</li>
                  ))}
                </ul>
              ) : (
                <p className="k-row__none">{t.noAllergens}</p>
              )}
            </div>
            <div className="k-row__qty">
              <span className="k-row__big num">{fmtInt(item.prep)}</span>
              <span className="k-row__unit">{t.servings}</span>
            </div>
          </li>
        ))}
      </ul>
      {groups.length > 0 && (
        <div className="k-agroups">
          <h3 className="k-agroups__title">{ta.heading}</h3>
          <p className="k-agroups__note">{ta.note}</p>
          <dl className="k-agroups__list">
            {groups.map(([a, names]) => (
              <div key={a} className="k-agroups__row">
                <dt>
                  {allergenName(a)} <span className="k-agroups__count">{ta.count(names.length)}</span>
                </dt>
                <dd>{names.join(', ')}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </section>
  )
}
