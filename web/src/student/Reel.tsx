// The spin reel: four little slot windows, one per ballot option. Tapping Spin winds every
// window back a hair, then they all roll down through the entrees. They stop one at a time,
// top to bottom, each with a thunk: the world's landing sound, a small shake of the frame,
// a puff of sparks off the food and a reaction from the mascot. Once the last one lands the
// window opens into the real ballot rows, which are taller (they carry diet info).
// Tapping the reel (or the Spin button again) skips straight to the end.
// Reduced motion: nothing rolls or shakes; the four options fade in one by one, quickly.
import { animate, motion, motionValue, useReducedMotion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { sparkBurst } from '../celebrate'
import { ume } from '../mascot'
import type { PoolItem, SpinOption } from '../shared/api'
import { Leaf } from '../shared/icons'
import { copy } from '../shared/copy'
import { sound } from '../shared/sound'
import { themeStore } from '../theme/store'
import type { ThemeId } from '../theme/types'
import { FoodGlyph } from './FoodGlyph'
import { ChoiceRow } from './ChoiceRow'

/** Spinning row height in px. Matches --reel-row in vote.css. */
const ROW = 60
/** Rows each window rolls through before its option: the lower windows roll longer. */
const ROWS_FIRST = 12
const ROWS_STEP = 6
/** When each window stops, from the tap: 1.05s, then one every 0.48s. */
const FIRST_MS = 1050
const GAP_MS = 480
/** The wind-up: how far back the strips pull before they roll, and for how long. */
const WIND_PX = 16
const WIND_MS = 140
/** Fast, then slowing, but still moving when it hits the stop, so the landing reads as a thunk. */
const LAND_EASE = [0.3, 0.72, 0.55, 0.95] as const
/** The beat between the last landing and the ballot opening. */
const HOLD_MS = 380
/** Reduced motion: the gap between options fading in. */
const CALM_GAP_MS = 140
const TICK_GAP_MS = 45
const t = copy.student.spin

type Phase = 'idle' | 'spinning' | 'landed'
type PoolRow = Pick<PoolItem, 'item_id' | 'name'> & Partial<PoolItem>

interface Props {
  options: SpinOption[]
  /** Every entree, in the order the strips show them. */
  pool: PoolRow[]
  phase: Phase
  selected: string | null
  disabled?: boolean
  /** Goes up by one each time the student asks to skip the spin. */
  skip?: number
  onLanded: () => void
  onSelect: (id: string) => void
  onInfo: (option: SpinOption) => void
}

/** One window's filler: the pool from its own starting point, never the same item twice in a row. */
function buildStrip(pool: PoolRow[], options: SpinOption[], slot: number, length: number) {
  const source: PoolRow[] = pool.length > 1 ? pool : options
  if (!source.length) return []
  const rows: PoolRow[] = []
  let i = (slot * 5) % source.length
  let guard = 0
  while (rows.length < length && guard++ < length * 4) {
    const next = source[i % source.length]
    i++
    const last = rows[rows.length - 1]
    if (last && last.item_id === next.item_id && source.length > 1) continue
    rows.push(next)
  }
  // The row that passes just before the stop should not be the option itself.
  const other = source.find((s) => s.item_id !== options[slot]?.item_id)
  if (rows[0]?.item_id === options[slot]?.item_id && other) rows[0] = other
  return rows
}

/** The frame's little shake on each landing, in the world's own way. `k` scales it. */
function shakeFrames(world: ThemeId, k: number): Keyframe[] {
  if (world === 'asia') {
    // A hanko pressed down: the frame dips and squeezes, then springs back.
    return [{ transform: 'none' }, { transform: `translateY(${2 * k}px) scale(${1 - 0.008 * k})` }, { transform: `translateY(${-0.6 * k}px)` }, { transform: 'none' }]
  }
  if (world === 'medi') {
    // A tile set down: a quick side to side rattle.
    return [{ transform: 'none' }, { transform: `translateX(${-2.5 * k}px)` }, { transform: `translateX(${2 * k}px)` }, { transform: `translateX(${-1 * k}px)` }, { transform: 'none' }]
  }
  // A loteria card slapped down: the table jumps.
  return [{ transform: 'none' }, { transform: `translateY(${3 * k}px) rotate(${-0.25 * k}deg)` }, { transform: `translateY(${-1.5 * k}px)` }, { transform: `translateY(${0.5 * k}px)` }, { transform: 'none' }]
}

function Idle() {
  return (
    <div className="reel reel--idle">
      <p className="reel__idle-text">{t.idle}</p>
    </div>
  )
}

function Ghost({ item, disc }: { item: PoolRow; disc?: boolean }) {
  return (
    <span className="reel__ghost">
      {disc ? (
        <span className="glyph-disc glyph-disc--entree reel__disc">
          <FoodGlyph id={item.item_id} />
        </span>
      ) : (
        <FoodGlyph id={item.item_id} />
      )}
      <span className="reel__name">{item.name}</span>
      {item.diet?.includes('vegetarian') && (
        <span className="reel__veg">
          <Leaf />
        </span>
      )}
    </span>
  )
}

export function Reel({ options, pool, phase, selected, disabled, skip = 0, onLanded, onSelect, onInfo }: Props) {
  const reduce = useReducedMotion()
  const strips = useMemo(() => options.map((_, i) => buildStrip(pool, options, i, ROWS_FIRST + i * ROWS_STEP)), [pool, options])
  // One strip offset per window. A strip starts rolled up its full length and rolls down to 0,
  // where its option (the first row) fills the window.
  const ys = useMemo(() => strips.map((s) => motionValue(-s.length * ROW)), [strips])
  const rootRef = useRef<HTMLDivElement>(null)
  const slotRefs = useRef<(HTMLDivElement | null)[]>([])
  const groupRef = useRef<HTMLDivElement>(null)
  const run = useRef({ started: false, landed: 0, finished: false, lastTick: 0, rows: [] as number[] })
  const stops = useRef<(() => void)[]>([])
  const landedRef = useRef(onLanded)
  useEffect(() => {
    landedRef.current = onLanded
  })

  const spinning = phase !== 'idle'
  const count = options.length
  // How many windows have stopped, and whether the ballot has opened.
  const [landed, setLanded] = useState(0)
  const [open, setOpen] = useState(false)

  const stopAll = () => {
    stops.current.forEach((s) => s())
    stops.current = []
  }

  const impact = (i: number, last: boolean) => {
    sound.reveal(i, last)
    if (!reduce) {
      const frame = rootRef.current?.closest<HTMLElement>('.lacquer') ?? rootRef.current
      frame?.animate(shakeFrames(themeStore.get(), last ? 1.5 : 1), { duration: last ? 340 : 260, easing: 'cubic-bezier(0.3, 0.7, 0.4, 1)' })
      const disc = slotRefs.current[i]?.querySelector<HTMLElement>('.reel__disc')
      if (disc) sparkBurst(disc)
    }
    if (last) ume.react('excited')
    else if (i === 0) ume.react('surprised')
    else ume.hop()
  }

  /** The end of the reveal: a short beat, then the ballot opens and the parent hears about it. */
  const finish = () => {
    const r = run.current
    if (r.finished) return
    r.finished = true
    const id = window.setTimeout(() => {
      setOpen(true)
      landedRef.current()
    }, reduce ? CALM_GAP_MS : HOLD_MS)
    stops.current.push(() => window.clearTimeout(id))
  }

  /** Window `i` stops. Windows stop in order, so this only ever moves forward. */
  const landSlot = (i: number) => {
    const r = run.current
    if (r.finished || i < r.landed) return
    r.landed = i + 1
    setLanded(i + 1)
    const last = i + 1 >= count
    impact(i, last)
    if (last) finish()
  }

  /** Skip: every window stops where it will end up, with one landing for all of them. */
  const skipNow = () => {
    const r = run.current
    if (!r.started || r.finished) return
    stopAll()
    ys.forEach((mv) => mv.set(0))
    r.landed = count
    setLanded(count)
    impact(count - 1, true)
    finish()
  }
  const skipRef = useRef(skipNow)
  useEffect(() => {
    skipRef.current = skipNow
  })

  useEffect(() => {
    if (!spinning || run.current.started || !count) return
    run.current = { started: true, landed: 0, finished: false, lastTick: 0, rows: strips.map((s) => s.length) }
    if (reduce) {
      ys.forEach((mv) => mv.set(0))
      for (let i = 0; i < count; i++) {
        const id = window.setTimeout(() => landSlot(i), CALM_GAP_MS * (i + 1))
        stops.current.push(() => window.clearTimeout(id))
      }
    } else {
      sound.spinUp()
      ys.forEach((mv, i) => {
        const from = -strips[i].length * ROW
        const ms = FIRST_MS + i * GAP_MS
        mv.set(from)
        // Tick as rows pass, but only for the next window due to stop: the ticks slow as it does.
        const off = mv.on('change', (v) => {
          const r = run.current
          if (r.landed !== i) return
          const row = Math.round(-v / ROW)
          if (row === r.rows[i]) return
          r.rows[i] = row
          const now = performance.now()
          if (now - r.lastTick > TICK_GAP_MS) {
            r.lastTick = now
            sound.tick()
          }
        })
        const controls = animate(mv, [from, from - WIND_PX, 0], {
          duration: ms / 1000,
          times: [0, WIND_MS / ms, 1],
          ease: ['easeOut', LAND_EASE],
          onComplete: () => landSlot(i),
        })
        stops.current.push(() => {
          controls.stop()
          off()
        })
      })
    }
    // If the tab is hidden mid-spin the animations pause; this makes sure the ballot still opens.
    const safety = window.setTimeout(() => skipRef.current(), FIRST_MS + count * GAP_MS + 1500)
    stops.current.push(() => window.clearTimeout(safety))
    // landSlot and friends read refs only; the strips are frozen for the spin.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinning, count])

  // Stop timers and animations if the reel goes away mid-spin.
  useEffect(
    () => () => {
      stops.current.forEach((s) => s())
      stops.current = []
    },
    [],
  )

  // A skip request from the parent (the Spin button tapped again).
  useEffect(() => {
    if (skip > 0) skipRef.current()
  }, [skip])

  // If the parent already counts the reel as landed (say it remounted), open it right away.
  useEffect(() => {
    if (phase === 'landed' && !open && !run.current.started) setOpen(true)
  }, [phase, open])

  // Hand keyboard and screen reader focus to the first choice once the ballot opens.
  useEffect(() => {
    if (open) groupRef.current?.querySelector<HTMLButtonElement>('.choice__main')?.focus({ preventScroll: true })
  }, [open])

  if (!spinning || !count) return <Idle />

  // Windows still rolling: a tap anywhere on the reel skips to the end.
  const rolling = landed < count
  return (
    <motion.div
      ref={rootRef}
      className={`reel reel--slots${open ? ' reel--open' : ''}${reduce ? ' reel--calm' : ''}`}
      initial={false}
      animate={{ height: open ? 'auto' : ROW * count }}
      transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 30 }}
      onClick={rolling ? () => skipRef.current() : undefined}
    >
      {open ? (
        <div className="reel__choices" role="group" aria-label={t.choices} ref={groupRef}>
          {options.map((o) => (
            <ChoiceRow
              key={o.item_id}
              item_id={o.item_id}
              name={o.name}
              facts={o}
              on={selected === o.item_id}
              disabled={disabled}
              onPick={() => onSelect(o.item_id)}
              onInfo={() => onInfo(o)}
            />
          ))}
        </div>
      ) : (
        <div className="reel__slots" aria-hidden="true">
          {options.map((o, i) => (
            <div
              className={`reel__slot${i < landed ? ' reel__slot--landed' : ''}`}
              key={o.item_id}
              ref={(el) => {
                slotRefs.current[i] = el
              }}
            >
              <motion.div className="reel__strip" style={{ y: ys[i] }}>
                <div className="reel__row reel__row--final">
                  <Ghost item={o} disc />
                </div>
                {strips[i].map((p, k) => (
                  <div className="reel__row" key={k}>
                    <Ghost item={p} />
                  </div>
                ))}
              </motion.div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  )
}
