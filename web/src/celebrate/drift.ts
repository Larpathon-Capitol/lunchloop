import { drawPetal, makeCanvas, prefersReducedMotion, rand, readPalette, type PetalKind } from './petals'

export interface DriftOptions {
  /** Up to 10. Default 8. */
  count?: number
  /** Peak opacity, 0 to 1. Default 0.7. */
  opacity?: number
}

interface Drifter {
  kind: PetalKind
  x0: number
  y0: number
  dx: number
  dy: number
  size: number
  fill: string
  edge: string | null
  center: string
  rot: number
  spin: number
  swayAmp: number
  swayFreq: number
  phase: number
  flipFreq: number
  period: number
  t: number
}

/**
 * Ambient petals drifting slowly across a container, for the hero.
 * Each petal loops every 6 to 10 seconds. Pauses while the tab is hidden or the container is off screen.
 * Returns stop(). Does nothing with reduced motion.
 */
export function driftPetals(container: HTMLElement, opts: DriftOptions = {}): () => void {
  if (typeof window === 'undefined' || prefersReducedMotion()) return () => {}
  const made = makeCanvas(0)
  if (!made) return () => {}
  const { canvas, ctx, dpr } = made
  const count = Math.max(1, Math.min(10, Math.round(opts.count ?? 8)))
  const pal = readPalette()
  const peak = Math.max(0.1, Math.min(1, opts.opacity ?? 0.7))

  const prevPosition = container.style.position
  if (getComputedStyle(container).position === 'static') container.style.position = 'relative'
  Object.assign(canvas.style, { position: 'absolute', zIndex: '1' })
  container.appendChild(canvas)

  let w = 0
  let h = 0
  const size = () => {
    const r = container.getBoundingClientRect()
    w = Math.max(1, r.width)
    h = Math.max(1, r.height)
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }
  size()

  const make = (i: number): Drifter => {
    const kind: PetalKind = i % 3 === 0 ? 'blossom' : 'petal'
    const sakura = i % 2 === 0
    return {
      kind,
      x0: rand(-0.05, 1.05) * w,
      y0: -30,
      dx: rand(-0.12, 0.28) * w,
      dy: h + 60,
      size: kind === 'blossom' ? rand(10, 14) : rand(8, 12),
      fill: sakura ? pal.sakura : pal.ume,
      edge: sakura ? pal.ume : null,
      center: pal.kinLight,
      rot: rand(0, 6.28),
      spin: rand(-0.9, 0.9),
      swayAmp: rand(14, 34),
      swayFreq: rand(1.2, 2.2),
      phase: rand(0, 6.28),
      flipFreq: rand(1.5, 3),
      period: rand(6, 10),
      t: Math.random(), // start spread through the loop so they do not arrive in a clump
    }
  }
  const drifters = Array.from({ length: count }, (_, i) => make(i))

  let raf = 0
  let last = 0
  let running = false
  let onScreen = true

  const frame = (now: number) => {
    const dt = last ? Math.min((now - last) / 1000, 1 / 20) : 0
    last = now
    ctx.clearRect(0, 0, w, h)
    for (const d of drifters) {
      d.t += dt / d.period
      if (d.t >= 1) {
        d.t -= 1
        d.x0 = rand(-0.05, 1.05) * w
        d.dx = rand(-0.12, 0.28) * w
      }
      const t = d.t
      const x = d.x0 + d.dx * t + Math.sin(t * d.period * d.swayFreq + d.phase) * d.swayAmp
      const y = d.y0 + d.dy * t
      const fade = Math.min(1, t / 0.12, (1 - t) / 0.12)
      ctx.globalAlpha = peak * Math.max(0, fade)
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(d.rot + t * d.period * d.spin)
      drawPetal(ctx, { kind: d.kind, size: d.size, fill: d.fill, edge: d.edge, center: d.center, flip: Math.cos(t * d.period * d.flipFreq + d.phase) })
      ctx.restore()
    }
    ctx.globalAlpha = 1
    raf = requestAnimationFrame(frame)
  }

  const sync = () => {
    const should = !document.hidden && onScreen
    if (should && !running) {
      running = true
      last = 0
      raf = requestAnimationFrame(frame)
    } else if (!should && running) {
      running = false
      cancelAnimationFrame(raf)
    }
  }

  const io = new IntersectionObserver((entries) => {
    onScreen = entries[entries.length - 1]?.isIntersecting ?? true
    sync()
  })
  io.observe(container)
  const ro = new ResizeObserver(size)
  ro.observe(container)
  document.addEventListener('visibilitychange', sync)
  sync()

  return () => {
    running = false
    cancelAnimationFrame(raf)
    io.disconnect()
    ro.disconnect()
    document.removeEventListener('visibilitychange', sync)
    canvas.remove()
    container.style.position = prevPosition
  }
}
