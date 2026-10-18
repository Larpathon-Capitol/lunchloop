import type { AdminSummary } from '../../shared/api'
import { copy } from '../../shared/copy'
import { fmtDay } from '../../shared/format'
import { BarList } from '../charts/BarList'
import { leaders } from './leaders'

const t = copy.school.wants

/** "Called it" guesses as bars, most guessed first (the server sends them sorted). */
export function Guesses({ data, reduce }: { data: AdminSummary; reduce: boolean }) {
  const g = data.guesses
  const has = !!g && g.total > 0
  const top = has ? leaders(g.items, (i) => i.guesses) : []
  const title = has && top.length === 1 ? t.guessesTitle(top[0].name, top[0].guesses, g.total) : t.guessesHeading
  return (
    <section className="s-card s-guesses" aria-labelledby="s-guess-h">
      <div className="s-card__head">
        <div className="s-card__titles">
          {title !== t.guessesHeading && <p className="s-card__kicker">{t.guessesHeading}</p>}
          <h2 id="s-guess-h" className="s-card__title">
            {title}
          </h2>
          {has && <p className="s-card__sub">{t.guessesSub(fmtDay(g.target_date))}</p>}
        </div>
      </div>
      {has ? (
        <BarList
          reduce={reduce}
          dense
          bars={g.items.map((i) => ({
            id: i.item_id,
            label: i.name,
            fraction: i.guesses / g.total,
            value: i.guesses,
            sub: `${Math.round((i.guesses / g.total) * 100)}%`,
            lead: top.includes(i),
          }))}
        />
      ) : (
        <p className="s-empty">{t.guessesEmpty}</p>
      )}
    </section>
  )
}
