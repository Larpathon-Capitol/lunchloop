// Today's quests: pack, vote, call it. A short checklist, each stamped when done.
import { Link } from 'react-router-dom'
import { copy } from '../shared/copy'
import { Ballot, Check, Crystal, Tray } from '../shared/icons'
import { useGameBase } from '../shared/studentSchool'
import { useStudent } from './state'

const t = copy.student.quests

export function Quests() {
  const { me, calendar, tray } = useStudent()
  const { base, search } = useGameBase()
  const packed = tray.state === 'ready' && !!tray.data.picks
  const called = !!(me?.last_guess && calendar?.next && me.last_guess.target_date === calendar.next.date)
  const rows = [
    { key: 'pack', label: t.pack, done: packed || !!me?.packed_today, icon: <Tray />, to: null },
    { key: 'vote', label: t.vote, done: !!me?.voted_today, icon: <Ballot />, to: `${base}/vote${search}` },
    { key: 'call', label: t.callIt, done: called, icon: <Crystal />, to: `${base}/call-it${search}` },
  ]
  return (
    <section className="quests" aria-labelledby="quests-title">
      <h2 id="quests-title" className="section-title">
        {t.heading}
      </h2>
      <ul className="quests__list">
        {rows.map((q) => {
          const inner = (
            <>
              <span className="quests__icon">{q.icon}</span>
              <span className="quests__label">{q.label}</span>
              <span className={q.done ? 'quests__mark quests__mark--done' : 'quests__mark'}>
                {q.done && <Check />}
                <span className="visually-hidden">{q.done ? t.done : t.todo}</span>
              </span>
            </>
          )
          return (
            <li key={q.key} className={q.done ? 'quests__row quests__row--done' : 'quests__row'}>
              {q.to && !q.done ? (
                <Link to={q.to} className="quests__body quests__body--link">
                  {inner}
                </Link>
              ) : (
                <span className="quests__body">{inner}</span>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
