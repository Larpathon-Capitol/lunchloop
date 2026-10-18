/* oxlint-disable react/only-export-components */
import { StrictMode, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../shared/base.css'
import { sound } from '../shared/sound'
import { BrushProgress, HankoStamp, NumberRoll, StreakMilestone, XpToast, burstPetals, celebratePacked, driftPetals, isStreakMilestone } from './index'
import './lab.css'

/** Standalone page for the reward kit: /celebrate-lab.html */
function Btn({ children, onClick, tone }: { children: React.ReactNode; onClick: (e: React.MouseEvent<HTMLButtonElement>) => void; tone?: 'shu' | 'quiet' }) {
  return (
    <button type="button" className={`clab-btn${tone ? ` ${tone}` : ''}`} onClick={onClick}>
      {children}
    </button>
  )
}

function Lab() {
  const [stamp, setStamp] = useState(false)
  const [stampSize, setStampSize] = useState(104)
  const [num, setNum] = useState(7)
  const [rollFrom, setRollFrom] = useState<number | undefined>(undefined)
  const [prog, setProg] = useState(0.35)
  const [toasts, setToasts] = useState<number[]>([])
  const [milestone, setMilestone] = useState<number | null>(null)
  const [drift, setDrift] = useState(false)
  const [log, setLog] = useState('')
  const hero = useRef<HTMLDivElement>(null)
  const toastId = useRef(0)
  const packRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!drift || !hero.current) return
    return driftPetals(hero.current, { count: 8 })
  }, [drift])

  const restamp = () => {
    setStamp(false)
    window.setTimeout(() => setStamp(true), 60)
  }

  return (
    <main className="clab">
      <div className="clab-top">
        <h1>Celebrate lab</h1>
      </div>

      <section aria-labelledby="h-orch">
        <h2 id="h-orch">Packed sequence</h2>
        <div className="clab-row">
          <button
            ref={packRef}
            type="button"
            className="clab-btn shu"
            onClick={() => {
              setLog('running')
              void celebratePacked({ anchorEl: packRef.current, streak: 4, xpGained: 10, isMilestone: isStreakMilestone(4), onStep: (s) => setLog(s) }).then(() => setLog('done'))
            }}
          >
            Pack tray (day 4)
          </button>
          <Btn
            tone="quiet"
            onClick={() => {
              setLog('running')
              void celebratePacked({ anchorEl: packRef.current, streak: 7, xpGained: 15, isMilestone: true, onStep: (s) => setLog(s) }).then(() => setLog('done'))
            }}
          >
            Pack tray (day 7)
          </Btn>
        </div>
        <p className="clab-status" aria-live="polite">
          {log || 'Idle'}
        </p>
      </section>

      <section aria-labelledby="h-stamp">
        <h2 id="h-stamp">Hanko stamp</h2>
        <div className="clab-stage">
          <HankoStamp label="Packed" visible={stamp} size={stampSize} />
        </div>
        <div className="clab-row">
          <Btn tone="shu" onClick={restamp}>
            Stamp
          </Btn>
          <Btn tone="quiet" onClick={() => setStamp(false)}>
            Lift
          </Btn>
          <Btn tone="quiet" onClick={() => setStampSize((s) => (s === 104 ? 64 : s === 64 ? 160 : 104))}>
            Size {stampSize}
          </Btn>
        </div>
      </section>

      <section aria-labelledby="h-petals">
        <h2 id="h-petals">Petals</h2>
        <div ref={hero} className="clab-stage ai">
          <Btn tone="shu" onClick={(e) => burstPetals(e.currentTarget)}>
            Burst
          </Btn>
        </div>
        <div className="clab-row">
          <Btn tone="quiet" onClick={() => setDrift((d) => !d)}>
            {drift ? 'Stop drift' : 'Start drift'}
          </Btn>
        </div>
      </section>

      <section aria-labelledby="h-roll">
        <h2 id="h-roll">Number roll</h2>
        <div className="clab-stage">
          <span className="clab-big">
            <NumberRoll value={num} from={rollFrom} />
          </span>
        </div>
        <div className="clab-row">
          <Btn onClick={() => { setRollFrom(undefined); setNum((n) => n + 1) }}>Add 1</Btn>
          <Btn onClick={() => { setRollFrom(undefined); setNum((n) => n + 10) }}>Add 10</Btn>
          <Btn tone="quiet" onClick={() => { setRollFrom(undefined); setNum(Math.floor(Math.random() * 1200)) }}>Random</Btn>
          <Btn tone="quiet" onClick={() => { setRollFrom(undefined); setNum(0) }}>Reset</Btn>
        </div>
      </section>

      <section aria-labelledby="h-brush">
        <h2 id="h-brush">Brush progress</h2>
        <BrushProgress value={prog} />
        <BrushProgress value={prog} color="var(--g-vegetable)" height={16} />
        <BrushProgress value={prog} color="var(--ai)" height={12} />
        <div className="clab-row">
          {[0, 0.25, 0.6, 1].map((v) => (
            <Btn key={v} tone="quiet" onClick={() => setProg(v)}>
              {Math.round(v * 100)}%
            </Btn>
          ))}
        </div>
      </section>

      <section aria-labelledby="h-xp">
        <h2 id="h-xp">XP token</h2>
        <div className="clab-stage" style={{ minHeight: 100 }}>
          {toasts.map((id) => (
            <span key={id} style={{ position: 'absolute' }}>
              <XpToast amount={10} sound onDone={() => setToasts((t) => t.filter((x) => x !== id))} />
            </span>
          ))}
        </div>
        <div className="clab-row">
          <Btn tone="shu" onClick={() => setToasts((t) => [...t, ++toastId.current])}>
            Earn 10 XP
          </Btn>
        </div>
      </section>

      <section aria-labelledby="h-mile">
        <h2 id="h-mile">Streak milestone</h2>
        <div className="clab-row">
          {[3, 7, 10, 20, 100].map((n) => (
            <Btn key={n} tone="quiet" onClick={() => setMilestone(n)}>
              Day {n}
            </Btn>
          ))}
        </div>
        {milestone !== null && <StreakMilestone streak={milestone} onClose={() => setMilestone(null)} />}
      </section>

      <section aria-labelledby="h-snd">
        <h2 id="h-snd">Sounds</h2>
        <div className="clab-row">
          <Btn tone="quiet" onClick={sound.tok}>tok</Btn>
          <Btn tone="quiet" onClick={sound.stamp}>stamp</Btn>
          <Btn tone="quiet" onClick={sound.chime}>chime</Btn>
          <Btn tone="quiet" onClick={sound.skip}>skip</Btn>
          <Btn tone="quiet" onClick={sound.pet}>pet</Btn>
        </div>
        <div className="clab-row">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((s) => (
            <Btn key={s} tone="quiet" onClick={() => sound.pluck(s)}>
              pluck {s}
            </Btn>
          ))}
          <Btn
            onClick={() => {
              for (let s = 0; s < 5; s++) window.setTimeout(() => sound.pluck(s), s * 220)
            }}
          >
            Fill the tray
          </Btn>
        </div>
      </section>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Lab />
  </StrictMode>,
)
