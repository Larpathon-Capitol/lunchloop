// Small horizontal bar charts for the kitchen. Plain HTML so they reflow on phones and
// every value is real text next to its bar (no legend to decode).

export type Tone = 'main' | 'usual' | 'warn' | 'good'

export interface BarRow {
  label: string
  value: number
  text: string
  tone: Tone
}

/** One labelled bar per row, all on the same scale. */
export function PairBars({ rows, size = 'sm' }: { rows: BarRow[]; size?: 'sm' | 'lg' }) {
  const max = Math.max(...rows.map((r) => r.value), 0)
  return (
    <ul className={`k-bars k-bars--${size}`}>
      {rows.map((r) => (
        <li key={r.label} className="k-bars__row">
          <span className="k-bars__label">{r.label}</span>
          <span className="k-bars__track" aria-hidden="true">
            <span
              className={`k-bars__fill k-bars__fill--${r.tone}`}
              style={{ width: max > 0 ? `${(r.value / max) * 100}%` : '0%' }}
            />
          </span>
          <span className="k-bars__val num">{r.text}</span>
        </li>
      ))}
    </ul>
  )
}
