import { trayProjector } from '../../store'

/*
 * Where the foods stand, in viewport pixels: a loose row on the floor along the bottom of the
 * hero (the tablecloth, the wave cloth, the tiled floor), smaller and fewer on phones.
 * Anything that must stay readable or tappable (tray, mascot, words, button, stickers) is measured
 * and any spot that would cover it is dropped.
 */

export interface Spot {
  /** Center x of the food's footprint. */
  x: number
  /** Where its base touches the table. */
  y: number
  /** On-screen size (its largest dimension), in pixels. */
  size: number
}

export interface Layout {
  spots: Spot[]
  wide: boolean
}

type Rect = { left: number; top: number; right: number; bottom: number }

const WIDE = 900

function rectOf(el: Element, pad = 0): Rect | null {
  const r = el.getBoundingClientRect()
  if (r.width < 1 || r.height < 1) return null
  return { left: r.left - pad, top: r.top - pad, right: r.right + pad, bottom: r.bottom + pad }
}

const overlaps = (a: Rect, b: Rect) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top

/** Small seeded wobble so the row is not a ruler line. */
const jitter = (i: number, amp: number) => Math.sin(i * 12.9898 + 4.1) * amp

export function computeLayout(W: number, H: number, maxCount: number): Layout {
  const wide = W >= WIDE
  const avoid: Rect[] = []
  const tray = trayProjector.tray()
  if (tray) avoid.push({ left: tray.left + tray.width * 0.04, top: tray.top, right: tray.right - tray.width * 0.04, bottom: tray.bottom - 6 })
  // Plus the world backdrops' own props near the floor (the loteria cards, the shelf goods).
  for (const el of document.querySelectorAll('.home__mascot, .home__switch > *, .sticker, .amx-card, .ka-good')) {
    const r = rectOf(el, 6)
    if (r) avoid.push(r)
  }

  // Words, button and links: keep clear of each of them.
  for (const el of document.querySelectorAll('.home__copy > *')) {
    const r = rectOf(el, wide ? 14 : 8)
    if (r) avoid.push(r)
  }
  // Mediterranean has flower beds in both bottom corners; the others have open floor.
  const medi = document.documentElement.dataset.theme === 'medi'

  if (wide) {
    const size = Math.round(Math.min(124, Math.max(72, H * 0.13)))
    const baseY = H - Math.max(26, H * 0.06)
    const edge = medi ? 0.14 : 0.07
    const count = Math.max(5, Math.min(maxCount, Math.floor((W * (1 - edge * 2)) / (size * 1.3))))
    return { wide, spots: place(W, baseY, size, count, avoid, W * edge, W * (1 - edge)) }
  }

  // Phones: fewer and smaller, on the same floor. When the words reach down that far (short
  // screens) every spot collides and none are shown, which is the right call there.
  const size = Math.round(Math.min(76, Math.max(48, H * 0.085)))
  const baseY = H - Math.max(18, H * 0.045)
  const edge = medi ? 0.24 : 0.14
  const count = Math.min(maxCount, W < 360 || medi ? 3 : 4)
  return { wide, spots: place(W, baseY, size, count, avoid, W * edge, W * (1 - edge)) }
}

function place(W: number, baseY: number, size: number, count: number, avoid: Rect[], from: number, to: number): Spot[] {
  const spots: Spot[] = []
  const step = (to - from) / Math.max(count - 1, 1)
  for (let i = 0; i < count; i++) {
    const s = size * (1 + jitter(i + 3, 0.09))
    const x = count === 1 ? W / 2 : from + step * i + jitter(i, step * 0.12)
    const y = baseY + jitter(i + 7, size * 0.07)
    // Blocked? Try sliding a little either way before giving the spot up.
    for (const nudge of [0, -0.3, 0.3]) {
      const nx = x + nudge * step
      const box: Rect = { left: nx - s * 0.5, right: nx + s * 0.5, top: y - s * 0.95, bottom: y }
      if (avoid.some((a) => overlaps(a, box))) continue
      if (spots.some((p) => Math.abs(p.x - nx) < (p.size + s) * 0.42)) continue
      spots.push({ x: nx, y, size: s })
      break
    }
  }
  return spots
}
