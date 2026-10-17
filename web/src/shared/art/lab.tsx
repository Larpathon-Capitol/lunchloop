import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../base.css'
import { PlumSprig } from './PlumSprig'

const panel = (ground: 'washi' | 'ai') => ({
  background: `var(--${ground})`,
  color: ground === 'ai' ? 'var(--on-ai)' : 'var(--sumi)',
  padding: 'var(--s6)',
  display: 'flex',
  flexWrap: 'wrap' as const,
  alignItems: 'flex-start',
  gap: 'var(--s8)',
})

export function Lab() {
  const [run, setRun] = useState(0)
  return (
    <main style={{ fontFamily: 'var(--font-ui)' }}>
      {(['washi', 'ai'] as const).map((g) => (
        <section key={g} style={panel(g)}>
          {[120, 200, 320].map((w) => (
            <figure key={w} style={{ margin: 0, width: w }}>
              <PlumSprig variant="corner" ground={g} style={{ width: '100%', height: 'auto', display: 'block' }} />
              <figcaption style={{ fontSize: 'var(--text-sm)' }}>Corner, {w}px</figcaption>
            </figure>
          ))}
          <figure style={{ margin: 0, width: 360 }}>
            <PlumSprig variant="branch" ground={g} style={{ width: '100%', height: 'auto', display: 'block' }} />
            <figcaption style={{ fontSize: 'var(--text-sm)' }}>Branch, 360px</figcaption>
          </figure>
        </section>
      ))}
      <section style={{ ...panel('ai'), alignItems: 'center' }}>
        <figure style={{ margin: 0, width: 560 }}>
          <PlumSprig key={run} variant="branch" grow title="A plum branch in bloom" style={{ width: '100%', height: 'auto', display: 'block' }} />
          <figcaption style={{ fontSize: 'var(--text-sm)' }}>Branch, grow</figcaption>
        </figure>
        <button type="button" onClick={() => setRun((n) => n + 1)} style={{ minHeight: 'var(--touch)', padding: '0 var(--s4)' }}>
          Replay
        </button>
      </section>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(<Lab />)
