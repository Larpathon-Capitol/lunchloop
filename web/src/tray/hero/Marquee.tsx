// Tomorrow's real menu as printed tape running across the hero. Two strips on wide screens,
// one on phones. Nothing shows until the menu has loaded; it never invents items.
import { motion } from 'framer-motion'
import { heroCopy } from './copy'

/** Props for the menu tape. */
export interface MarqueeProps {
  /** Food names from tomorrow's tray, in menu order. Renders nothing when empty. */
  items: readonly string[]
  /** Second strip running the other way (wide screens). */
  rows?: 1 | 2
  reduce: boolean
}

function Strip({ items, reverse, reduce }: { items: readonly string[]; reverse?: boolean; reduce: boolean }) {
  // Repeat until one copy is wide enough, then double it so a -50% loop is seamless.
  const base: string[] = []
  while (base.length < 10) base.push(...items)
  const run = [...base, ...base]
  return (
    <div className={reverse ? 'tape tape--b' : 'tape tape--a'}>
      <div className={reduce ? 'tape__run is-still' : 'tape__run'}>
        {run.map((name, i) => (
          <span className="tape__item" key={i}>
            <span className="tape__dot" />
            {name}
          </span>
        ))}
      </div>
    </div>
  )
}

export function Marquee({ items, rows = 1, reduce }: MarqueeProps) {
  if (items.length === 0) return null
  return (
    <motion.div
      className={`tapes tapes--${rows}`}
      role="region"
      aria-label={heroCopy.menuLabel}
      initial={reduce ? false : { opacity: 0, y: 30, rotate: 0 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 30, mass: 1, delay: 0.5 }}
    >
      {/* The visible tape repeats names; screen readers get the list once. */}
      <ul className="visually-hidden">
        {items.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
      <div aria-hidden="true">
        <Strip items={items} reduce={reduce} />
        {rows === 2 && <Strip items={[...items].reverse()} reverse reduce={reduce} />}
      </div>
    </motion.div>
  )
}
