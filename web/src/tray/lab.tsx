import { StrictMode, Suspense, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { GROUP_LABELS, LazyTrayScene, type GroupId, type TrayMode } from './index'
import './lab.css'

/** Standalone page for the tray prototype: /tray-lab.html */
function Lab() {
  const [mode, setMode] = useState<TrayMode>('hero')
  const [filled, setFilled] = useState<Partial<Record<GroupId, boolean>>>({})
  const [last, setLast] = useState<GroupId | null>(null)
  const [reduced, setReduced] = useState<boolean | undefined>(undefined)

  const select = (g: GroupId) => {
    setFilled((f) => ({ ...f, [g]: !f[g] }))
    setLast(g)
  }

  return (
    <div className="lab">
      <div className="lab-bar">
        <div className="lab-seg" role="group" aria-label="Mode">
          {(['hero', 'pick'] as const).map((m) => (
            <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)}>
              {m === 'hero' ? 'Hero' : 'Pick'}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setFilled({})}>
          Clear
        </button>
        <label>
          <input
            type="checkbox"
            checked={reduced ?? false}
            onChange={(e) => setReduced(e.target.checked ? true : undefined)}
          />
          Reduce motion
        </label>
      </div>

      <Suspense fallback={null}>
        <LazyTrayScene
          mode={mode}
          filled={filled}
          reducedMotion={reduced}
          onEnter={() => setMode('pick')}
          onSelectGroup={select}
        />
      </Suspense>

      <p className="lab-status" aria-live="polite">
        {mode === 'hero' ? (
          'Tap the tray to start'
        ) : last ? (
          <>
            <strong>{GROUP_LABELS[last]}</strong> {filled[last] ? 'added' : 'removed'}
          </>
        ) : (
          'Pick a food group'
        )}
      </p>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Lab />
  </StrictMode>,
)
