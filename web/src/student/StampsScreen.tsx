// Stamps: a page from a stamp book. Earned stamps are inked vermilion; the rest are a faint
// pencil outline, with streak progress under them. Totals sit at the foot of the page.
import { HankoStamp, NumberRoll } from '../celebrate'
import { UmeInline, usePetCount } from '../mascot'
import { copy } from '../shared/copy'
import { Blossom, Coin, Hand } from '../shared/icons'
import { ErrorNotice } from '../shared/ui/Notice'
import { PanelSkeleton } from './VoteScreen'
import { useStudent } from './state'

const t = copy.student.stamps
// The week streak is the headline stamp, so it is drawn largest.
const ORDER = [
  { id: 'streak_7', size: 132, tilt: -4 },
  { id: 'streak_3', size: 96, tilt: 5 },
  { id: 'called_it_5', size: 104, tilt: -2 },
] as const

function Pencil({ size, label }: { size: number; label: string }) {
  return (
    <span className="pencil" style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 100 100">
        <rect x="6" y="6" width="88" height="88" rx="5" />
        <rect x="12" y="12" width="76" height="76" rx="2" />
      </svg>
      <span className="pencil__label">{label}</span>
    </span>
  )
}

export function StampsScreen() {
  const { me, meError, refreshMe } = useStudent()
  const pets = usePetCount()
  return (
    <div className="tabscreen">
      <header className="tabscreen__head">
        <h1 className="tabscreen__title">{t.title}</h1>
        <UmeInline size={48} />
      </header>
      {meError && <ErrorNotice error={meError} onRetry={refreshMe} />}
      {!me && !meError && (
        <div role="status" aria-live="polite">
          <span className="visually-hidden">{copy.student.loading.badges}</span>
          <PanelSkeleton />
        </div>
      )}
      {me && (
        <div className="stampbook">
          <ul className="stampbook__page">
            {ORDER.map(({ id, size, tilt }, i) => {
              const earned = me.badges.includes(id)
              const info = t.list[id]
              return (
                <li key={id} className={`stamp stamp--${i}${earned ? ' stamp--earned' : ''}`}>
                  <span className="stamp__art" style={{ transform: `rotate(${tilt}deg)` }}>
                    {earned ? <HankoStamp visible silent size={size} label={info.seal} /> : <Pencil size={size} label={info.seal} />}
                  </span>
                  <span className="stamp__text">
                    <span className="stamp__name">{info.name}</span>
                    {earned ? (
                      <span className="stamp__state">{t.earned}</span>
                    ) : info.days ? (
                      <span className="stamp__state num">{t.daysOf(Math.min(me.streak, info.days), info.days)}</span>
                    ) : null}
                  </span>
                </li>
              )
            })}
          </ul>
          <p className="stampbook__rule">{t.rule}</p>
          <section className="totals" aria-label={t.totals}>
            <p className="totals__item">
              <span className="totals__icon totals__icon--streak">
                <Blossom />
              </span>
              <span className="totals__value">
                <NumberRoll value={me.streak} />
              </span>
              <span className="totals__label">{t.streak}</span>
            </p>
            <p className="totals__item">
              <span className="totals__icon totals__icon--xp">
                <Coin />
              </span>
              <span className="totals__value">
                <NumberRoll value={me.xp} />
              </span>
              <span className="totals__label">{t.xp}</span>
            </p>
            <p className="totals__item">
              <span className="totals__icon totals__icon--pet">
                <Hand />
              </span>
              <span className="totals__value">
                <NumberRoll value={pets} />
              </span>
              <span className="totals__label">{t.pets(pets)}</span>
            </p>
          </section>
        </div>
      )}
    </div>
  )
}
