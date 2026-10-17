// The world picker: three radio pills, each with a live mini mascot. Used full-size on the
// hero and compact (mascots only) in the game header. Arrow keys move and switch, as a radio group.
import { motion, useReducedMotion } from 'framer-motion'
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentType,
  type JSX,
  type KeyboardEvent,
} from 'react'
import { Ume, type UmeProps } from '../mascot'
import { THEME_INFO } from './registry'
import { themeStore, useThemeId } from './store'
import { switchTheme } from './switch'
import { THEMES, type MascotId, type ThemeId } from './types'
import './switcher.css'

const COPY = {
  group: 'Pick your table',
} as const

/** How long the first-visit breathing ring runs if the student does not pick. */
const NUDGE_MS = 8000

/** The mascotId prop is added to Ume by another change, so type it here. */
const MiniMascot = Ume as ComponentType<UmeProps & { mascotId?: MascotId }>

interface Point {
  x: number
  y: number
}

/** Plays the animated world switch, wiping out from the tapped point. */
function switchWorld(id: ThemeId, origin?: Point): void {
  void switchTheme(id, origin)
}

export interface ThemeSwitcherProps {
  /** Small version for the game header: mascots only, label shown for the current world. */
  compact?: boolean
  className?: string
}

export function ThemeSwitcher({ compact = false, className }: ThemeSwitcherProps): JSX.Element {
  const current = useThemeId()
  const reduced = !!useReducedMotion()
  const uid = useId()
  const pillId = `${uid}-pill`
  const buttons = useRef<Array<HTMLButtonElement | null>>([])
  // Gentle first-visit highlight until the student picks or the timer ends.
  const [nudge, setNudge] = useState(() => !themeStore.chosen())

  useEffect(() => {
    if (!nudge) return
    const t = window.setTimeout(() => setNudge(false), NUDGE_MS)
    return () => window.clearTimeout(t)
  }, [nudge])

  const mascotSize = compact ? 30 : 40

  function choose(id: ThemeId, el: HTMLElement | null) {
    setNudge(false)
    let origin: Point | undefined
    if (el) {
      const r = el.getBoundingClientRect()
      origin = { x: r.left + r.width / 2, y: r.top + r.height / 2 }
    }
    switchWorld(id, origin)
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const i = THEMES.indexOf(current)
    let next = i
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        next = (i + 1) % THEMES.length
        break
      case 'ArrowLeft':
      case 'ArrowUp':
        next = (i - 1 + THEMES.length) % THEMES.length
        break
      case 'Home':
        next = 0
        break
      case 'End':
        next = THEMES.length - 1
        break
      default:
        return
    }
    e.preventDefault()
    const el = buttons.current[next]
    el?.focus()
    choose(THEMES[next], el)
  }

  const classes = ['ll-switcher', compact ? 'll-switcher--compact' : '', className ?? '']
    .filter(Boolean)
    .join(' ')

  return (
    <div className={classes}>
      {!compact && (
        <span className="ll-switcher__heading" aria-hidden="true">
          {COPY.group}
        </span>
      )}
      <div
        className="ll-switcher__track"
        role="radiogroup"
        aria-label={COPY.group}
        data-nudge={nudge ? 'on' : undefined}
        onKeyDown={onKeyDown}
      >
        {THEMES.map((id, i) => {
          const info = THEME_INFO[id]
          const checked = id === current
          return (
            <motion.button
              key={id}
              ref={(el) => {
                buttons.current[i] = el
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              tabIndex={checked ? 0 : -1}
              title={compact ? info.label : undefined}
              className="ll-switcher__option"
              onClick={(e) => choose(id, e.currentTarget)}
              whileTap={
                reduced
                  ? undefined
                  : { scale: 0.94, transition: { type: 'spring', stiffness: 600, damping: 18, mass: 0.6 } }
              }
            >
              {checked && (
                <motion.span
                  layoutId={pillId}
                  className="ll-switcher__pill"
                  transition={
                    reduced
                      ? { duration: 0 }
                      : { type: 'spring', stiffness: 380, damping: 22, mass: 0.8 }
                  }
                />
              )}
              <span
                className="ll-switcher__mascot"
                style={{ width: mascotSize, height: mascotSize }}
                aria-hidden="true"
              >
                <MiniMascot mascotId={info.mascot} interactive={false} size={mascotSize} />
              </span>
              {compact ? (
                <span className="ll-switcher__sr">{info.label}</span>
              ) : (
                <span className="ll-switcher__text">
                  <span className="ll-switcher__label">{info.label}</span>
                  <span className="ll-switcher__name">{info.mascotName}</span>
                </span>
              )}
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
