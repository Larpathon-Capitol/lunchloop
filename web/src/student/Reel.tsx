// The spin reel: a column of menu items that spins on a spring, ticks as rows pass,
// and lands with today's three choices filling the window. The last three rows of the
// strip are the ballot itself, so they become tappable the moment the reel reaches
// them, while the spring finishes its one small overshoot.
import { animate, motion, useMotionValue, useMotionValueEvent, useReducedMotion } from 'framer-motion'
import { useEffect, useMemo, useRef } from 'react'
import type { SpinOption } from '../shared/api'
import { copy } from '../shared/copy'
import { sound } from '../shared/sound'
import { FoodGlyph } from './FoodGlyph'
import { reelSpring } from './springs'
import { ChoiceRow } from './ChoiceRow'

const FILL = 40
const TICK_GAP_MS = 40
const t = copy.student.spin

type Phase = 'idle' | 'spinning' | 'landed'

interface Props {
  options: SpinOption[]
  pool: { item_id: string; name: string }[]
  phase: Phase
  selected: string | null
  disabled?: boolean
  onLanded: () => void
  onSelect: (id: string) => void
  onInfo: (option: SpinOption) => void
}

/** Filler rows from real menu items, never the same item twice in a row. */
function buildFiller(pool: Props['pool'], options: SpinOption[]) {
  const source = pool.length > 1 ? pool : options
  if (!source.length) return []
  const rows: { item_id: string; name: string }[] = []
  let i = 0
  while (rows.length < FILL) {
    const next = source[(i * 7 + 3) % source.length]
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
      return
    }
    const controls = animate(y, target, { ...reelSpring, onComplete: land })
    return () => controls.stop()
    // `land` reads refs only; options and filler are frozen for the spin.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinning, reduce, y])

  // Hand keyboard and screen reader focus to the first choice once the reel lands.
  useEffect(() => {
    if (live) groupRef.current?.querySelector<HTMLButtonElement>('.choice__main')?.focus({ preventScroll: true })
  }, [live])

  if (!spinning || !options.length) return <Idle />

  return (
    <div className={live ? 'reel reel--live' : 'reel'}>
      <motion.div className="reel__strip" style={{ y }}>
        <div aria-hidden="true">
          {filler.map((o, i) => (
            <div className="reel__row" key={i} ref={i === 0 ? rowRef : undefined}>
              <span className="reel__ghost">
                <FoodGlyph id={o.item_id} />
                <span className="reel__name">{o.name}</span>
              </span>
            </div>
          ))}
        </div>
        {live ? (
          <div className="reel__choices" role="group" aria-label={t.choices} ref={groupRef}>
            {options.map((o) => (
              <ChoiceRow
                key={o.item_id}
                item_id={o.item_id}
                name={o.name}
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
                <span className="reel__ghost">
                  <FoodGlyph id={o.item_id} />
                  <span className="reel__name">{o.name}</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  )
}
