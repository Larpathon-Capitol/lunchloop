import type { AdminSummary } from '../../shared/api'
import { copy } from '../../shared/copy'
import { fmtInt } from '../../shared/format'
import { BarList } from '../charts/BarList'
import { pct } from './leaders'

const t = copy.school.wants

/** Participation: how many students joined, and how many players voted this week and today. */
export function People({ data, reduce }: { data: AdminSummary; reduce: boolean }) {
  const { players } = data
  const students = data.school.students
  const weekPct = pct(players.voted_last_5_days, players.total)
  const title = players.total > 0 ? t.peopleTitle(weekPct) : t.peopleTitleNone
  const ofPlayers = (n: number) => t.ofBase(fmtInt(n), `${fmtInt(players.total)} ${t.playersWord}`)
  const frac = (n: number, of: number) => (of > 0 ? n / of : 0)

  return (
    <section className="s-card s-people" aria-labelledby="s-people-h">
      <div className="s-card__head">
        <div className="s-card__titles">
          <p className="s-card__kicker">{t.peopleHeading}</p>
          <h2 id="s-people-h" className="s-card__title">
            {title}
          </h2>
        </div>
      </div>
      <BarList
        reduce={reduce}
        className="s-people__bars"
        bars={[
          {
            id: 'week',
            label: t.last5Short,
            fraction: frac(players.voted_last_5_days, players.total),
            value: `${weekPct}%`,
            sub: ofPlayers(players.voted_last_5_days),
            lead: true,
          },
          {
            id: 'today',
            label: t.todayShort,
            fraction: frac(players.voted_today, players.total),
            value: `${pct(players.voted_today, players.total)}%`,
            sub: ofPlayers(players.voted_today),
          },
          ...(students > 0
            ? [
                {
                  id: 'joined',
                  label: t.joined,
                  fraction: frac(players.total, students),
                  value: `${pct(players.total, students)}%`,
                  sub: t.ofBase(fmtInt(players.total), `${fmtInt(students)} ${t.studentsWord}`),
                },
              ]
            : []),
        ]}
      />
    </section>
  )
}
