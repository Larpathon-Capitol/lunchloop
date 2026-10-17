import { drawPetal, makeCanvas, prefersReducedMotion, rand, readPalette, type DrawSpec, type PetalKind, type Palette } from './petals'

export interface BurstOptions {
  /** 24 to 40 particles. Default 32. */
  count?: number
  /** Launch speed multiplier. Default 1. */
  power?: number
  /** Center direction in degrees, -90 is straight up. Default -90. */
  angle?: number
  /** Fan width in degrees. Default 130. */
  spread?: number
  zIndex?: number
}

export interface PetalHandle {
  /** Stop early and remove the canvas. */
  stop: () => void
  /** Resolves when the burst is finished or stopped. */
  done: Promise<void>
}

interface Particle {
  kind: PetalKind
  x: number
  y: number
  vx: number
  vy: number
  rot: number
  spin: number
  size: number
  fill: string
  edge: string | null
  center: string
  swayAmp: number
  swayFreq: number
  swayPhase: number
  flipFreq: number
  flipPhase: number
  age: number
  life: number
}

const GRAVITY = 760
const NOOP: PetalHandle = { stop: () => {}, done: Promise.resolve() }

function spawn(count: number, x: number, y: number, o: Required<Omit<BurstOptions, 'zIndex'>>, pal: Palette): Particle[] {
  const list: Particle[] = []
  const flecks = Math.max(3, Math.round(count * 0.12))
  for (let i = 0; i < count; i++) {
    const kind: PetalKind = i < flecks ? 'fleck' : i % 3 === 0 ? 'blossom' : 'petal'
    const a = ((o.angle + rand(-o.spread / 2, o.spread / 2)) * Math.PI) / 180
    const speed = rand(260, 560) * o.power * (kind === 'fleck' ? 1.15 : 1)
    const sakura = Math.random() < 0.45
    list.push({
      kind,
      x,
      y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      rot: rand(0, Math.PI * 2),
      spin: rand(-5, 5),
      size: kind === 'blossom' ? rand(15, 22) : kind === 'petal' ? rand(11, 17) : rand(4, 6),
      fill: kind === 'fleck' ? pal.kinLight : sakura ? pal.sakura : pal.ume,
      edge: kind !== 'fleck' && sakura ? pal.ume : null,
      center: kind === 'blossom' ? pal.kinLight : pal.kin,
      swayAmp: rand(40, 110),
      swayFreq: rand(4, 8),
      swayPhase: rand(0, Math.PI * 2),
      flipFreq: rand(4, 9),
      flipPhase: rand(0, Math.PI * 2),
      age: 0,
      life: rand(1.2, 1.8),
    })
  }
  return list
}

/** Burst of plum blossom petals from an element or a viewport point. No-op with reduced motion. */
export function burstPetals(origin: HTMLElement | { x: number; y: number }, opts: BurstOptions = {}): PetalHandle {
  if (typeof window === 'undefined' || prefersReducedMotion()) return NOOP
  const made = makeCanvas(opts.zIndex ?? 9100)
  if (!made) return NOOP
  const { canvas, ctx } = made
  let point: { x: number; y: number }
  if (origin instanceof HTMLElement) {
    const r = origin.getBoundingClientRect()
    point = { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  } else {
    point = origin
  }
  const count = Math.max(24, Math.min(40, Math.round(opts.count ?? 32)))
  const parts = spawn(count, point.x, point.y, { count, power: opts.power ?? 1, angle: opts.angle ?? -90, spread: opts.spread ?? 130 }, readPalette())
  document.body.appendChild(canvas)

  let raf = 0
  let last = performance.now()
  const started = last
  let finish: () => void = () => {}
  const done = new Promise<void>((res) => (finish = res))

  const end = () => {
    cancelAnimationFrame(raf)
    canvas.remove()
    finish()
  }

  const frame = (now: number) => {
    const dt = Math.min((now - last) / 1000, 1 / 30)
    last = now
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
    let alive = 0
    for (const p of parts) {
      p.age += dt
      if (p.age >= p.life) continue
      alive++
      const drag = Math.exp(-2.1 * dt)
      p.vx *= drag
      p.vy = p.vy * drag + GRAVITY * dt
      const sway = Math.cos(p.age * p.swayFreq + p.swayPhase) * p.swayAmp * dt
      p.x += p.vx * dt + sway
      p.y += p.vy * dt
      p.rot += p.spin * dt
      const t = p.age / p.life
      ctx.globalAlpha = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rot)
      const spec: DrawSpec = { kind: p.kind, size: p.size, fill: p.fill, edge: p.edge, center: p.center, flip: Math.cos(p.age * p.flipFreq + p.flipPhase) }
      drawPetal(ctx, spec)
      ctx.restore()
    }
    ctx.globalAlpha = 1
    if (alive === 0 || now - started > 3000) end()
    else raf = requestAnimationFrame(frame)
  }
  raf = requestAnimationFrame(frame)
  return { stop: end, done }
}
