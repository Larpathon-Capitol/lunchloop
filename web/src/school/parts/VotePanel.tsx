import type { AdminSummary } from '../../shared/api'
import { copy } from '../../shared/copy'
import { fmtDay } from '../../shared/format'
import { BarList } from '../charts/BarList'
import { LiveCount } from '../LiveCount'
import { CopyLink } from './CopyLink'
import { byCount, joinNames, leaders } from './leaders'

const t = copy.school.wants
const shortDay = { weekday: 'short', month: 'short', day: 'numeric' } as const

/** Today's vote as horizontal bars, most votes first, the leader in the primary color. */
export function VotePanel({ data, stale, reduce }: { data: AdminSummary; stale: boolean; reduce: boolean }) {
  const vote = data.vote
  const empty = !vote || vote.total === 0
  const day = vote ? fmtDay(vote.target_date, shortDay) : ''
  const top = vote ? leaders(vote.options, (o) => o.votes) : []
  const title = !vote
    ? t.voteTitle.none
    : empty
      ? t.voteTitle.empty
      : top.length > 1
        ? t.voteTitle.tie(joinNames(top.map((o) => o.name), t.and), day)
        : t.voteTitle.lead(top[0].name, day)

  return (
    <section className="s-card s-vote" aria-labelledby="s-vote-h">
      <div className="s-card__head">
        <div className="s-card__titles">
          <p className="s-card__kicker">{t.todayHeading}</p>
          <h2 id="s-vote-h" className="s-card__title">
            {title}
          </h2>
          {vote && empty && <p className="s-card__sub">{t.todaySub(vote.target_slot, fmtDay(vote.target_date))}</p>}
        </div>
        {!empty && <CopyLink schoolId={data.school.school_id} />}
      </div>

      {vote && !empty && (
        <BarList
          reduce={reduce}
          bars={byCount(vote.options, (o) => o.votes).map((o) => {
            const lead = top.includes(o)
            return {
              id: o.item_id,
              label: o.name,
              fraction: o.share,
              value: <LiveCount value={Math.round(o.share * 100)} format={(n) => t.share(Math.round(n))} />,
              sub: <LiveCount value={o.votes} format={(n) => t.votes(Math.round(n))} />,
              lead,
              tag: lead && top.length === 1 ? t.leading : undefined,
            }
          })}
        />
      )}

      {vote && empty && (
        <div className="s-empty-cta">
          <ul className="s-chips" aria-label={t.todaySub(vote.target_slot, day)}>
            {vote.options.map((o) => (
              <li key={o.item_id} className="s-chip">
                {o.name}
              </li>
            ))}
          </ul>
          <p className="s-empty-cta__text">{t.voteEmpty}</p>
          <CopyLink schoolId={data.school.school_id} primary />
        </div>
      )}

      {!vote && <p className="s-empty">{t.noVoteOpen}</p>}
      <p className="s-hint">{stale ? t.stale : t.live}</p>
    </section>
  )
}
