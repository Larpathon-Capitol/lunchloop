import type { ParticleStyle } from '../theme/types'
import { currentStyle, drawPetal, makeCanvas, pick, prefersReducedMotion, rand, readGold, resolveColors, type DrawSpec, type PetalKind } from './petals'

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
  /** Which shapes and colors to throw. Default: the current world's kit. */
  style?: ParticleStyle
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
  drag: number
  gravity: number
  swayAmp: number
  swayFreq: number
  swayPhase: number
  flipFreq: number
  flipPhase: number
  twinkle: number
  /** Seeds bounce once on this line. Infinity for everything else. */
  floor: number
  bounced: boolean
  age: number
  /** Age at which the fade out starts. */
  fadeAt: number
  life: number
}

const ACCENTS: ReadonlySet<PetalKind> = new Set<PetalKind>(['fleck', 'star'])
const NOOP: PetalHandle = { stop: () => {}, done: Promise.resolve() }

type Point = { x: number; y: number }

function pointOf(origin: HTMLElement | Point): Point {
  if (origin instanceof HTMLElement) {
    const r = origin.getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  }
  return origin
}

// Per kind: size range, launch speed factor, air drag, gravity, sway, flip speed and life.
interface Physics {
  size: [number, number]
  speed: number
  drag: number
  gravity: number
  sway: [number, number]
  swayFreq: [number, number]
  flip: [number, number]
  spin: number
  life: [number, number]
}
const BASE: Physics = { size: [11, 17], speed: 1, drag: 2.1, gravity: 760, sway: [40, 110], swayFreq: [4, 8], flip: [4, 9], spin: 5, life: [1.2, 1.8] }
const PHYSICS: Partial<Record<PetalKind, Partial<Physics>>> = {
  blossom: { size: [15, 22] },
  fleck: { size: [4, 6], speed: 1.15 },
  papel: { size: [16, 22], speed: 0.85, drag: 3.4, gravity: 380, sway: [60, 140], flip: [6, 11], spin: 3, life: [1.6, 2.2] },
  confetti: { size: [10, 15], speed: 0.95, drag: 3.0, gravity: 440, sway: [50, 120], flip: [8, 14], life: [1.5, 2.1] },
  seed: { size: [7, 10], speed: 0.8, drag: 0.9, gravity: 1300, sway: [0, 0], spin: 4, life: [1.4, 1.8] },
  leaf: { size: [13, 18], drag: 2.6, gravity: 500, sway: [70, 150], swayFreq: [2.5, 4.5], flip: [2, 4], spin: 2.5, life: [1.4, 2] },
  star: { size: [8, 13], speed: 0.9, drag: 2.8, gravity: 110, sway: [0, 20], spin: 1.2, life: [0.7, 1.1] },
  marigold: { size: [12, 16], drag: 2.3, gravity: 700 },
}

function spawn(count: number, origin: Point, o: { power: number; angle: number; spread: number }, style: ParticleStyle): Particle[] {
  const colors = resolveColors(style.colors)
  const gold = readGold()
  const accents = style.kinds.filter((k) => ACCENTS.has(k))
  let mains = style.kinds.filter((k) => !ACCENTS.has(k))
  if (mains.length === 0) mains = accents.length ? accents : ['petal']
  const accentCount = accents.length && mains !== accents ? Math.max(3, Math.round(count * 0.12)) : 0
  const floorY = Math.min(origin.y + rand(140, 220), window.innerHeight - 6)
  const offset = Math.floor(Math.random() * mains.length)

  const list: Particle[] = []
  for (let i = 0; i < count; i++) {
    const kind: PetalKind = i < accentCount ? accents[i % accents.length] : mains[(i + offset) % mains.length]
    const ph: Physics = { ...BASE, ...PHYSICS[kind] }
    const a = ((o.angle + rand(-o.spread / 2, o.spread / 2)) * Math.PI) / 180
    const speed = rand(260, 560) * o.power * ph.speed
    const fill = ACCENTS.has(kind) ? gold : pick(colors)
    // Light petals get a darker outline so they still read on light paper.
    const outlined = (kind === 'petal' || kind === 'blossom') && colors.length > 1 && fill === colors[0]
    const fadeLife = rand(ph.life[0], ph.life[1])
    list.push({
      kind,
      x: origin.x,
      y: origin.y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      rot: rand(0, Math.PI * 2),
      spin: rand(-ph.spin, ph.spin),
      size: rand(ph.size[0], ph.size[1]),
      fill,
      edge: outlined ? colors[colors.length - 1] : kind === 'marigold' && colors.length > 1 ? pick(colors.filter((c) => c !== fill)) : null,
      center: gold,
      drag: ph.drag,
      gravity: ph.gravity,
      swayAmp: rand(ph.sway[0], ph.sway[1]),
      swayFreq: rand(ph.swayFreq[0], ph.swayFreq[1]),
      swayPhase: rand(0, Math.PI * 2),
      flipFreq: rand(ph.flip[0], ph.flip[1]),
      flipPhase: rand(0, Math.PI * 2),
      twinkle: kind === 'star' ? rand(10, 16) : 0,
      floor: kind === 'seed' ? floorY + rand(-10, 10) : Infinity,
      bounced: false,
      age: 0,
      fadeAt: fadeLife * 0.6,
      life: fadeLife,
    })
  }
  return list
}

function step(p: Particle, dt: number) {
  const drag = Math.exp(-p.drag * dt)
  p.vx *= drag
  p.vy = p.vy * drag + p.gravity * dt
  const sway = Math.cos(p.age * p.swayFreq + p.swayPhase) * p.swayAmp * dt
  p.x += p.vx * dt + sway
  p.y += p.vy * dt
  p.rot += p.spin * dt
  if (p.y >= p.floor && p.vy > 0) {
    p.y = p.floor
    if (!p.bounced) {
      // One bounce, losing about 55% of its speed, then fade out.
      p.bounced = true
      p.vy = -p.vy * 0.45
      p.vx *= 0.45
      p.spin *= 0.5
      p.fadeAt = Math.min(p.fadeAt, p.age)
      p.life = Math.min(p.life, p.age + 0.55)
    } else {
      p.vy = 0
      p.vx *= 0.8
      p.spin *= 0.8
    }
  }
}

/** Burst of the current world's particles from an element or a viewport point. No-op with reduced motion. */
export function burstPetals(origin: HTMLElement | Point, opts: BurstOptions = {}): PetalHandle {
  if (typeof window === 'undefined' || prefersReducedMotion()) return NOOP
  const made = makeCanvas(opts.zIndex ?? 9100)
  if (!made) return NOOP
  const { canvas, ctx } = made
  const point = pointOf(origin)
  const count = Math.max(24, Math.min(40, Math.round(opts.count ?? 32)))
  const parts = spawn(count, point, { power: opts.power ?? 1, angle: opts.angle ?? -90, spread: opts.spread ?? 130 }, opts.style ?? currentStyle())
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
      step(p, dt)
      ctx.globalAlpha = p.age < p.fadeAt ? 1 : Math.max(0, 1 - (p.age - p.fadeAt) / (p.life - p.fadeAt))
      const size = p.twinkle ? p.size * (0.55 + 0.45 * Math.abs(Math.sin(p.age * p.twinkle + p.flipPhase))) : p.size
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rot)
      const spec: DrawSpec = { kind: p.kind, size, fill: p.fill, edge: p.edge, center: p.center, flip: Math.cos(p.age * p.flipFreq + p.flipPhase) }
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

export interface SparkOptions {
  /** Resolved color strings (for example a food's colors). Default: the current world's kit colors. */
  colors?: string[]
  /** 8 to 10 bits. Default 9. */
  count?: number
  zIndex?: number
}

const SPARK_MS = 450
const MAX_SPARKS = 3
const sparks: PetalHandle[] = []

function roundSquare(ctx: CanvasRenderingContext2D, r: number) {
  const k = r * 0.35
  ctx.beginPath()
  ctx.moveTo(-r + k, -r)
  ctx.arcTo(r, -r, r, r, k)
  ctx.arcTo(r, r, -r, r, k)
  ctx.arcTo(-r, r, -r, -r, k)
  ctx.arcTo(-r, -r, r, -r, k)
  ctx.closePath()
  ctx.fill()
}

/** Small click spark: a ring of tiny bits flying out and shrinking over 0.45s. At most 3 at once. No-op with reduced motion. */
export function sparkBurst(origin: HTMLElement | Point, opts: SparkOptions = {}): PetalHandle {
  if (typeof window === 'undefined' || prefersReducedMotion()) return NOOP
  // Drop the oldest spark to make room.
  while (sparks.length >= MAX_SPARKS) sparks[0].stop()
  const made = makeCanvas(opts.zIndex ?? 9150)
  if (!made) return NOOP
  const { canvas, ctx } = made
  const p0 = pointOf(origin)
  const colors = opts.colors && opts.colors.length > 0 ? opts.colors : resolveColors(currentStyle().colors)
  const count = Math.max(8, Math.min(10, Math.round(opts.count ?? 9)))
  const start = rand(0, Math.PI * 2)
  const bits = Array.from({ length: count }, (_, i) => {
    const a = start + (i * Math.PI * 2) / count + rand(-0.25, 0.25)
    return {
      dx: Math.cos(a),
      dy: Math.sin(a),
      dist: rand(28, 48),
      r: rand(2.4, 4.2),
      round: i % 2 === 0,
      rot: rand(0, Math.PI),
      fill: colors[i % colors.length],
    }
  })
  document.body.appendChild(canvas)

  let raf = 0
  const started = performance.now()
  let finish: () => void = () => {}
  const done = new Promise<void>((res) => (finish = res))
  let ended = false
  const handle: PetalHandle = {
    stop: () => {
      if (ended) return
      ended = true
      cancelAnimationFrame(raf)
      canvas.remove()
      const i = sparks.indexOf(handle)
      if (i >= 0) sparks.splice(i, 1)
      finish()
    },
    done,
  }
  sparks.push(handle)

  const frame = (now: number) => {
    const t = Math.min(1, (now - started) / SPARK_MS)
    const ease = 1 - Math.pow(1 - t, 3)
    const scale = 1 - 0.7 * t
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
    ctx.globalAlpha = 1 - t
    for (const b of bits) {
      ctx.save()
      ctx.translate(p0.x + b.dx * b.dist * ease, p0.y + b.dy * b.dist * ease)
      ctx.fillStyle = b.fill
      const r = b.r * scale
      if (b.round) {
        ctx.beginPath()
        ctx.arc(0, 0, r, 0, Math.PI * 2)
        ctx.fill()
      } else {
        ctx.rotate(b.rot + t * 2)
        roundSquare(ctx, r)
      }
      ctx.restore()
    }
    ctx.globalAlpha = 1
    if (t >= 1) handle.stop()
    else raf = requestAnimationFrame(frame)
  }
  raf = requestAnimationFrame(frame)
  return handle
}
