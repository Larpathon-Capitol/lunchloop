import { createElement } from 'react'
import { copy } from '../shared/copy'
import { fmtDay } from '../shared/format'
import { foodGroupIcon, type FoodGroupComponent } from '../shared/icons'
import { BarList, type Bar } from './charts/BarList'
import { LiveCount } from './LiveCount'
import { CopyLink } from './parts/CopyLink'
import { leaders } from './parts/leaders'
import { TRAY_ORDER, type TrayGroupTally, type TraySummary } from './trayTypes'

const tw = copy.school.wants
const t = tw.tray
const shortDay = { weekday: 'short', month: 'short', day: 'numeric' } as const

function GroupIcon({ component }: { component: FoodGroupComponent }) {
  return createElement(foodGroupIcon(component), { className: 's-tg__icon', width: 20, height: 20, 'aria-hidden': true })
}

/** One small multiple: a food group's picks as bars in the group's color, skips in grey. */
function Group({ group, total, reduce }: { group: TrayGroupTally; total: number; reduce: boolean }) {
  const top = leaders(group.items, (i) => i.picks)
  const headId = `s-tray-${group.component}`
  const bars: Bar[] = group.items.map((item) => ({
    id: item.item_id,
    label: item.name,
    fraction: item.share,
    value: <LiveCount value={item.picks} />,
    sub: <LiveCount value={Math.round(item.share * 100)} format={(n) => `${Math.round(n)}%`} />,
    lead: top.includes(item),
  }))
  if (group.skips > 0) {
    bars.push({
      id: 'skip',
      label: tw.skippedRow,
      muted: true,
      fraction: total > 0 ? group.skips / total : 0,
      value: <LiveCount value={group.skips} />,
      sub: <LiveCount value={total > 0 ? Math.round((group.skips / total) * 100) : 0} format={(n) => `${Math.round(n)}%`} />,
    })
  }
  return (
    <section className="s-tg" data-group={group.component} aria-labelledby={headId}>
      <h3 id={headId} className="s-tg__head">
        <GroupIcon component={group.component} />
        <span className="s-tg__name">{t.groups[group.component]}</span>
      </h3>
      <BarList reduce={reduce} dense bars={bars} className="s-tg__bars" />
    </section>
  )
}

/** Tomorrow's trays: one small chart per food group, so the kitchen sees what to cook. */
export function TrayPanel({ tray, reduce, schoolId }: { tray: TraySummary | null; reduce: boolean; schoolId: string }) {
  const groups = tray ? TRAY_ORDER.flatMap((c) => tray.groups.filter((g) => g.component === c)) : []
  const has = !!tray && tray.total > 0
  return (
    <section className="s-card s-tray" aria-labelledby="s-tray-h">
      <div className="s-card__head">
        <div className="s-card__titles">
          <p className="s-card__kicker">{t.heading}</p>
          <h2 id="s-tray-h" className="s-card__title">
            {has ? tw.trayTitle(tray.total, fmtDay(tray.target_date, shortDay)) : tw.trayEmptyTitle}
          </h2>
        </div>
      </div>
      {has ? (
        <div className="s-tray__groups">
          {groups.map((g) => (
            <Group key={g.component} group={g} total={tray.total} reduce={reduce} />
          ))}
        </div>
      ) : (
        <div className="s-empty-cta">
          <p className="s-empty-cta__text">{t.empty}</p>
          <CopyLink schoolId={schoolId} />
        </div>
      )}
    </section>
  )
}
