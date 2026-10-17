import { useRef, useState } from 'react'
import { lines, pickLine, greetingLine } from './lines'
import { ume, usePetCount } from './store'
import { MOODS, type UmeMood } from './types'
import { Ume } from './Ume'
import { UmeDock } from './UmeDock'

const params = new URLSearchParams(location.search)
const startMood = (params.get('mood') as UmeMood | null) ?? 'idle'

export function LabPage() {
  const [mood, setMood] = useState<UmeMood>(MOODS.includes(startMood) ? startMood : 'idle')
  const [say, setSay] = useState<string | null>(params.get('say'))
  const [sayKey, setSayKey] = useState(0)
  const [hopKey, setHopKey] = useState(0)
  const pets = usePetCount()
  const rim = useRef<HTMLDivElement>(null)

  const speak = (text: string) => {
    setSay(text)
    setSayKey((k) => k + 1)
  }

  return (
    <main className="lab">
      <h1>Ume</h1>

      <section>
        <h2>Mood</h2>
        <div className="lab-controls" role="group" aria-label="Mood">
          {MOODS.map((m) => (
            <button key={m} type="button" aria-pressed={mood === m} onClick={() => setMood(m)}>
              {m}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2>Speech and motion</h2>
        <div className="lab-controls">
          <button type="button" onClick={() => speak(greetingLine())}>Greeting</button>
          <button type="button" onClick={() => speak(pickLine(lines.skip))}>Skip line</button>
          <button type="button" onClick={() => speak(pickLine(lines.trayPacked))}>Tray packed</button>
          <button type="button" id="lab-hop" onClick={() => setHopKey((k) => k + 1)}>Hop</button>
          <span>Pets so far: {pets}</span>
        </div>
      </section>

      <section id="sizes-washi" className="lab-stage" data-ground="washi">
        {[64, 120, 240].map((s) => (
          <div className="lab-cell" key={s}>
            <Ume size={s} mood={mood} say={s === 240 ? say : null} sayKey={sayKey} hopKey={hopKey} />
            {s}px
          </div>
        ))}
        <div className="lab-cell">
          <Ume size={48} mood={mood} interactive={false} />
          48px
        </div>
      </section>

      <section id="sizes-ai" className="lab-stage" data-ground="ai">
        {[64, 120, 240].map((s) => (
          <div className="lab-cell" key={s}>
            <Ume size={s} mood={mood} hopKey={hopKey} />
            {s}px
          </div>
        ))}
        <div className="lab-cell">
          <Ume size={48} mood={mood} interactive={false} />
          48px
        </div>
      </section>

      <section>
        <h2>Every mood</h2>
        <div id="sheet-washi" className="lab-stage lab-sheet" data-ground="washi">
          {MOODS.map((m) => (
            <div className="lab-cell" key={m}>
              <Ume size={120} mood={m} interactive={false} />
              {m}
            </div>
          ))}
        </div>
      </section>

      <section>
        <div id="sheet-ai" className="lab-stage lab-sheet" data-ground="ai">
          {MOODS.map((m) => (
            <div className="lab-cell" key={m}>
              <Ume size={120} mood={m} interactive={false} />
              {m}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2>Dock</h2>
        <div className="lab-controls">
          <button type="button" onClick={() => ume.hop()}>Hop</button>
          <button type="button" onClick={() => ume.react('excited', pickLine(lines.streakKept))}>Excited</button>
          <button type="button" onClick={() => ume.react('proud', pickLine(lines.milestone))}>Proud</button>
          <button type="button" onClick={() => ume.react('sleepy', undefined, 0)}>Sleepy</button>
          <button type="button" onClick={() => ume.react('idle')}>Idle</button>
          <button type="button" id="lab-rim-go" onClick={() => rim.current && ume.moveTo(rim.current)}>Sit on the rim</button>
        </div>
        <div style={{ marginTop: 'var(--s16)' }}>
          <div className="lab-rim" ref={rim} id="rim">
            Tray rim
          </div>
        </div>
      </section>

      <div className="lab-spacer">Scroll down to see the dock peek.</div>
      <UmeDock />
    </main>
  )
}
