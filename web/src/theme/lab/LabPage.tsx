// A bench for the three worlds' art: every kit piece on one page, for the world picked above.
import { useMotionValue, useSpring } from 'framer-motion'
import { useState } from 'react'
import '../../shared/base.css'
import { KITS, THEME_INFO } from '../registry'
import { themeStore, useThemeId } from '../store'
import { THEMES } from '../types'

export function LabPage() {
  const id = useThemeId()
  const kit = KITS[id]
  const [seal, setSeal] = useState(false)
  const [grow, setGrow] = useState(0)
  const [curtain, setCurtain] = useState(0)
  const [ready, setReady] = useState(false)
  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const px = useSpring(mx, { stiffness: 120, damping: 20 })
  const py = useSpring(my, { stiffness: 120, damping: 20 })
  return (
    <div
      onPointerMove={(e) => {
        mx.set(e.clientX / window.innerWidth - 0.5)
        my.set(e.clientY / window.innerHeight - 0.5)
      }}
      style={{ minHeight: '100vh', background: 'var(--pink-1, #ffe5ec)', color: 'var(--ink, #3a1626)', fontFamily: 'var(--font-ui)' }}
    >
      <div style={{ position: 'relative', height: '70vh', overflow: 'hidden' }}>
        <kit.HeroBackdrop px={px} py={py} />
        <h1 style={{ position: 'relative', fontFamily: 'var(--font-display)', fontSize: 64, margin: 0, padding: 24 }}>
          Lunch you'll actually eat.
        </h1>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: 16 }}>
        {THEMES.map((t) => (
          <button key={t} aria-pressed={t === id} onClick={() => themeStore.set(t)}>
            {THEME_INFO[t].label}
          </button>
        ))}
        <button onClick={() => setSeal((s) => !s)}>seal</button>
        <button onClick={() => setGrow((g) => g + 1)}>milestone</button>
        <button
          onClick={() => {
            setReady(false)
            setCurtain((c) => c + 1)
            window.setTimeout(() => setReady(true), 900)
          }}
        >
          curtain
        </button>
      </div>
      <div style={{ position: 'relative', height: 64, background: 'var(--field)', color: 'var(--on-field)' }}>
        <kit.HeaderBand />
        <span style={{ position: 'relative', padding: 16, display: 'inline-block', fontWeight: 800 }}>Header band</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 24, padding: 24 }}>
        <div style={{ position: 'relative', height: 220, background: 'var(--surface)' }}>
          <kit.Corner />
        </div>
        <div style={{ display: 'grid', placeItems: 'center', height: 220, background: 'var(--surface)' }}>
          <kit.Seal visible={seal} size={120} />
        </div>
        <div style={{ height: 220, backgroundImage: kit.pattern, backgroundSize: kit.patternSize }} />
        <div style={{ position: 'relative', height: 320, background: 'var(--field)' }}>
          <kit.Milestone key={grow} grow />
        </div>
      </div>
      {curtain > 0 && <kit.Curtain key={curtain} ready={ready} onDone={() => setCurtain(0)} />}
    </div>
  )
}
