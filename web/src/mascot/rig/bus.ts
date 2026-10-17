// The link between mascot instances on the page (plain DOM, no three.js) and the one shared
// 3D layer that draws them all. Each <Mascot> registers a handle here; the layer reads the
// handles every frame. The layer itself is loaded the first time a mascot mounts, so screens
// without a mascot never download three.js.
import type { MascotId } from '../../theme/types'
import type { UmeMood } from '../types'

/** One-off body moves the rig plays on top of the idle loop. */
export type RigCommand =
  | { type: 'hop'; height?: number; spin?: number }
  | { type: 'double' }
  | { type: 'jumpBack' }
  | { type: 'puff' }
  | { type: 'squish' }
  | { type: 'wiggle' }
  /** Leaving the ground for a DOM move (the dock travelling): stretch now, squash when it lands. */
  | { type: 'air'; ms: number }

export interface MascotHandle {
  id: number
  /** The box the mascot is drawn into: the slot plus headroom for hops. */
  stage: HTMLElement
  /** Width of the mascot's own slot in CSS pixels; the model is drawn to fit it. */
  size: number
  mascot: MascotId
  mood: UmeMood
  reduced: boolean
  /** True while a speech bubble shows. */
  talking: boolean
  /** Fixed point to look at (viewport px). Null follows the pointer. */
  lookAt: { x: number; y: number } | null
  /** Pet impulse waiting to be added to the smoothed pet level. */
  petKick: number
  commands: RigCommand[]
  /** Set by the layer once the model is on screen. */
  ready: boolean
  onReady?: () => void
}

let nextId = 1
const handles = new Map<number, MascotHandle>()
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((l) => l())
}

export const rigBus = {
  create(init: Omit<MascotHandle, 'id' | 'commands' | 'petKick' | 'ready'>): MascotHandle {
    return { ...init, id: nextId++, commands: [], petKick: 0, ready: false }
  },
  /** Start drawing a mascot into its stage box. */
  add(h: MascotHandle, stage: HTMLElement, onReady: () => void) {
    h.stage = stage
    h.onReady = onReady
    if (h.ready) onReady()
    handles.set(h.id, h)
    ensureLayer()
    emit()
  },
  remove(h: MascotHandle) {
    handles.delete(h.id)
    emit()
  },
  all: () => handles,
  /** Called by the layer when a handle's model first mounts. */
  markReady(h: MascotHandle) {
    h.ready = true
    h.onReady?.()
  },
  /** Takes the waiting pet impulse, leaving zero. */
  takeKick(h: MascotHandle) {
    const k = h.petKick
    h.petKick = 0
    return k
  },
  /** Takes the next waiting command, if any. */
  nextCommand: (h: MascotHandle) => h.commands.shift(),
  subscribe(l: () => void) {
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  },
  /** Keep the handle in step with the component's props. */
  sync(h: MascotHandle, patch: Partial<Pick<MascotHandle, 'size' | 'mascot' | 'mood' | 'reduced' | 'talking' | 'lookAt'>>) {
    Object.assign(h, patch)
  },
  /** Add to the pet level; the rig smooths it and lets it drain. */
  kick(h: MascotHandle, amount: number) {
    h.petKick += amount
  },
  send(h: MascotHandle, cmd: RigCommand) {
    if (h.commands.length < 6) h.commands.push(cmd)
  },
}

// The pointer, in viewport pixels, shared by every instance. at is 0 until it first moves.
export const pointer = { x: 0, y: 0, at: 0 }

/** How far the stage box reaches past the slot, as a share of the slot size. Keep in step with .mascot__stage in ume.css. */
export const STAGE = { top: 0.9, side: 0.5, bottom: 0.15 } as const
/** Where the feet sit, as a share of the slot height from its top. */
export const FEET = 0.94

let layerStarted = false
let webgl: boolean | null = null

/** True when the browser can make a WebGL context. Checked once; without it mascots stay as posters. */
export function canDraw3D(): boolean {
  if (webgl !== null) return webgl
  try {
    const c = document.createElement('canvas')
    const gl = c.getContext('webgl2') ?? c.getContext('webgl')
    webgl = !!gl
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
  } catch {
    webgl = false
  }
  return webgl
}

let host: HTMLDivElement | null = null
let bubbles: HTMLDivElement | null = null

/** The fixed layer on <body>: the canvas root first, then the bubble layer, so bubbles paint above the models. */
function layerHost() {
  if (!host) {
    host = document.createElement('div')
    host.className = 'mascot-layer'
    const gl = document.createElement('div')
    gl.className = 'mascot-layer__gl'
    gl.setAttribute('aria-hidden', 'true')
    bubbles = document.createElement('div')
    bubbles.className = 'mascot-layer__bubbles'
    host.append(gl, bubbles)
    document.body.appendChild(host)
  }
  return host
}

/** Where speech bubbles portal to: just above the mascot canvas, below the header, tab bar and sheets. */
export function bubbleLayer(): HTMLDivElement {
  layerHost()
  return bubbles!
}

/** Mount the shared 3D layer once, in its own React root. */
function ensureLayer() {
  if (layerStarted || typeof document === 'undefined') return
  layerStarted = true
  window.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType === 'touch') return
      Object.assign(pointer, { x: e.clientX, y: e.clientY, at: performance.now() })
    },
    { passive: true },
  )
  if (!canDraw3D()) return
  const root = layerHost().firstElementChild as HTMLElement
  void Promise.all([import('react-dom/client'), import('react'), import('../three/MascotLayer')]).then(
    ([{ createRoot }, { createElement }, { MascotLayer }]) => {
      createRoot(root).render(createElement(MascotLayer))
    },
  )
}
