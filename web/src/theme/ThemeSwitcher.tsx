// The world picker: three radio pills, each with a live mini mascot. Used full-size on the
// hero and compact (mascots only) in the game header. Arrow keys move and switch, as a radio
// group. On phones the header collapses it to one mascot button with a small menu.
import { motion, useReducedMotion } from 'framer-motion'
import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentType,
  type JSX,
  type KeyboardEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { Ume, type UmeProps } from '../mascot'
import { THEME_INFO } from './registry'
import { themeStore, useThemeId } from './store'
import { switchTheme } from './switch'
import { THEMES, type MascotId, type ThemeId } from './types'
import './switcher.css'

const COPY = {
  group: 'Pick your table',
  menuButton: (world: string) => `Pick your table. Now: ${world}`,
} as const

const posterUrl = (id: MascotId) => `${import.meta.env.BASE_URL}mascots/${id}.webp`

/** Phones get one mascot button that opens a small menu, so the bar never overflows. */
const NARROW_QUERY = '(max-width: 520px)'

function subscribeNarrow(cb: () => void) {
  const mq = window.matchMedia(NARROW_QUERY)
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}

function useNarrow(): boolean {
  return useSyncExternalStore(
    subscribeNarrow,
    () => window.matchMedia(NARROW_QUERY).matches,
    () => false,
  )
}

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
  /** With compact: on phones, collapse to one button with the current mascot and a menu. */
  collapse?: boolean
  className?: string
}

function pointOf(el: HTMLElement): Point {
  const r = el.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}

/** The phone version: the current mascot on a button, the three worlds in a menu under it. */
function WorldMenu({ className }: { className?: string }): JSX.Element {
  const current = useThemeId()
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  // Where the menu hangs: under the trigger, right edges lined up. Fixed, so it can sit over the page.
  const [at, setAt] = useState({ top: 0, right: 0 })
  const items = useRef<Array<HTMLButtonElement | null>>([])
  const menuId = `${useId()}-menu`

  useEffect(() => {
    if (!open) return
    items.current[THEMES.indexOf(current)]?.focus()
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (!wrap.current?.contains(t) && !menu.current?.contains(t)) setOpen(false)
    }
    const shut = () => setOpen(false)
    document.addEventListener('pointerdown', onDown)
    window.addEventListener('scroll', shut, { passive: true })
    window.addEventListener('resize', shut)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      window.removeEventListener('scroll', shut)
      window.removeEventListener('resize', shut)
    }
    // Focus the checked world only when the menu opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function close(refocus: boolean) {
    setOpen(false)
    if (refocus) trigger.current?.focus()
  }

  function pick(id: ThemeId) {
    close(true)
    if (id !== current) switchWorld(id, trigger.current ? pointOf(trigger.current) : undefined)
  }

  function onMenuKey(e: KeyboardEvent<HTMLDivElement>) {
    const i = items.current.findIndex((el) => el === document.activeElement)
    let next = -1
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = (i + 1) % THEMES.length
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = (i - 1 + THEMES.length) % THEMES.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = THEMES.length - 1
    else if (e.key === 'Escape') {
      e.preventDefault()
      close(true)
      return
    } else if (e.key === 'Tab') {
      setOpen(false)
      return
    } else return
    e.preventDefault()
    items.current[next]?.focus()
  }

  const info = THEME_INFO[current]
  return (
    <div ref={wrap} className={`ll-worldmenu${className ? ` ${className}` : ''}`} data-open={open || undefined}>
      <button
        ref={trigger}
        type="button"
        className="ll-worldmenu__trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={COPY.menuButton(info.label)}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          setAt({
            top: r.bottom + 10,
            right: Math.max(8, window.innerWidth - r.right - 4),
          })
          setOpen((o) => !o)
        }}
      >
        <span className="ll-worldmenu__face" aria-hidden="true">
          <MiniMascot mascotId={info.mascot} interactive={false} size={32} />
        </span>
        <svg
          className="ll-worldmenu__chev"
          width="12"
          height="12"
          viewBox="0 0 12 12"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M2.5 4.5L6 8L9.5 4.5" />
        </svg>
      </button>
      {open &&
        createPortal(
          <div
            ref={menu}
            id={menuId}
            className="ll-worldmenu__menu"
            role="menu"
            aria-label={COPY.group}
            style={{ top: at.top, right: at.right }}
            onKeyDown={onMenuKey}
          >
            {THEMES.map((id, i) => {
              const t = THEME_INFO[id]
              const checked = id === current
              return (
                <button
                  key={id}
                  ref={(el) => {
                    items.current[i] = el
                  }}
                  type="button"
                  role="menuitemradio"
                  aria-checked={checked}
                  tabIndex={checked ? 0 : -1}
                  className="ll-worldmenu__item"
                  onClick={() => pick(id)}
                >
                  {/* Still posters: the menu sits above the shared 3D mascot canvas. */}
                  <img className="ll-worldmenu__item-face" src={posterUrl(t.mascot)} alt="" draggable={false} />
                  <span className="ll-switcher__text">
                    <span className="ll-switcher__label">{t.label}</span>
                    <span className="ll-switcher__name">{t.mascotName}</span>
                  </span>
                  <svg
                    className="ll-worldmenu__check"
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <path d="M3 8.5L6.5 12L13 4.5" />
                  </svg>
                </button>
              )
            })}
          </div>,
          document.body,
        )}
    </div>
  )
}

export function ThemeSwitcher(props: ThemeSwitcherProps): JSX.Element {
  const narrow = useNarrow()
  if (props.compact && props.collapse && narrow) return <WorldMenu className={props.className} />
  return <SwitcherTrack {...props} />
}

function SwitcherTrack({ compact = false, className }: ThemeSwitcherProps): JSX.Element {
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
    switchWorld(id, el ? pointOf(el) : undefined)
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

  const classes = ['ll-switcher', compact ? 'll-switcher--compact' : '', className ?? ''].filter(Boolean).join(' ')

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
                  : {
                      scale: 0.94,
                      transition: {
                        type: 'spring',
                        stiffness: 600,
                        damping: 18,
                        mass: 0.6,
                      },
                    }
              }
            >
              {checked && (
                <motion.span
                  layoutId={pillId}
                  className="ll-switcher__pill"
                  transition={
                    reduced
                      ? { duration: 0 }
                      : {
                          type: 'spring',
                          stiffness: 380,
                          damping: 22,
                          mass: 0.8,
                        }
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
