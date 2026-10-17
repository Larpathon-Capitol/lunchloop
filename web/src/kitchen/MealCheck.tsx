import type { Component, PrepItem, MealCheck as MealCheckData } from '../shared/api'
import { copy } from '../shared/copy'
import { componentName } from '../shared/format'

const ORDER: Component[] = ['meat_alternate', 'grain', 'vegetable', 'fruit', 'milk']
const t = copy.kitchen.mealCheck

type Status = 'ok' | 'missing' | 'low'

function Icon({ status }: { status: Status }) {
  const common = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }
  if (status === 'ok') return <svg {...common}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
  if (status === 'missing') return <svg {...common}><path d="m6 6 12 12M18 6 6 18" /></svg>
  return <svg {...common}><path d="M12 4 3 20h18zM12 10v4M12 17v.5" /></svg>
}

/** A quiet strip: one icon, one word per food group. Status is never color alone. */
export function MealCheck({ check, items }: { check: MealCheckData; items: PrepItem[] }) {
  const lowComponents = new Set(
    check.below_floor.map((b) => items.find((i) => i.item_id === b.item_id)?.component).filter(Boolean) as string[],
  )
  const statusOf = (c: Component): Status =>
    check.missing_components.includes(c) ? 'missing' : lowComponents.has(c) ? 'low' : 'ok'

  const problems = ORDER.flatMap((c) => {
    const s = statusOf(c)
    return s === 'missing' ? [t.missing(componentName(c))] : s === 'low' ? [t.low(componentName(c))] : []
  })
  const word = { ok: t.statusOk, missing: t.statusMissing, low: t.statusLow }

  return (
    <section className="k-mc" aria-labelledby="mc-title">
      <div className="k-mc__head">
        <h2 id="mc-title" className="k-mc__title">{t.heading}</h2>
        <p className={`k-mc__summary ${problems.length ? 'k-mc__summary--bad' : ''}`} role="status">
          {problems.length ? t.problem(problems) : t.allGood}
        </p>
      </div>
      <ul className="k-mc__list">
        {ORDER.map((c) => {
          const s = statusOf(c)
          return (
            <li key={c} className={`k-mc__item k-mc__item--${s}`}>
              <Icon status={s} />
              <span className="k-mc__name">{componentName(c)}</span>
              <span className={s === 'ok' ? 'visually-hidden' : 'k-mc__word'}>{word[s]}</span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
