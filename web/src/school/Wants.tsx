import { copy } from '../shared/copy'
import { fmtDay } from '../shared/format'
import { useReducedMotion } from '../shared/motion'
import { LIVE_SCHOOL } from '../shared/studentSchool'
import { ErrorNotice, Loading } from '../shared/ui/Notice'
import { SimulatedTag } from '../shared/ui/SimulatedTag'
import { Guesses } from './parts/Guesses'
import { History } from './parts/History'
import { Kpis } from './parts/Kpis'
import { People } from './parts/People'
import { VotePanel } from './parts/VotePanel'
import type { SchoolSession } from './session'
import { TrayPanel } from './TrayPanel'
import { useSummary } from './useSummary'
import './charts/charts.css'

const t = copy.school.wants

/**
 * What students want: summary tiles on top, then the vote, participation, tomorrow's trays,
 * guesses and history as charts. Two columns on wide screens, one tidy column on phones.
 */
export function Wants({ session, onExpired }: { session: SchoolSession; onExpired: () => void }) {
  const reduce = !!useReducedMotion()
  const [summary, retry] = useSummary(session.token, onExpired)

  if (summary.state === 'loading') return <Loading label={t.loading} />
  if (summary.state === 'error') return <ErrorNotice error={summary.error} onRetry={retry} />

  const { data, stale } = summary

  return (
    <div className="s-wants">
      <header className="s-head">
        <div>
          <h1 className="s-head__title">{t.title}</h1>
          <p className="s-head__sub">{fmtDay(data.today)}</p>
        </div>
        <SimulatedTag live={session.school.school_id === LIVE_SCHOOL} />
      </header>

      <Kpis data={data} />

      <div className="s-board">
        <VotePanel data={data} stale={stale} reduce={reduce} />
        <People data={data} reduce={reduce} />
        <TrayPanel tray={data.tray ?? null} reduce={reduce} schoolId={data.school.school_id} />
        <Guesses data={data} reduce={reduce} />
        <History data={data} reduce={reduce} />
      </div>
    </div>
  )
}
