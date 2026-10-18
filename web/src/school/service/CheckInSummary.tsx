// Today's check-ins at a glance: a big "10 of 14" figure and one stacked bar of
// got their picks / ran out / not checked in, with the counts written under it as the legend.
import type { ServiceView } from '../../shared/api'
import { service as sc } from '../../shared/copy/service'

export function CheckInSummary({ service }: { service: ServiceView }) {
  const { packed, checked_in: checkedIn, got, missed } = service
  const waiting = Math.max(0, packed - checkedIn)
  const total = Math.max(1, packed)
  const pct = (v: number) => `${(v / total) * 100}%`

  return (
    <div className="s-svc__sum">
      <p className="s-svc__kpi">
        <span className="s-svc__kpi-num">{checkedIn}</span>
        <span className="s-svc__kpi-of">{sc.kpiOf(packed)}</span>
        <span className="s-svc__kpi-label">{sc.kpiLabel}</span>
      </p>
      <div className="s-svc__sum-chart">
        <p className="s-svc__takeaway">{sc.takeaway(packed, checkedIn, missed)}</p>
        <div className="s-svc__stack" role="img" aria-label={sc.barAlt(packed, checkedIn, got, missed)}>
          {got > 0 && <span className="s-svc__seg" data-k="got" style={{ width: pct(got) }} />}
          {missed > 0 && <span className="s-svc__seg" data-k="missed" style={{ width: pct(missed) }} />}
          {waiting > 0 && <span className="s-svc__seg" data-k="waiting" style={{ width: pct(waiting) }} />}
        </div>
        <ul className="s-svc__legend" aria-hidden="true">
          <li className="s-svc__key" data-k="got">{sc.legendGot(got)}</li>
          <li className="s-svc__key" data-k="missed">{sc.legendMissed(missed)}</li>
          {waiting > 0 && <li className="s-svc__key" data-k="waiting">{sc.legendWaiting(waiting)}</li>}
        </ul>
      </div>
    </div>
  )
}
