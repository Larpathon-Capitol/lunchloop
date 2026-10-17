// The spin reel: a column of every entree that spins on a spring, ticks as rows pass,
// and lands with today's four choices filling the window. The last rows of the strip are
// the ballot itself, so they become tappable the moment the reel reaches them, while the
// spring finishes its one small overshoot. Once it rests, the window opens to fit the
// ballot rows, which are taller than the spinning rows (they carry diet info).
import { animate, motion, useMotionValue, useMotionValueEvent, useReducedMotion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { PoolItem, SpinOption } from '../shared/api'
import { Leaf } from '../shared/icons'
import { copy } from '../shared/copy'
import { sound } from '../shared/sound'
import { FoodGlyph } from './FoodGlyph'
import { reelSpring } from './springs'
import { ChoiceRow } from './ChoiceRow'

const FILL = 40
/** Rows visible in the window while spinning, one per ballot option. */
const WINDOW = 4
/** Spinning row height in px. Matches --reel-row in student.css. */
const ROW = 60
const TICK_GAP_MS = 40
const t = copy.student.spin

type Phase = 'idle' | 'spinning' | 'landed'

interface Props {
  options: SpinOption[]
  /** Every entree, in the order the strip shows them. */
  pool: (Pick<PoolItem, 'item_id' | 'name'> & Partial<PoolItem>)[]
  phase: Phase
  selected: string | null
  disabled?: boolean
  onLanded: () => void
  onSelect: (id: string) => void
  onInfo: (option: SpinOption) => void
}

/** Filler rows: the pool in order, repeated to fill, never the same item twice in a row. */
function buildFiller(pool: Props['pool'], options: SpinOption[]) {
  const source: Props['pool'] = pool.length > 1 ? pool : options
  if (!source.length) return []
  const rows: Props['pool'] = []
  let i = 0
  while (rows.length < FILL) {
    const next = source[i % source.length]
    i++
    const last = rows[rows.length - 1]
    if (last && last.item_id === next.item_id && source.length > 1) continue
    rows.push(next)
  }
  // Keep the row just above the landing window different from the first choice.
  const other = source.find((s) => s.item_id !== options[0]?.item_id)
  if (rows[FILL - 1].item_id === options[0]?.item_id && other) rows[FILL - 1] = other
  return rows
}

function Idle() {
  return (
    <div className="reel reel--idle">
      <p className="reel__idle-text">{t.idle}</p>
    </div>
  )
}

export function Reel({ options, pool, phase, selected, disabled, onLanded, onSelect, onInfo }: Props) {
  const reduce = useReducedMotion()
  const filler = useMemo(() => buildFiller(pool, options), [pool, options])
  const y = useMotionValue(0)
  const rowRef = useRef<HTMLDivElement>(null)
  const groupRef = useRef<HTMLDivElement>(null)
  const state = useRef({ row: 0, lastTick: 0, landed: false, target: 0 })
  const landedRef = useRef(onLanded)
  useEffect(() => {
    landedRef.current = onLanded
  })

  const spinning = phase !== 'idle'
  const live = phase === 'landed'
  // True once the spring has come to rest: the filler goes and the window opens up.
  const [open, setOpen] = useState(false)

  /** Runs once per spin, however many times the spring or StrictMode calls it. */
  const land = () => {
    const s = state.current
    if (s.landed) return
    s.landed = true
    sound.land()
    landedRef.current()
  }

  useMotionValueEvent(y, 'change', (v) => {
    const s = state.current
    const h = rowRef.current?.offsetHeight ?? 1
    const row = Math.round(-v / h)
    if (row !== s.row) {
      s.row = row
      const now = performance.now()
      if (now - s.lastTick > TICK_GAP_MS && !s.landed) {
        s.lastTick = now
        sound.tick()
      }
    }
    if (s.target && v <= s.target) land()
  })

  useEffect(() => {
    if (!spinning || state.current.landed || !options.length) return
    const h = rowRef.current?.offsetHeight ?? 0
    const target = -filler.length * h
    state.current = { row: 0, lastTick: 0, landed: false, target }
    y.set(0)
    if (reduce || !h) {
      y.set(target)
      land()
      setOpen(true)
      return
    }
    const controls = animate(y, target, {
      ...reelSpring,
      onComplete: () => {
        land()
        setOpen(true)
      },
    })
    return () => controls.stop()
    // `land` reads refs only; options and filler are frozen for the spin.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinning, reduce, y])

  // Hand keyboard and screen reader focus to the first choice once the reel lands.
  useEffect(() => {
    if (live) groupRef.current?.querySelector<HTMLButtonElement>('.choice__main')?.focus({ preventScroll: true })
  }, [live])

  if (!spinning || !options.length) return <Idle />

  const ghost = (o: Props['pool'][number]) => (
    <span className="reel__ghost">
      <FoodGlyph id={o.item_id} />
      <span className="reel__name">{o.name}</span>
      {o.diet?.includes('vegetarian') && (
        <span className="reel__veg">
          <Leaf />
        </span>
      )}
    </span>
  )

  return (
    <motion.div
      className={`reel${live ? ' reel--live' : ''}${open ? ' reel--open' : ''}`}
      initial={false}
      animate={{ height: open ? 'auto' : ROW * WINDOW }}
      transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 30 }}
    >
      {/* Dropping the filler and zeroing y in the same render keeps the ballot exactly where it is. */}
      <motion.div className="reel__strip" style={{ y: open ? 0 : y }}>
        {!open && (
          <div aria-hidden="true">
            {filler.map((o, i) => (
              <div className="reel__row" key={i} ref={i === 0 ? rowRef : undefined}>
                {ghost(o)}
              </div>
            ))}
          </div>
        )}
        {live ? (
          <div className="reel__choices" role="group" aria-label={t.choices} ref={groupRef}>
            {options.map((o) => (
              <ChoiceRow
                key={o.item_id}
                item_id={o.item_id}
                name={o.name}
                facts={o}
                on={selected === o.item_id}
                disabled={disabled}
                popIn={!reduce}
                onPick={() => onSelect(o.item_id)}
                onInfo={() => onInfo(o)}
              />
            ))}
          </div>
        ) : (
          <div aria-hidden="true">
            {options.map((o) => (
              <div className="reel__row" key={o.item_id}>
                {ghost(o)}
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}
