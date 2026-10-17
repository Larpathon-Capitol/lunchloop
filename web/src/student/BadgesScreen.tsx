// Badges: a plain grid of the three badges, earned or not, each with how to earn it.
import { copy } from '../shared/copy'
import { ErrorNotice, Loading } from '../shared/ui/Notice'
import { SimulatedTag } from '../shared/ui/SimulatedTag'
import { useStudent } from './state'
import { Flame } from './Stats'

const t = copy.student.badges
const ORDER = ['streak_3', 'streak_7', 'called_it_5'] as const

function Mark({ id, earned }: { id: (typeof ORDER)[number]; earned: boolean }) {
  if (id === 'called_it_5') {
    return (
      <svg className={earned ? 'badge__mark' : 'badge__mark badge__mark--off'} viewBox="0 0 48 48" aria-hidden="true">
        <circle cx="24" cy="24" r="17" className="badge__ring" />
        <circle cx="24" cy="24" r="10.5" className="badge__ring" />
        <circle cx="24" cy="24" r="4" className="badge__dot" />
      </svg>
    )
  }
  return (
    <span className={earned ? 'badge__mark badge__mark--flame' : 'badge__mark badge__mark--flame badge__mark--off'} aria-hidden="true">
      <Flame lit={earned} />
      <span className="badge__digit num">{id === 'streak_3' ? 3 : 7}</span>
    </span>
  )
}

export function BadgesScreen() {
  const { me, meError, refreshMe } = useStudent()
  return (
    <div className="screen">
      <header className="screen__head">
        <h1 className="screen__title">{t.title}</h1>
        <SimulatedTag />
      </header>
      {meError && <ErrorNotice error={meError} onRetry={refreshMe} />}
      {!me && !meError && <Loading label={copy.student.loading.badges} />}
      {me && (
        <>
          <ul className="badges">
            {ORDER.map((id) => {
              const earned = me.badges.includes(id)
              return (
                <li className={earned ? 'badge badge--earned' : 'badge'} key={id}>
                  <Mark id={id} earned={earned} />
                  <span className="badge__name">{t.list[id].name}</span>
                  <span className="badge__state">{earned ? t.earned : t.notYet}</span>
                  <span className="badge__how">{t.list[id].how}</span>
                </li>
              )
            })}
          </ul>
          <p className="badges__note num">{t.streakNow(me.streak)}</p>
        </>
      )}
    </div>
  )
}
