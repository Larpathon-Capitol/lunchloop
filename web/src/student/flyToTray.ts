// A pick's little food disc hops from where it was tapped into its compartment on the 3D tray,
// lands with a small overshoot and a ring flash, then sparks. DOM only, transform and opacity.
import { sparkBurst } from '../celebrate/burst'
import { prefersReducedMotion } from '../celebrate/petals'
import { trayProjector, type Component } from '../tray/store'

/** Resolve a CSS color expression like 'var(--g-fruit)' to a real color string. */
export function resolveColor(expr: string, fallback = '#fb6f92'): string {
  const m = /^var\((--[\w-]+)/.exec(expr.trim())
  if (!m) return expr || fallback
  return getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim() || fallback
}

/** Fly a disc from a viewport rect to the compartment. Resolves when it has landed (or right away when it can't fly). */
export function flyToTray(from: DOMRect, component: Component, color: string): Promise<void> {
  const target = trayProjector.compartment(component) ?? trayProjector.tray()
  const fill = resolveColor(color)
  if (prefersReducedMotion() || !target) {
    sparkBurst({ x: from.left + from.width / 2, y: from.top + from.height / 2 }, { colors: [fill] })
    return Promise.resolve()
  }
  const size = 30
  const x0 = from.left + from.width / 2 - size / 2
  const y0 = from.top + from.height / 2 - size / 2
  const x1 = target.left + target.width / 2 - size / 2
  const y1 = target.top + target.height / 2 - size / 2
  // The arc's peak sits above both ends, so it reads as a toss rather than a slide.
  const peak = Math.min(y0, y1) - Math.max(60, Math.abs(x1 - x0) * 0.25)
  const mid = (a: number, b: number) => (a + b) / 2

  const disc = document.createElement('span')
  disc.setAttribute('aria-hidden', 'true')
  Object.assign(disc.style, {
    position: 'fixed',
    left: '0',
    top: '0',
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: '50%',
    background: fill,
    boxShadow: '0 0 0 3px #fff, 0 6px 14px rgba(58, 22, 38, 0.22)',
    zIndex: '8500',
    pointerEvents: 'none',
    willChange: 'transform, opacity',
  })
  document.body.appendChild(disc)

  const at = (x: number, y: number, s: number) => `translate(${x}px, ${y}px) scale(${s})`
  const flight = disc.animate(
    [
      { transform: at(x0, y0, 0.6), opacity: 0 },
      { transform: at(x0, y0 - 10, 1.1), opacity: 1, offset: 0.12 },
      { transform: at(mid(x0, x1), peak, 1), offset: 0.55 },
      { transform: at(x1, y1, 0.8), offset: 0.88 },
      { transform: at(x1, y1, 1.12), offset: 0.95 },
      { transform: at(x1, y1, 0.2), opacity: 0 },
    ],
    { duration: 620, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
  )

  return new Promise((resolve) => {
    const done = () => {
      disc.remove()
      const cx = target.left + target.width / 2
      const cy = target.top + target.height / 2
      ring(cx, cy, fill)
      sparkBurst({ x: cx, y: cy }, { colors: [fill, resolveColor('var(--pink-4)', '#ff8fab')] })
      resolve()
    }
    flight.onfinish = done
    flight.oncancel = done
  })
}

/** The slot ring flash where a pick lands. */
function ring(x: number, y: number, color: string) {
  const el = document.createElement('span')
  el.setAttribute('aria-hidden', 'true')
  const r = 22
  Object.assign(el.style, {
    position: 'fixed',
    left: `${x - r}px`,
    top: `${y - r}px`,
    width: `${r * 2}px`,
    height: `${r * 2}px`,
    borderRadius: '50%',
    border: `3px solid ${color}`,
    zIndex: '8500',
    pointerEvents: 'none',
  })
  document.body.appendChild(el)
  const a = el.animate(
    [
      { transform: 'scale(0.5)', opacity: 0.8 },
      { transform: 'scale(2.2)', opacity: 0 },
    ],
    { duration: 480, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
  )
  a.onfinish = () => el.remove()
}
