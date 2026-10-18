import { copy } from '../../shared/copy'
import { fmtDay } from '../../shared/format'
import { LIVE_SCHOOL } from '../../shared/studentSchool'
import { ErrorNotice, Loading } from '../../shared/ui/Notice'
import { SimulatedTag } from '../../shared/ui/SimulatedTag'
import type { SchoolSession } from '../session'
import { ServicePanel } from '../ServicePanel'
import { useSummary } from '../useSummary'

const t = copy.school

/** The Lunch service tab: today's check-ins and free leftovers, on a page of its own. */
export function ServiceTab({ session, onExpired }: { session: SchoolSession; onExpired: () => void }) {
  const [summary, retry, refresh] = useSummary(session.token, onExpired)
  if (summary.state === 'loading') return <Loading label={t.wants.loading} />
  if (summary.state === 'error') return <ErrorNotice error={summary.error} onRetry={retry} />
  const { data } = summary
  return (
    <div className="s-wants">
      {/* ServicePanel shows the visible "Lunch service" heading; this h1 names the page for screen readers. */}
      <header className="s-head">
        <div>
          <h1 className="visually-hidden">{t.navService}</h1>
          <p className="s-head__sub">{fmtDay(data.today)}</p>
        </div>
        <SimulatedTag live={session.school.school_id === LIVE_SCHOOL} />
      </header>
      <ServicePanel
        service={data.service ?? null}
        freeList={data.free ?? []}
        token={session.token}
        onChanged={refresh}
        onExpired={onExpired}
      />
    </div>
  )
}
