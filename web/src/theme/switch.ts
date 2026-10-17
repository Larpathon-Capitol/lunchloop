// The animated world switch. The new world wipes in as a circle from the tapped control
// (a view transition), the old one holds still underneath. Reduced motion gets a 200ms
// cross-fade; browsers without view transitions switch at once and the registered color
// tokens tween instead (see tokens.css).
import { sound } from '../shared/sound'
import { KITS } from './registry'
import { themeStore } from './store'
import type { ThemeId } from './types'
import './switcher.css'

const WIPE_MS = 700
const WIPE_EASE = 'cubic-bezier(0.65, 0, 0.35, 1)'

type ViewTransitionLike = {
  ready: Promise<void>
  finished: Promise<void>
}
type DocWithVT = Document & {
  startViewTransition?: (update: () => void | Promise<void>) => ViewTransitionLike
}

/** Writes the active world's pattern tile onto <html> as --pattern and --pattern-size. */
export function applyThemePattern(id: ThemeId = themeStore.get()) {
  if (typeof document === 'undefined') return
  const kit = KITS[id]
  const root = document.documentElement.style
  root.setProperty('--pattern', kit.pattern || 'none')
  root.setProperty('--pattern-size', kit.patternSize)
}

function reducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
}

// Gives React one beat to commit the new world before the new snapshot is taken. Rendering
// is paused inside a view transition update, so a frame callback alone may never come;
// the timer makes sure it settles.
function nextFrame() {
  return new Promise<void>((resolve) => {
    const done = () => resolve()
    requestAnimationFrame(done)
    setTimeout(done, 32)
  })
}

let running: Promise<void> | null = null

/**
 * Switch worlds with the circular wipe.
 * @param id the world to switch to
 * @param origin where the wipe starts, in viewport pixels (use the tapped control's center).
 *   Defaults to the middle of the viewport.
 * Resolves when the transition has finished (or right away when there is nothing to animate).
 */
export function switchTheme(id: ThemeId, origin?: { x: number; y: number }): Promise<void> {
  if (typeof document === 'undefined') {
    themeStore.set(id)
    return Promise.resolve()
  }
  if (id === themeStore.get()) {
    themeStore.set(id) // still records that the student picked a world
    return Promise.resolve()
  }
  // A second tap mid-wipe waits for the first to finish, then switches.
  if (running) return running.then(() => switchTheme(id, origin))

  const doc = document as DocWithVT
  const html = document.documentElement
  // The store listener below writes the new pattern tile.
  const commit = () => themeStore.set(id)

  sound.whoosh()

  if (typeof doc.startViewTransition !== 'function' || document.visibilityState === 'hidden') {
    commit()
    return Promise.resolve()
  }

  const calm = reducedMotion()
  const x = origin?.x ?? window.innerWidth / 2
  const y = origin?.y ?? window.innerHeight / 2
  // The new world starts clipped to a dot in CSS too (switcher.css), so it never shows whole
  // before the wipe animation below is attached.
  html.style.setProperty('--vt-x', `${x}px`)
  html.style.setProperty('--vt-y', `${y}px`)
  html.classList.add('theme-vt')
  if (calm) html.classList.add('theme-vt--fade')

  let vt: ViewTransitionLike
  try {
    vt = doc.startViewTransition.call(document, async () => {
      commit()
      await nextFrame()
    })
  } catch {
    html.classList.remove('theme-vt', 'theme-vt--fade')
    commit()
    return Promise.resolve()
  }

  // These reject when a transition is skipped; that only means no animation.
  vt.ready.catch(() => {})
  if (!calm) {
    vt.ready
      .then(() => {
        try {
          html.animate(
            { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(150vmax at ${x}px ${y}px)`] },
            { duration: WIPE_MS, easing: WIPE_EASE, pseudoElement: '::view-transition-new(root)', fill: 'both' },
          )
        } catch {
          // No pseudo-element animations here: fall back to the cross-fade.
          html.classList.add('theme-vt--fade')
        }
      })
      .catch(() => {})
  }

  const done = vt.finished
    .catch(() => {})
    .then(() => {
      html.classList.remove('theme-vt', 'theme-vt--fade')
      running = null
    })
  running = done
  return done
}

// Keep the tile in step on startup and when anything else sets the world directly.
applyThemePattern()
themeStore.subscribe(() => applyThemePattern())
