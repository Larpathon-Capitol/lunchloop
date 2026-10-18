// Sakura petals falling through the hero in three depth bands, drawn on one 2D canvas.
// The pointer pushes nearby petals away like a gust. The loop stops while the tab is hidden;
// under reduced motion the petals are drawn once and stay put.
import type { MotionValue } from 'framer-motion'
import { useEffect, useRef } from 'react'
import { frameLoop, petalPath } from './paint'

interface Petal {
  x: number
  y: number
  band: 0 | 1 | 2
  size: number
  rot: number
  spin: number
  flip: number
  flipSpeed: number
  vx: number
  vy: number
  sway: number
  color: number
}

// Back to front: size, fall speed (px/s), alpha.
const BANDS = [
  { size: 6, fall: 18, alpha: 0.5 },
  { size: 9, fall: 30, alpha: 0.8 },
  { size: 14, fall: 46, alpha: 1 },
] as const

const PALETTE: Array<[string, string]> = [
  ['--pink-3', '#FFB3C6'],
  ['--pink-4', '#FF8FAB'],
  ['--pink-2', '#FFC2D1'],
  ['--pink-5', '#FB6F92'],
  ['--pink-3', '#FFB3C6'],
  ['--leaf', '#5FB77A'],
]

/** Seconds between petal frames: about 30 fps, a hair early so it lands on every second vsync. */
const PETAL_FRAME_S = 1 / 30 - 0.004

function rand(a: number, b: number) {
  return a + Math.random() * (b - a)
}

function makePetal(w: number, h: number, anywhere: boolean): Petal {
  const r = Math.random()
  const band: 0 | 1 | 2 = r < 0.45 ? 0 : r < 0.82 ? 1 : 2
  // Mostly pinks; the green petal is the rare one.
  const color = band < 2 && Math.random() < 0.08 ? 5 : Math.floor(Math.random() * 5)
  return {
    x: rand(-20, w + 20),
    y: anywhere ? rand(-20, h) : rand(-60, -10),
    band,
    size: BANDS[band].size * rand(0.8, 1.25),
    rot: rand(0, Math.PI * 2),
    spin: rand(-1.4, 1.4),
    flip: rand(0, Math.PI * 2),
    flipSpeed: rand(1.5, 3.2),
    vx: 0,
    vy: 0,
    sway: rand(0, Math.PI * 2),
    color,
  }
}

/** The petal canvas. Fills its positioned parent. */
export function PetalField({ px, py, still }: { px: MotionValue<number>; py: MotionValue<number>; still: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const css = getComputedStyle(canvas)
    const colors = PALETTE.map(([name, hex]) => css.getPropertyValue(name).trim() || hex)
    const unit = new Path2D(petalPath(1))

    let w = 0
    let h = 0
    let rect = canvas.getBoundingClientRect()
    let petals: Petal[] = []
    const resize = () => {
      rect = canvas.getBoundingClientRect()
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      w = rect.width
      h = rect.height
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const count = Math.max(14, Math.min(44, Math.round((w * h) / 24000)))
      petals = Array.from({ length: count }, () => makePetal(w, h, true))
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const draw = () => {
      ctx.clearRect(0, 0, w, h)
      for (const p of petals) {
        const band = BANDS[p.band]
        ctx.save()
        ctx.globalAlpha = band.alpha
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        // The cosine squash makes the petal tumble like a coin in the air.
        ctx.scale(p.size, p.size * (0.35 + 0.65 * Math.abs(Math.cos(p.flip))))
        ctx.fillStyle = colors[p.color]
        ctx.fill(unit)
        ctx.restore()
      }
    }

    if (still) {
      draw()
      return () => ro.disconnect()
    }

    // The gust only blows while the pointer is actually moving; on touch screens px and py rest at 0.
    let lastX = px.get()
    let lastY = py.get()
    let gust = 0
    let frame = 0
    // Petals fall a pixel or so per frame, so 30 fps reads the same as 60 and halves the canvas
    // work (a full-screen clear, fill and upload per frame). Time is kept, so speeds stay right.
    let owed = 0
    const stop = frameLoop((tick, t) => {
      owed += tick
      if (owed < PETAL_FRAME_S) return
      const dt = Math.min(0.05, owed)
      owed = 0
      if (++frame % 15 === 0) rect = canvas.getBoundingClientRect()
      const nx = px.get()
      const ny = py.get()
      if (Math.abs(nx - lastX) + Math.abs(ny - lastY) > 0.0005) gust = 1
      else gust = Math.max(0, gust - dt * 0.8)
      lastX = nx
      lastY = ny
      const cx = (nx + 0.5) * window.innerWidth - rect.left
      const cy = (ny + 0.5) * window.innerHeight - rect.top
      const reach = Math.max(110, Math.min(w, h) * 0.28)

      for (let i = 0; i < petals.length; i++) {
        const p = petals[i]
        const band = BANDS[p.band]
        p.sway += dt * 1.1
        const breeze = 14 + 10 * Math.sin(t * 0.3)
        let ax = 0
        let ay = 0
        if (gust > 0) {
          const dx = p.x - cx
          const dy = p.y - cy
          const d = Math.hypot(dx, dy)
          if (d < reach && d > 0.1) {
            const push = (1 - d / reach) * 900 * gust * (0.6 + p.band * 0.3)
            ax = (dx / d) * push
            ay = (dy / d) * push
          }
        }
        p.vx = (p.vx + ax * dt) * (1 - dt * 2.2)
        p.vy = (p.vy + ay * dt) * (1 - dt * 2.2)
        p.x += (breeze * (0.5 + p.band * 0.4) + Math.sin(p.sway) * 16 + p.vx) * dt
        p.y += (band.fall + p.vy) * dt
        p.rot += p.spin * dt
        p.flip += p.flipSpeed * dt
        if (p.y > h + 24 || p.x > w + 40 || p.x < -60) petals[i] = makePetal(w, h, false)
      }
      draw()
    })
    return () => {
      stop()
      ro.disconnect()
    }
  }, [px, py, still])

  return <canvas ref={ref} className="ka-fill ka-petals" aria-hidden="true" />
}
