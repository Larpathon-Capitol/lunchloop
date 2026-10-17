import { useEffect } from 'react'
import { backstage as t } from '../shared/copy/backstage'
import { SimulatedTag } from '../shared/ui/SimulatedTag'
import { ForecastSteps } from './ForecastSteps'
import { CountsStrip, LiveLog } from './LiveLog'
import { RouteMap } from './RouteMap'
import { useEventFeed } from './useEventFeed'
import './backstage.css'

/** Behind the scenes: the server's live log, the path each request takes, and one forecast worked by hand. */
export function Backstage() {
  const { rows, counts, status, fresh } = useEventFeed()

  useEffect(() => {
    const before = document.title
    document.title = t.docTitle
    return () => {
      document.title = before
    }
  }, [])

  return (
    <div className="backstage">
      <header className="b-head">
        <div>
          <h1 className="b-head__title">{t.title}</h1>
          <p className="b-head__lead">{t.lead}</p>
          <p className="b-head__sim">{t.simulatedNote}</p>
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
        <LiveLog rows={rows} status={status} fresh={fresh} />
      </div>

      <ForecastSteps />
    </div>
  )
}
