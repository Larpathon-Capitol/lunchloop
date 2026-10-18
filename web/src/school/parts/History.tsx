import { useId, useRef, useState, type KeyboardEvent } from 'react'
import type { AdminSummary } from '../../shared/api'
import { copy } from '../../shared/copy'
import { fmtDay } from '../../shared/format'
import { BarList } from '../charts/BarList'

const t = copy.school.wants
const shortDay = { weekday: 'short', month: 'short', day: 'numeric' } as const
const SHORT_LIST = 5

type Tab = 'recent' | 'past'

/** Recent vote days and past winners, one at a time behind a two-way switch, five rows at first. */
export function History({ data, reduce }: { data: AdminSummary; reduce: boolean }) {
  const recent = data.recent_votes
  const past = data.past_winners
  const [tab, setTab] = useState<Tab>(recent.length > 0 ? 'recent' : 'past')
  const [all, setAll] = useState(false)
  const id = useId()
  const tabs = useRef<Record<Tab, HTMLButtonElement | null>>({ recent: null, past: null })

  const pick = (next: Tab) => {
    setTab(next)
    setAll(false)
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home' && e.key !== 'End') return
    e.preventDefault()
    const next: Tab = e.key === 'Home' ? 'recent' : e.key === 'End' ? 'past' : tab === 'recent' ? 'past' : 'recent'
    pick(next)
    tabs.current[next]?.focus()
  }

  const rows = tab === 'recent' ? recent.length : past.length
  const shown = all ? rows : Math.min(rows, SHORT_LIST)
  const avg = past.length ? Math.round((past.reduce((s, w) => s + w.vote_share, 0) / past.length) * 100) : 0

  const tabButton = (key: Tab, label: string) => (
    <button
      ref={(el) => {
        tabs.current[key] = el
      }}
      type="button"
      role="tab"
      id={`${id}-${key}`}
      aria-selected={tab === key}
      aria-controls={`${id}-panel`}
      tabIndex={tab === key ? 0 : -1}
      className="s-seg__btn"
      onClick={() => pick(key)}
    >
      {label}
    </button>
  )

  return (
    <section className="s-card s-history" aria-labelledby={`${id}-h`}>
      <div className="s-card__head s-card__head--stack">
        <h2 id={`${id}-h`} className="s-card__kicker s-card__kicker--h">
          {t.historyHeading}
        </h2>
        <div className="s-seg" role="tablist" aria-label={t.historyTabs} onKeyDown={onKey}>
          {tabButton('recent', t.recentTab)}
          {tabButton('past', t.pastTab)}
        </div>
      </div>

      <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${tab}`} className="s-history__panel">
        {tab === 'recent' &&
          (recent.length > 0 ? (
            <>
              <h3 className="s-card__title">{t.recentTitle(recent.length)}</h3>
              <BarList
                reduce={reduce}
                dense
                bars={recent.slice(0, shown).map((r) => {
                  const open = fmtDay(r.open_date, shortDay)
                  const target = fmtDay(r.target_date, shortDay)
                  return {
                    id: `${r.open_date}-${r.target_date}`,
                    label: (
                      <>
                        <span aria-hidden="true">
                          {r.winner.name}
                          <span className="c-bar__note">{t.recentRow(open, target)}</span>
                        </span>
                        <span className="visually-hidden">
                          {t.recentAlt(r.winner.name, open, target, r.winner.votes, r.total)}
                        </span>
                      </>
                    ),
                    fraction: r.total > 0 ? r.winner.votes / r.total : 0,
                    value: <span aria-hidden="true">{t.recentWinner(r.winner.votes, r.total)}</span>,
                  }
                })}
              />
            </>
          ) : (
            <p className="s-empty">{t.recentEmpty}</p>
          ))}

        {tab === 'past' &&
          (past.length > 0 ? (
            <>
              <h3 className="s-card__title">{t.pastTitle(past.length, avg)}</h3>
              <p className="s-card__sub">{t.pastSub}</p>
              <BarList
                reduce={reduce}
                dense
                bars={past.slice(0, shown).map((w) => ({
                  id: w.date,
                  label: (
                    <>
                      {w.name}
                      <span className="c-bar__note">{fmtDay(w.date, shortDay)}</span>
                    </>
                  ),
                  fraction: w.vote_share,
                  value: t.share(Math.round(w.vote_share * 100)),
                }))}
              />
            </>
          ) : (
            <p className="s-empty">{t.pastEmpty}</p>
          ))}

        {rows > SHORT_LIST && (
          <button type="button" className="btn btn--quiet s-history__more" aria-expanded={all} onClick={() => setAll((v) => !v)}>
            {all ? t.showFewer : t.showAll(rows)}
          </button>
        )}
      </div>
    </section>
  )
}
