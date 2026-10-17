// Shared particle drawing and helpers for burstPetals, sparkBurst and driftPetals.
// Everything is drawn on a plain canvas from token colors read at start time.
import { KITS } from '../theme/registry'
import { themeStore } from '../theme/store'
import type { ParticleKind, ParticleStyle } from '../theme/types'

export type PetalKind = ParticleKind

export interface Palette {
  ume: string
  sakura: string
  kin: string
  kinLight: string
}

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function readPalette(): Palette {
  const cs = getComputedStyle(document.documentElement)
  const get = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback
  return {
    ume: get('--ume', '#e8879a'),
    sakura: get('--sakura', '#f7dde0'),
    kin: get('--kin', '#b07812'),
    kinLight: get('--kin-light', '#e3b24f'),
  }
}

/** Used when no kit style is available (for example during a circular import at startup). */
export const DEFAULT_STYLE: ParticleStyle = { kinds: ['petal', 'blossom', 'fleck'], colors: ['--pink-3', '--pink-4', '--pink-5'] }

/** The particle style of the world the student is in right now. */
export function currentStyle(): ParticleStyle {
  try {
    const style = KITS?.[themeStore.get()]?.particles
    if (style && style.kinds.length > 0) return style
  } catch {
    // Registry not ready yet (import cycle). Fall through to the default.
  }
  return DEFAULT_STYLE
}

// Fallbacks for tokens a world might name before its CSS has loaded.
const TOKEN_FALLBACK: Record<string, string> = {
  '--pink-1': '#FFE5EC',
  '--pink-2': '#FFC2D1',
  '--pink-3': '#FFB3C6',
  '--pink-4': '#FF8FAB',
  '--pink-5': '#FB6F92',
  '--ume': '#e8879a',
  '--sakura': '#f7dde0',
  '--kin': '#b07812',
  '--kin-light': '#e3b24f',
  '--xp': '#E3B24F',
}
const GENERIC_FALLBACK = ['#FF8FAB', '#FFB3C6', '#FB6F92']

/**
 * Turns a style's color list (CSS custom property names like '--pink-4') into color strings.
 * Plain colors (not starting with '--') pass through unchanged.
 */
export function resolveColors(colors: readonly string[]): string[] {
  const cs = typeof document !== 'undefined' ? getComputedStyle(document.documentElement) : null
  const out = colors.map((raw, i) => {
    const name = raw.trim().replace(/^var\((.*)\)$/, '$1').trim()
    if (!name.startsWith('--')) return name
    const value = cs?.getPropertyValue(name).trim()
    return value || TOKEN_FALLBACK[name] || GENERIC_FALLBACK[i % GENERIC_FALLBACK.length]
  })
  return out.length > 0 ? out : [...GENERIC_FALLBACK]
}

/** Gold for flecks, sparkles and flower centers: --xp, then --kin-light, then a fixed gold. */
export function readGold(): string {
  if (typeof document === 'undefined') return '#E3B24F'
  const cs = getComputedStyle(document.documentElement)
  return cs.getPropertyValue('--xp').trim() || cs.getPropertyValue('--kin-light').trim() || '#E3B24F'
}

export const pick = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)]

// Unit shapes, built once.
interface Shapes {
  petal: Path2D
  fleck: Path2D
  papel: Path2D
  confetti: Path2D
  star: Path2D
  leaf: Path2D
  seed: Path2D
}
let shapes: Shapes | null = null

function getShapes(): Shapes {
  if (shapes) return shapes
  // A petal points up from the origin and is 1 long.
  const petal = new Path2D()
  petal.moveTo(0, 0)
  petal.bezierCurveTo(-0.62, -0.22, -0.7, -0.92, -0.13, -1)
  petal.quadraticCurveTo(0, -0.88, 0.13, -1) // the small notch ume petals have
  petal.bezierCurveTo(0.7, -0.92, 0.62, -0.22, 0, 0)
  petal.closePath()

  const fleck = new Path2D()
  fleck.moveTo(0, -1)
  fleck.lineTo(0.55, 0)
  fleck.lineTo(0, 1)
  fleck.lineTo(-0.55, 0)
  fleck.closePath()

  // Papel picado: 1 wide, 0.72 tall, scalloped bottom, with cut holes. Fill with 'evenodd'.
  const papel = new Path2D()
  const hw = 0.5
  const top = -0.36
  const bottom = 0.3
  const scallops = 5
  const sw = (hw * 2) / scallops
  papel.moveTo(-hw, top)
  papel.lineTo(hw, top)
  papel.lineTo(hw, bottom)
  for (let i = 0; i < scallops; i++) {
    const x0 = hw - i * sw
    papel.quadraticCurveTo(x0 - sw / 2, bottom + 0.12, x0 - sw, bottom)
  }
  papel.closePath()
  // Center diamond hole
  papel.moveTo(0, -0.17)
  papel.lineTo(0.12, -0.02)
  papel.lineTo(0, 0.13)
  papel.lineTo(-0.12, -0.02)
  papel.closePath()
  // Two round holes either side
  for (const cx of [-0.29, 0.29]) {
    papel.moveTo(cx + 0.065, -0.02)
    papel.arc(cx, -0.02, 0.065, 0, Math.PI * 2)
    papel.closePath()
  }
  // A row of tiny cuts under the top fold
  for (const cx of [-0.3, -0.1, 0.1, 0.3]) {
    papel.rect(cx - 0.04, -0.29, 0.08, 0.035)
  }

  const confetti = new Path2D()
  confetti.rect(-0.5, -0.16, 1, 0.32)

  // Four point sparkle with concave sides, reaches 1 from the center.
  const star = new Path2D()
  star.moveTo(0, -1)
  star.quadraticCurveTo(0.1, -0.1, 1, 0)
  star.quadraticCurveTo(0.1, 0.1, 0, 1)
  star.quadraticCurveTo(-0.1, 0.1, -1, 0)
  star.quadraticCurveTo(-0.1, -0.1, 0, -1)
  star.closePath()

  // Pointed leaf, 1 long, about 0.42 wide.
  const leaf = new Path2D()
  leaf.moveTo(0, -0.5)
  leaf.bezierCurveTo(0.3, -0.3, 0.28, 0.22, 0, 0.5)
  leaf.bezierCurveTo(-0.28, 0.22, -0.3, -0.3, 0, -0.5)
  leaf.closePath()

  // Egg shaped seed, slightly narrower at the top.
  const seed = new Path2D()
  seed.moveTo(0, -0.46)
  seed.bezierCurveTo(0.26, -0.46, 0.38, -0.1, 0.36, 0.1)
  seed.bezierCurveTo(0.34, 0.34, 0.18, 0.44, 0, 0.44)
  seed.bezierCurveTo(-0.18, 0.44, -0.34, 0.34, -0.36, 0.1)
  seed.bezierCurveTo(-0.38, -0.1, -0.26, -0.46, 0, -0.46)
  seed.closePath()

  shapes = { petal, fleck, papel, confetti, star, leaf, seed }
  return shapes
}

/** Kinds that stay facing the viewer instead of tumbling. */
const NO_FLIP: ReadonlySet<ParticleKind> = new Set<ParticleKind>(['star', 'seed'])

export interface DrawSpec {
  kind: PetalKind
  size: number
  fill: string
  /** Optional outline (petal and blossom), or the inner ring color for marigold. */
  edge: string | null
  /** 1 faces the viewer, 0 is edge on. Gives the tumbling look. Ignored by star and seed. */
  flip: number
  /** Flower center color (blossom). */
  center: string
}

function ring(ctx: CanvasRenderingContext2D, count: number, radius: number, petalR: number, offset: number) {
  ctx.beginPath()
  for (let i = 0; i < count; i++) {
    const a = offset + (i * Math.PI * 2) / count
    const x = Math.cos(a) * radius
    const y = Math.sin(a) * radius
    ctx.moveTo(x + petalR, y)
    ctx.arc(x, y, petalR, 0, Math.PI * 2)
  }
  ctx.fill()
}

/** Draws one particle centered on the current origin. */
export function drawPetal(ctx: CanvasRenderingContext2D, spec: DrawSpec) {
  const s = getShapes()
  const { kind, size, fill, edge, flip, center } = spec
  ctx.save()
  if (!NO_FLIP.has(kind)) ctx.scale(1, Math.max(0.12, Math.abs(flip)))
  switch (kind) {
    case 'fleck':
      ctx.fillStyle = fill
      ctx.scale(size * 0.55, size * 0.55)
      ctx.fill(s.fleck)
      break
    case 'petal':
      ctx.scale(size, size)
      ctx.translate(0, 0.5)
      ctx.fillStyle = fill
      ctx.fill(s.petal)
      if (edge) {
        ctx.strokeStyle = edge
        ctx.lineWidth = 0.07
        ctx.stroke(s.petal)
      }
      break
    case 'papel':
      ctx.scale(size, size)
      ctx.fillStyle = fill
      ctx.fill(s.papel, 'evenodd')
      break
    case 'confetti':
      ctx.scale(size, size)
      ctx.fillStyle = fill
      ctx.fill(s.confetti)
      break
    case 'star':
      ctx.scale(size * 0.6, size * 0.6)
      ctx.fillStyle = fill
      ctx.fill(s.star)
      break
    case 'leaf':
      ctx.scale(size, size)
      ctx.fillStyle = fill
      ctx.fill(s.leaf)
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.22)'
      ctx.lineWidth = 0.045
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(0, -0.4)
      ctx.lineTo(0, 0.56) // vein runs out into a short stem
      ctx.stroke()
      break
    case 'seed':
      ctx.scale(size, size)
      ctx.fillStyle = fill
      ctx.fill(s.seed)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.14)' // a little shading on the lower right
      ctx.beginPath()
      ctx.ellipse(0.08, 0.12, 0.24, 0.28, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'
      ctx.beginPath()
      ctx.ellipse(-0.13, -0.17, 0.08, 0.11, -0.5, 0, Math.PI * 2)
      ctx.fill()
      break
    case 'marigold': {
      ctx.scale(size, size)
      // Outer ring in the given color, inner ring in edge or a darkened fill, deep center.
      ctx.fillStyle = fill
      ring(ctx, 12, 0.36, 0.16, 0)
      ctx.fillStyle = edge ?? fill
      ring(ctx, 9, 0.22, 0.13, 0.35)
      if (!edge) {
        ctx.fillStyle = 'rgba(150, 45, 0, 0.28)'
        ring(ctx, 9, 0.22, 0.13, 0.35)
      }
      ctx.fillStyle = fill
      ctx.beginPath()
      ctx.arc(0, 0, 0.12, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(90, 30, 0, 0.5)'
      ctx.fill()
      break
    }
    default: {
      // blossom: five petals around a gold center, like an ume blossom seen from the front.
      const r = size * 0.62
      for (let i = 0; i < 5; i++) {
        ctx.save()
        ctx.rotate((i * Math.PI * 2) / 5)
        ctx.scale(r, r)
        ctx.fillStyle = fill
        ctx.fill(s.petal)
        if (edge) {
          ctx.strokeStyle = edge
          ctx.lineWidth = 0.07
          ctx.stroke(s.petal)
        }
        ctx.restore()
      }
      ctx.fillStyle = center
      ctx.beginPath()
      ctx.arc(0, 0, size * 0.13, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.restore()
}

export function makeCanvas(zIndex: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; dpr: number } | null {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  canvas.setAttribute('aria-hidden', 'true')
  Object.assign(canvas.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: String(zIndex) })
  canvas.width = Math.round(window.innerWidth * dpr)
  canvas.height = Math.round(window.innerHeight * dpr)
  ctx.scale(dpr, dpr)
  return { canvas, ctx, dpr }
}

export const rand = (a: number, b: number) => a + Math.random() * (b - a)
