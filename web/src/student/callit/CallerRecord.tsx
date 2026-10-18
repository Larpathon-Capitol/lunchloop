// Right calls so far and the way to the Caller stamp (five right calls). Only what the API
// reports: correct_calls and the called_it_5 badge. Shows nothing when neither is known.
import type { Me } from '../../shared/api'
import { callit } from '../../shared/copy/callit'

const GOAL = 5

export function CallerRecord({ me }: { me: Me }) {
  const n = typeof me.correct_calls === 'number' ? Math.max(0, me.correct_calls) : null
  const earned = me.badges.includes('called_it_5')
  if (n === null && !earned) return null
  const filled = earned ? GOAL : Math.min(n ?? 0, GOAL)
  const t = callit.record
  return (
    <section className="callit-record" aria-labelledby="callit-record-title">
      <h2 id="callit-record-title" className="callit-record__title">
        {t.heading}
      </h2>
      <div className="callit-record__row">
        <ol className="callit-record__pips" aria-hidden="true">
          {Array.from({ length: GOAL }, (_, i) => (
            <li key={i} className={i < filled ? 'is-on' : undefined} />
          ))}
        </ol>
        <p className="callit-record__text">{earned ? (n !== null ? t.earned(n) : t.earnedNoCount) : t.toward(n ?? 0, GOAL)}</p>
      </div>
    </section>
  )
}
