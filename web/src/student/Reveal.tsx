// "What everyone packed": only shown after you pack. Each food's share of today's trays as
// a brush stroke in its group's glaze, your own pick marked, skips as a quiet count.
import { BrushProgress } from '../celebrate'
import type { TrayPicks, TrayTally } from '../shared/api'
import { copy } from '../shared/copy'
import { foodGroupIcon } from '../shared/icons'
import { GLAZE, groupName } from './groups'

const t = copy.student.reveal

export function Reveal({ tally, picks }: { tally: TrayTally; picks: TrayPicks }) {
  return (
    <section className="reveal" aria-labelledby="reveal-title">
      <header className="reveal__head">
        <h2 id="reveal-title" className="section-title">
          {t.heading}
        </h2>
        <p className="reveal__total num">{t.total(tally.total)}</p>
      </header>
      <div className="reveal__groups">
        {tally.groups.map((g) => {
          const Icon = foodGroupIcon(g.component)
          return (
            <section key={g.component} className="reveal__group" aria-label={groupName(g.component)}>
              <h3 className="reveal__group-name">
                <span className="reveal__icon" style={{ color: GLAZE[g.component] }}>
                  <Icon />
                </span>
                {groupName(g.component)}
              </h3>
              <ul className="reveal__items">
                {g.items.map((item) => {
                  const pct = Math.round(item.share * 100)
                  const mine = picks[g.component] === item.item_id
                  return (
                    <li key={item.item_id} className={mine ? 'share share--mine' : 'share'}>
                      <div className="share__top">
                        <span className="share__name">{item.name}</span>
                        {mine && <span className="share__you">{t.you}</span>}
                        <span className="share__pct num">{pct}%</span>
                      </div>
                      <BrushProgress value={item.share} color={GLAZE[g.component]} height={12} label={t.share(item.name, pct)} />
                    </li>
                  )
                })}
              </ul>
              {g.skips > 0 && <p className="reveal__skips num">{t.skippedBy(g.skips)}</p>}
            </section>
          )
        })}
      </div>
    </section>
  )
}
