import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import type { EventScope } from '../shared/api'
import { backstage as t } from '../shared/copy/backstage'
import { Back } from '../shared/icons'
import { DemoBar } from '../shared/ui/DemoBar'
import { SimulatedTag } from '../shared/ui/SimulatedTag'
import { ForecastSteps } from './ForecastSteps'
import { CountsStrip, LiveLog } from './LiveLog'
import { RouteMap } from './RouteMap'
import { useEventFeed } from './useEventFeed'
import type { FeedStatus } from './useEventFeed'
import './backstage.css'

// Behind the scenes comes in two feeds that never mix: the simulated school (with presenter
// controls) and the live school (real taps only). /behind-the-scenes picks between them.

function useDocTitle(title: string) {
  useEffect(() => {
    const before = document.title
    document.title = title
    return () => {
      document.title = before
    }
  }, [title])
}

function heldText(status: FeedStatus, held: number) {
  if (status === 'connecting') return t.chooser.connecting
  if (status === 'offline') return t.chooser.offline
  return t.chooser.held(held)
}

/** One link on the chooser, with a live count of what the server is holding for that feed. */
function FeedLink({ scope }: { scope: EventScope }) {
  const { status, held, rows } = useEventFeed(scope)
  const words = t.chooser[scope]
  const latest = rows[0]
  return (
    <li>
      <Link to={`/behind-the-scenes/${scope}`} className="b-pick" data-scope={scope}>
        <span className="b-pick__text">
          <span className="b-pick__name">{words.name}</span>
          <span className="b-pick__line">{words.line}</span>
          <span className="b-pick__meta">
            <span className="b-status__dot" data-status={status} aria-hidden="true" />
            <span className="num">{heldText(status, held)}</span>
            {latest && <span className="b-pick__latest">{latest.summary}</span>}
          </span>
        </span>
        <span className="b-pick__go" aria-hidden="true">
          <Back width={20} height={20} />
        </span>
      </Link>
    </li>
  )
}

/** /behind-the-scenes: choose the simulated feed or the live one. */
export function Backstage() {
  useDocTitle(t.docTitle)
  return (
    <div className="backstage backstage--chooser">
      <header className="b-head">
        <div>
          <h1 className="b-head__title">{t.title}</h1>
          <p className="b-head__lead">{t.chooser.lead}</p>
        </div>
      </header>
      <ul className="b-picks" aria-label={t.chooser.listLabel}>
        <FeedLink scope="simulated" />
        <FeedLink scope="live" />
      </ul>
    </div>
  )
}

function BackLink() {
  return (
    <Link to="/behind-the-scenes" className="b-back">
      <Back width={18} height={18} />
      {t.back}
    </Link>
  )
}

/** /behind-the-scenes/simulated: the demo school's log, presenter controls and the forecast worked by hand. */
export function BackstageSimulated() {
  useDocTitle(t.simulated.docTitle)
  const { rows, counts, status, fresh } = useEventFeed('simulated')

  return (
    <div className="backstage">
      <BackLink />
      <header className="b-head">
        <div>
          <h1 className="b-head__title">{t.simulated.title}</h1>
          <p className="b-head__lead">{t.simulated.lead}</p>
        </div>
        <SimulatedTag />
      </header>

      <DemoBar />

      <div className="b-live">
        <div className="b-live__side">
          <section className="b-panel" aria-labelledby="b-map-h">
            <h2 id="b-map-h" className="b-panel__title">
              {t.map.heading}
            </h2>
            <RouteMap fresh={fresh} />
          </section>
          <CountsStrip counts={counts} />
        </div>
        <LiveLog rows={rows} status={status} fresh={fresh} heading={t.simulated.logHeading} />
      </div>

      <ForecastSteps />
    </div>
  )
}

/** /behind-the-scenes/live: real taps from the live game. No demo controls here. */
export function BackstageLive() {
  useDocTitle(t.live.docTitle)
  const { rows, counts, status, fresh } = useEventFeed('live')

  return (
    <div className="backstage">
      <BackLink />
      <header className="b-head">
        <div>
          <h1 className="b-head__title">{t.live.title}</h1>
          <p className="b-head__lead">{t.live.lead}</p>
        </div>
        <SimulatedTag live />
      </header>

      <div className="b-live">
        <div className="b-live__side">
          <section className="b-panel" aria-labelledby="b-map-h">
            <h2 id="b-map-h" className="b-panel__title">
              {t.map.heading}
            </h2>
            <RouteMap fresh={fresh} />
          </section>
          <CountsStrip counts={counts} />
        </div>
        <LiveLog
          rows={rows}
          status={status}
          fresh={fresh}
          empty={
            <>
              <p>{t.live.empty}</p>
              <Link to="/hub" className="btn btn--quiet b-log__empty-link">
                {t.live.dashboard}
              </Link>
            </>
          }
        />
      </div>
    </div>
  )
}
