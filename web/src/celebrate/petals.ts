// Shared petal drawing and helpers for burstPetals and driftPetals.
// Everything is drawn on a plain canvas from token colors read at start time.

export type PetalKind = 'blossom' | 'petal' | 'fleck'

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

// Unit shapes, built once. A petal points up from the origin and is 1 long.
let shapes: { petal: Path2D; fleck: Path2D } | null = null

function getShapes() {
  if (shapes) return shapes
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
  shapes = { petal, fleck }
  return shapes
}

export interface DrawSpec {
  kind: PetalKind
  size: number
  fill: string
  edge: string | null
  /** 1 faces the viewer, 0 is edge on. Gives the tumbling look. */
  flip: number
  center: string
}

export function drawPetal(ctx: CanvasRenderingContext2D, spec: DrawSpec) {
  const { petal, fleck } = getShapes()
  const { kind, size, fill, edge, flip, center } = spec
  ctx.save()
  ctx.scale(1, Math.max(0.12, Math.abs(flip)))
  if (kind === 'fleck') {
    ctx.fillStyle = fill
    ctx.scale(size * 0.55, size * 0.55)
    ctx.fill(fleck)
  } else if (kind === 'petal') {
    ctx.scale(size, size)
    ctx.translate(0, 0.5)
    ctx.fillStyle = fill
    ctx.fill(petal)
    if (edge) {
      ctx.strokeStyle = edge
      ctx.lineWidth = 0.07
      ctx.stroke(petal)
    }
  } else {
    // Five petals around a gold center, like an ume blossom seen from the front.
    const r = size * 0.62
    for (let i = 0; i < 5; i++) {
      ctx.save()
      ctx.rotate((i * Math.PI * 2) / 5)
      ctx.scale(r, r)
      ctx.fillStyle = fill
      ctx.fill(petal)
      if (edge) {
        ctx.strokeStyle = edge
        ctx.lineWidth = 0.07
        ctx.stroke(petal)
      }
      ctx.restore()
    }
    ctx.fillStyle = center
    ctx.beginPath()
    ctx.arc(0, 0, size * 0.13, 0, Math.PI * 2)
    ctx.fill()
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
