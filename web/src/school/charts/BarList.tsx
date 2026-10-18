import type { ReactNode } from 'react'
import { motion } from 'framer-motion'

export interface Bar {
  id: string
  label: ReactNode
  /** 0 to 1 of the track. */
  fraction: number
  /** The bold number at the end of the row, already formatted. */
  value: ReactNode
  /** A quieter second number, already formatted. */
  sub?: ReactNode
  /** Drawn in the primary series color and the label set in bold. */
  lead?: boolean
  /** A small tag after the label, e.g. "Leading". */
  tag?: string
  /** Drawn in grey, for "skipped" and other not-a-choice rows. */
  muted?: boolean
}

const grow = { type: 'spring', stiffness: 170, damping: 26, mass: 0.9 } as const

/**
 * Horizontal bars with direct labels: name and number on one line, the bar under them.
 * The text is the accessible version of the chart; the bars themselves are hidden from
 * screen readers. Colors come from --bar-main / --bar-rest set by the caller's CSS.
 */
export function BarList({
  bars,
  reduce,
  dense = false,
  grid = !dense,
  className,
}: {
  bars: Bar[]
  reduce: boolean
  dense?: boolean
  /** Hairlines at 25, 50 and 75 percent of the track. On by default for full-size lists. */
  grid?: boolean
  className?: string
}) {
  return (
    <ul className={['c-bars', dense && 'c-bars--dense', className].filter(Boolean).join(' ')}>
      {bars.map((b) => {
        const f = Math.max(0, Math.min(1, b.fraction))
        return (
          <li key={b.id} className="c-bar" data-lead={b.lead || undefined} data-muted={b.muted || undefined}>
            <span className="c-bar__label">
              {b.label}
              {b.tag && <span className="c-bar__tag">{b.tag}</span>}
            </span>
            <span className="c-bar__nums">
              <span className="c-bar__value num">{b.value}</span>
              {b.sub != null && <span className="c-bar__sub num">{b.sub}</span>}
            </span>
            <span className={grid ? 'c-bar__track c-bar__track--grid' : 'c-bar__track'} aria-hidden="true">
              <motion.span
                className="c-bar__fill"
                initial={{ scaleX: reduce ? f : 0 }}
                animate={{ scaleX: f }}
                transition={reduce ? { duration: 0 } : grow}
              />
            </span>
          </li>
        )
      })}
    </ul>
  )
}
