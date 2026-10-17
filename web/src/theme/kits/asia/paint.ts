// Shared paint and geometry for the East and Southeast Asia kit: token colors with
// fallbacks (the tokens may load after this kit), the spring family and a few shape builders.

/** Token colors. Each carries the hex from themes.md as a fallback. */
export const C = {
  pink1: 'var(--pink-1, #FFE5EC)',
  pink2: 'var(--pink-2, #FFC2D1)',
  pink3: 'var(--pink-3, #FFB3C6)',
  pink4: 'var(--pink-4, #FF8FAB)',
  pink5: 'var(--pink-5, #FB6F92)',
  surface: 'var(--surface, #FFF4F7)',
  ink: 'var(--ink, #3A1626)',
  leaf: 'var(--leaf, #5FB77A)',
  leafDeep: 'var(--leaf-deep, #1F5A3A)',
  indigo: 'var(--accent-1, #232A5C)',
  vermilion: 'var(--accent-2, #BE2B1A)',
  field: 'var(--field, #232A5C)',
} as const

/** The spring family from the motion notes, so this kit moves like the rest of the app. */
export const spring = {
  tap: { type: 'spring', stiffness: 600, damping: 18, mass: 0.6 },
  pop: { type: 'spring', stiffness: 380, damping: 22, mass: 0.8 },
  settle: { type: 'spring', stiffness: 260, damping: 30, mass: 1 },
  drift: { type: 'spring', stiffness: 120, damping: 20, mass: 1 },
} as const

export const brushEase = [0.7, 0, 0.2, 1] as const

export const f = (n: number) => Math.round(n * 10) / 10

/** Small deterministic wobble so no two petals match. */
export const jit = (i: number, a: number) => 1 + a * Math.sin(i * 12.9898 + 4.1)

/**
 * One sakura petal pointing up from the origin, with the notch at its tip that makes
 * it a cherry petal and not a plum petal. r is the petal length.
 */
export function petalPath(r: number): string {
  const w = r * 0.5
  return [
    `M0 0`,
    `C${f(-w * 0.9)} ${f(-r * 0.18)} ${f(-w * 1.15)} ${f(-r * 0.78)} ${f(-w * 0.42)} ${f(-r)}`,
    `L0 ${f(-r * 0.84)}`,
    `L${f(w * 0.42)} ${f(-r)}`,
    `C${f(w * 1.15)} ${f(-r * 0.78)} ${f(w * 0.9)} ${f(-r * 0.18)} 0 0Z`,
  ].join('')
}

/**
 * A branch stroke laid along +x: pressed at the start, swelling a touch, tapering out.
 * L is the length, w0 and w1 the start and end widths, bend the sideways bow.
 */
export function brush(L: number, w0: number, w1: number, bend: number): string {
  const n = 14
  const top: string[] = []
  const bot: string[] = []
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const y = 4 * bend * t * (1 - t)
    const w = ((w0 + (w1 - w0) * t ** 0.9) * (1 + 0.14 * Math.sin(Math.PI * Math.min(t * 1.4, 1)))) / 2
    const s = (4 * bend * (1 - 2 * t)) / L
    const k = 1 / Math.hypot(1, s)
    top.push(`${f(t * L - s * k * w)} ${f(y + k * w)}`)
    bot.unshift(`${f(t * L + s * k * w)} ${f(y - k * w)}`)
  }
  const r = f(w0 / 2)
  return `M${top.join('L')}L${bot.join('L')}A${r} ${r} 0 0 0 ${top[0]}Z`
}

/** Calls fn on every animation frame while the tab is visible. Returns a stop function. */
export function frameLoop(fn: (dt: number, t: number) => void): () => void {
  let raf = 0
  let last = 0
  const tick = (t: number) => {
    const dt = last ? Math.min(0.05, (t - last) / 1000) : 0
    last = t
    fn(dt, t / 1000)
    raf = requestAnimationFrame(tick)
  }
  const start = () => {
    if (raf || document.hidden) return
    last = 0
    raf = requestAnimationFrame(tick)
  }
  const stop = () => {
    cancelAnimationFrame(raf)
    raf = 0
  }
  const onVis = () => (document.hidden ? stop() : start())
  document.addEventListener('visibilitychange', onVis)
  start()
  return () => {
    stop()
    document.removeEventListener('visibilitychange', onVis)
  }
}

