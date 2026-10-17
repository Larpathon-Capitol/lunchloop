import type { ComponentType, CSSProperties } from 'react'
import * as icons from './index'
import type { IconProps } from './Icon'

/* Dev-only sheet: every icon at 20, 24 and 40px, on washi and on indigo. */

const NAMES = [
  'Entree', 'Grain', 'Vegetable', 'Fruit', 'Milk',
  'Blossom', 'Seal', 'Coin', 'Tray', 'Ballot', 'Crystal', 'Calendar', 'Lantern', 'Badge',
  'SoundOn', 'SoundOff', 'Close', 'Back', 'Check', 'Skip', 'Info', 'Allergen', 'Lock', 'Share', 'Kitchen', 'Menu', 'Hand',
] as const

const SIZES = [20, 24, 40]

const sheet: CSSProperties = { fontFamily: 'var(--font-ui)', padding: 24, display: 'grid', gap: 24, background: 'var(--washi)' }
const panel = (bg: string, fg: string): CSSProperties => ({
  background: bg,
  color: fg,
  borderRadius: 'var(--radius)',
  padding: 16,
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
  gap: 12,
})
const cell: CSSProperties = { display: 'grid', gap: 6, justifyItems: 'start' }
const row: CSSProperties = { display: 'flex', alignItems: 'center', gap: 12, minHeight: 40 }
const label: CSSProperties = { fontSize: 12, opacity: 0.75 }

function Panel({ bg, fg, name }: { bg: string; fg: string; name: string }) {
  return (
    <section aria-label={name}>
      <h2 style={{ margin: '0 0 8px', fontSize: 16 }}>{name}</h2>
      <div style={panel(bg, fg)}>
        {NAMES.map((n) => {
          const C = (icons as unknown as Record<string, ComponentType<IconProps>>)[n]
          return (
            <div key={n} style={cell}>
              <div style={row}>
                {SIZES.map((s) => (
                  <C key={s} width={s} height={s} />
                ))}
              </div>
              <span style={label}>{n}</span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

export function IconSheet() {
  return (
    <div style={sheet}>
      <Panel bg="var(--washi)" fg="var(--sumi)" name="On washi" />
      <Panel bg="var(--ai)" fg="var(--on-ai)" name="On ai" />
    </div>
  )
}
