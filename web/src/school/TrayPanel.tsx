import { motion } from 'framer-motion'
import { createElement } from 'react'
import { copy } from '../shared/copy'
import { fmtDay } from '../shared/format'
import { foodGroupIcon, type FoodGroupComponent } from '../shared/icons'
import { LiveCount } from './LiveCount'
import { TRAY_ORDER, type TrayGroupTally, type TraySummary } from './trayTypes'

const t = copy.school.wants.tray
const barSpring = { type: 'spring', stiffness: 170, damping: 24, mass: 0.9 } as const

function GroupIcon({ component }: { component: FoodGroupComponent }) {
  return createElement(foodGroupIcon(component), { className: 's-tg__icon', width: 22, height: 22 })
}

function GroupRows({ group, reduce }: { group: TrayGroupTally; reduce: boolean }) {
  const top = Math.max(0, ...group.items.map((i) => i.picks))
  const headId = `s-tray-${group.component}`
  return (
    <section className="s-tg" data-group={group.component} aria-labelledby={headId}>
      <div className="s-tg__head">
        <GroupIcon component={group.component} />
        <h3 id={headId} className="s-tg__name">
          {t.groups[group.component]}
        </h3>
        {group.skips > 0 && (
          <span className="s-tg__skips">
            <LiveCount value={group.skips} format={(n) => t.skipped(Math.round(n))} />
          </span>
        )}
      </div>
      <ul className="s-tg__rows">
        {group.items.map((item) => {
          const lead = top > 0 && item.picks === top
          return (
            <li key={item.item_id} className="s-tr" data-lead={lead || undefined}>
              <span className="s-tr__name">{item.name}</span>
              <span className="s-tr__pct">
                <LiveCount value={Math.round(item.share * 100)} format={(n) => `${Math.round(n)}%`} />
              </span>
              <span className="s-tr__picks">
                <LiveCount value={item.picks} format={(n) => t.picked(Math.round(n))} />
              </span>
              <span className="s-tr__bar" aria-hidden="true">
                <motion.span
                  className="s-tr__fill"
                  initial={{ scaleX: reduce ? item.share : 0 }}
                  animate={{ scaleX: item.share }}
                  transition={reduce ? { duration: 0 } : barSpring}
                />
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export function TrayPanel({ tray, reduce }: { tray: TraySummary | null; reduce: boolean }) {
  const groups = tray
    ? TRAY_ORDER.flatMap((c) => tray.groups.filter((g) => g.component === c))
    : []
  return (
    <section className="s-tray" aria-labelledby="s-tray-h">
      <div className="s-tray__head">
        <div>
          <h2 id="s-tray-h" className="s-sec-title">
            {t.heading}
          </h2>
          {tray && <p className="s-sec-sub">{t.sub(fmtDay(tray.target_date))}</p>}
        </div>
        {tray && (
          <p className="s-tray__total">
            <span className="s-tray__big">
              <LiveCount value={tray.total} />
            </span>
            <span className="s-tray__unit">{t.packed(tray.total)}</span>
          </p>
        )}
      </div>
      {tray && tray.total > 0 ? (
        <div className="s-tray__groups">
          {groups.map((g) => (
            <GroupRows key={g.component} group={g} reduce={reduce} />
          ))}
        </div>
      ) : (
        <p className="s-hint s-hint--empty s-tray__empty">{t.empty}</p>
      )}
    </section>
  )
}
