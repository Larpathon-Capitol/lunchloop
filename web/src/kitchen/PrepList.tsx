import { useState } from 'react'
import type { CSSProperties } from 'react'
import type { Component, PrepItem } from '../shared/api'
import { copy } from '../shared/copy'
import { allergenName, componentName, fmtInt } from '../shared/format'
import { PHONE_QUERY } from './useMedia'

const t = copy.kitchen.prep
const ta = copy.kitchen.allergenSummary

const ORDER: Component[] = ['meat_alternate', 'grain', 'vegetable', 'fruit', 'milk']
const GROUP_VAR: Record<string, string> = {
  meat_alternate: 'var(--g-entree)',
  grain: 'var(--g-grain)',
  vegetable: 'var(--g-vegetable)',
  fruit: 'var(--g-fruit)',
  milk: 'var(--g-milk)',
}

function Row({ item, max, why }: { item: PrepItem; max: number; why: boolean }) {
  const pct = (n: number) => `${max > 0 ? (n / max) * 100 : 0}%`
  const eaten = Math.min(item.predicted, item.prep)
  return (
    <li className="k-item">
      <span className="k-item__name">{item.name}</span>
      <span className="k-item__bar" aria-hidden="true">
        <span className="k-item__eaten" style={{ width: pct(eaten) }} />
        <span className="k-item__buffer" style={{ width: pct(Math.max(0, item.prep - eaten)) }} />
        {item.floor > 0 && <span className="k-item__floor" style={{ left: pct(item.floor) }} />}
      </span>
      <span className="k-item__qty num">
        {fmtInt(item.prep)}
        <span className="visually-hidden"> {t.servings}</span>
      </span>
      <span className="k-item__meta">
        {item.allergens.length > 0 ? (
          <span className="k-chips" role="list" aria-label={t.containsLabel}>
            {item.allergens.map((a) => (
              <span key={a} role="listitem" className="k-chip">{allergenName(a)}</span>
            ))}
          </span>
        ) : (
          <span className="k-chip k-chip--none">{t.noAllergens}</span>
        )}
        <span className={`k-item__reason ${why ? '' : 'is-folded'}`}>
          {item.reason}
          {item.floor > 0 && <>, {t.floor(fmtInt(item.floor))}</>}
        </span>
      </span>
    </li>
  )
}

export function PrepList({ items }: { items: PrepItem[] }) {
  // Groups the user has flipped from their starting state. Phones start with every group folded
  // (the header already shows its total servings); wider screens start with every group open.
  const [flipped, setFlipped] = useState<Set<string>>(() => new Set())
  const [wide] = useState(() => typeof window === 'undefined' || !window.matchMedia(PHONE_QUERY).matches)
  // Phones start with the short rows (name, bar, servings, allergens); the reasons are one tap away.
  const [why, setWhy] = useState(wide)

  if (items.length === 0) {
    return (
      <section className="k-panel" aria-labelledby="prep-title">
        <h3 id="prep-title" className="k-panel__title">{t.heading}</h3>
        <p className="k-panel__empty">{t.empty}</p>
      </section>
    )
  }

  const max = Math.max(...items.map((i) => i.prep))
  const biggest = items.reduce((a, b) => (b.prep > a.prep ? b : a))
  const known = new Set<string>(ORDER)
  const groups = [...ORDER, ...new Set(items.map((i) => i.component).filter((c) => !known.has(c)))]
    .map((c) => ({ c, rows: items.filter((i) => i.component === c) }))
    .filter((g) => g.rows.length > 0)

  // Group identical allergens: one chip per allergen with a count, item names on request.
  const byAllergen = new Map<string, string[]>()
  for (const item of items) {
    for (const a of item.allergens) byAllergen.set(a, [...(byAllergen.get(a) ?? []), item.name])
  }
  const allergens = [...byAllergen.entries()].sort((a, b) => b[1].length - a[1].length)

  const toggle = (c: string) =>
    setFlipped((s) => {
      const n = new Set(s)
      if (n.has(c)) n.delete(c)
      else n.add(c)
      return n
    })

  return (
    <section className="k-panel k-prep" aria-labelledby="prep-title">
      <div className="k-prep__head">
        <div>
          <h3 id="prep-title" className="k-panel__title">{t.heading}</h3>
          <p className="k-panel__sub">{t.takeaway(biggest.name, fmtInt(biggest.prep))}</p>
        </div>
        <ul className="k-key" aria-hidden="true">
          <li><span className="k-key__sw k-key__sw--eaten" />{t.legendEaten}</li>
          <li><span className="k-key__sw k-key__sw--buffer" />{t.legendBuffer}</li>
          <li><span className="k-key__sw k-key__sw--floor" />{t.legendFloor}</li>
        </ul>
        <button type="button" className="k-why" aria-pressed={why} onClick={() => setWhy((v) => !v)}>
          <span className="k-why__box" aria-hidden="true" />
          {t.showReasons}
        </button>
      </div>

      <div className="k-groups">
        {groups.map(({ c, rows }) => {
          const open = wide !== flipped.has(c)
          const total = rows.reduce((s, r) => s + r.prep, 0)
          const name = componentName(c)
          return (
            <div key={c} className="k-group" style={{ '--g': GROUP_VAR[c] ?? 'var(--nezumi)' } as CSSProperties}>
              <h4 className="k-group__head">
                <button
                  type="button"
                  className="k-group__btn"
                  aria-expanded={open}
                  aria-controls={`k-group-${c}`}
                  onClick={() => toggle(c)}
                >
                  <span className="k-group__dot" aria-hidden="true" />
                  <span className="k-group__name">{name}</span>
                  <span className="k-group__count">{t.groupCount(rows.length)}</span>
                  <span className="k-group__total num">{t.groupTotal(fmtInt(total))}</span>
                  <svg className="k-group__chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>
              </h4>
              <ul id={`k-group-${c}`} className="k-items" hidden={!open}>
                {rows.map((item) => <Row key={item.item_id} item={item} max={max} why={why} />)}
              </ul>
            </div>
          )
        })}
      </div>

      {allergens.length > 0 && (
        <div className="k-agroups">
          <h4 className="k-agroups__title">{ta.heading}</h4>
          <ul className="k-agroups__chips">
            {allergens.map(([a, names]) => (
              <li key={a} className="k-achip">
                <span className="k-achip__name">{allergenName(a)}</span>
                <span className="k-achip__count num">{ta.count(names.length)}</span>
              </li>
            ))}
          </ul>
          <p className="k-agroups__note">{ta.note}</p>
          <details className="k-foot">
            <summary className="k-foot__toggle">{ta.showItems}</summary>
            <dl className="k-agroups__list">
              {allergens.map(([a, names]) => (
                <div key={a} className="k-agroups__row">
                  <dt>{allergenName(a)}</dt>
                  <dd>{names.join(', ')}</dd>
                </div>
              ))}
            </dl>
          </details>
        </div>
      )}
    </section>
  )
}
