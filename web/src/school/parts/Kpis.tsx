import type { AdminSummary } from '../../shared/api'
import { copy } from '../../shared/copy'
import { fmtInt } from '../../shared/format'
import { Meter } from '../charts/Meter'
import { Ring } from '../charts/Ring'
import { SparkBars } from '../charts/SparkBars'
import { LiveCount } from '../LiveCount'
import { leaders, pct } from './leaders'

const t = copy.school.wants
const k = t.kpi
const SPARK_DAYS = 5

/**
 * Four summary tiles, each a number with a tiny chart. Only numbers the summary returns.
 * Phones show only the first two: participation and the leading entree are the first cards below.
 */
export function Kpis({ data }: { data: AdminSummary }) {
  const { vote, players } = data
  const playersText = fmtInt(players.total)
  const trays = data.tray?.total ?? 0

  // Votes per earlier vote day (oldest first), then today.
  const earlier = data.recent_votes.slice(0, SPARK_DAYS).reverse().map((r) => r.total)
  const today = vote?.total ?? 0
  const series = [...earlier, today]

  const activePct = pct(players.voted_last_5_days, players.total)

  const top = vote ? leaders(vote.options, (o) => o.votes) : []
  const leadPct = vote && top.length ? pct(top[0].votes, vote.total) : 0

  return (
    <ul className="s-kpis" aria-label={t.kpiLabel}>
      <li className="s-kpi">
        <p className="s-kpi__label">{k.trays}</p>
        <div className="s-kpi__main">
          <span className="s-kpi__big">
            <LiveCount value={trays} />
          </span>
        </div>
        <Meter fraction={players.total ? trays / players.total : 0} />
        <p className="s-kpi__foot">{trays > 0 ? t.ofPlayers(playersText) : k.traysNone}</p>
      </li>

      <li className="s-kpi">
        <p className="s-kpi__label">{k.votes}</p>
        <div className="s-kpi__main">
          <span className="s-kpi__big">
            <LiveCount value={today} />
          </span>
          {earlier.length >= 2 && (
            <span className="s-kpi__chart">
              <SparkBars values={series} />
              <span className="visually-hidden">
                {k.votesSpark(earlier.length)}: {series.map((n) => fmtInt(n)).join(', ')}
              </span>
            </span>
          )}
        </div>
        <p className="s-kpi__foot">{k.votesFoot(earlier.length)}</p>
      </li>

      <li className="s-kpi s-kpi--wide-only">
        <p className="s-kpi__label">{k.active}</p>
        <div className="s-kpi__main">
          <span className="s-kpi__big">
            <LiveCount value={activePct} format={(n) => `${Math.round(n)}%`} />
          </span>
          <span className="s-kpi__chart">
            <Ring fraction={players.total ? players.voted_last_5_days / players.total : 0} size={44} stroke={7} />
          </span>
        </div>
        <p className="s-kpi__foot">{k.activeFoot(fmtInt(players.voted_last_5_days), playersText)}</p>
      </li>

      <li className="s-kpi s-kpi--leader s-kpi--wide-only">
        <p className="s-kpi__label">{k.leader}</p>
        <div className="s-kpi__main">
          <span className="s-kpi__name">{top.length ? top.map((o) => o.name).join(' / ') : k.leaderNone}</span>
        </div>
        <Meter fraction={leadPct / 100} />
        <p className="s-kpi__foot">
          {top.length > 1 ? k.leaderTied(leadPct) : top.length ? k.leaderFoot(leadPct) : k.leaderNoneFoot}
        </p>
      </li>
    </ul>
  )
}
