import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import * as THREE from 'three'
import { copy } from '../shared/copy'
import { noren, useNoren } from '../shared/ui/norenStore'
import { FoodDrop } from './foods'
import { compartmentCenter, compartmentSize, COMPARTMENTS, TRAY, type Compartment } from './geometry'
import { readTokenColors, type GroupId } from './groups'
import { PaperSlip } from './PaperSlip'
import { stageBus, useTrayHovered } from './stageBus'
import { trayEvents, trayProjector, trayStore, useTray, type Component, type TrayState } from './store'
import { buildShadowTexture, buildStudioEnvironment } from './studio'
import { TrayModel } from './TrayModel'
import { HeroFoods } from './hero/HeroFoods'
import './tray.css'

/*
 * The one persistent tray. A fixed, full-viewport canvas behind the page; the tray is framed
 * inside whatever rect the current screen's <TraySlot> reports, and springs between rects when
 * the route changes. That spring is what carries the hero into the game without a cut.
 */

const FOV = 30
const MAX_TILT = THREE.MathUtils.degToRad(12)
const PICK_TILT = THREE.MathUtils.degToRad(2.5)
const SHADOW_Y = -0.9
/** How long a missing slot is tolerated before the tray hides (covers route changes and lazy screens). */
const SLOT_GRACE_MS = 450
/** While the noren curtain holds for the next screen, the tray waits longer for its new slot. */
const NOREN_GRACE_MS = 1300
/** Camera elevation (radians above the horizon) in the pick view. */
const PICK_ELEVATION = 0.98
/** Pick view: the tray's outline stays inside this much of the slot (about 6% margin per side). */
const PICK_FILL = 0.88

// Springs: [stiffness, damping]. Mass is 1.
const SLOT: [number, number] = [105, 19] // about 1s, a hair of overshoot
const POSE: [number, number] = [80, 16]
const PRESENCE: [number, number] = [120, 21]
const TILT: [number, number] = [52, 8.2] // chases the pointer, overshoots a little, settles
const LIFT: [number, number] = [240, 15]

/**
 * Pixel budget for the full-screen canvas. A retina laptop would otherwise draw 2880x1800 with
 * 4x multisampling every frame for a tray that covers a fraction of it.
 */
const PIXEL_BUDGET = 3.2e6
const MAX_DPR = 2
/**
 * Touch screens cap lower: the canvas spans the whole phone while the tray fills a quarter of it,
 * and the multisampled metal edges at 1.5x look the same at arm's length as 2x or 3x.
 */
const MAX_DPR_TOUCH = 1.5

function stageDpr() {
  const native = window.devicePixelRatio || 1
  const area = Math.max(1, window.innerWidth * window.innerHeight)
  const cap = window.matchMedia('(pointer: coarse)').matches ? MAX_DPR_TOUCH : MAX_DPR
  return Math.max(1, Math.min(native, cap, Math.sqrt(PIXEL_BUDGET / area)))
}

function useStageDpr() {
  const [dpr, setDpr] = useState(stageDpr)
  useEffect(() => {
    const onResize = () => setDpr(stageDpr())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return dpr
}

type Spring = { x: number; v: number }
const sp = (x = 0): Spring => ({ x, v: 0 })

/** Semi-implicit Euler in small slices, so a dropped frame cannot blow it up. Returns true while moving. */
function step(s: Spring, target: number, [k, c]: [number, number], dt: number, eps: number, reduced: boolean) {
  if (reduced) {
    s.x = target
    s.v = 0
    return false
  }
  let left = Math.min(dt, 0.1)
  while (left > 0) {
    const h = Math.min(left, 1 / 120)
    s.v += (k * (target - s.x) - c * s.v) * h
    s.x += s.v * h
    left -= h
  }
  if (Math.abs(target - s.x) < eps && Math.abs(s.v) < eps * 4) {
    s.x = target
    s.v = 0
    return false
  }
  return true
}

const lerp = THREE.MathUtils.lerp

/**
 * The tray's outer outline in tray space (x right, y up, z toward the viewer): the rounded
 * corners sampled at the rim top and at the base, so the fit sees the true silhouette.
 */
const OUTLINE: THREE.Vector3[] = (() => {
  const pts: THREE.Vector3[] = []
  const r = TRAY.radius
  const hx = TRAY.width / 2 + TRAY.bevel
  const hz = TRAY.depth / 2 + TRAY.bevel
  const top = TRAY.body + TRAY.rimHeight + TRAY.bevel
  for (const [sx, sz] of [[1, 1], [-1, 1], [-1, -1], [1, -1]] as const) {
    for (let i = 0; i <= 4; i++) {
      const a = (i / 4) * (Math.PI / 2)
      const x = sx * (hx - r + Math.cos(a) * r)
      const z = sz * (hz - r + Math.sin(a) * r)
      for (const y of [-0.06, top]) pts.push(new THREE.Vector3(x, y, z))
    }
  }
  return pts
})()

const fitCam = new THREE.PerspectiveCamera(FOV, 1, 0.1, 60)
const fitPt = new THREE.Vector3()
const fitCache = new Map<string, number>()
const UP = new THREE.Vector3(0, 1, 0)

/**
 * Camera distance for the pick view. Projects the outline through the real perspective (the near
 * edge widens as the camera comes closer) and backs off until every point sits inside the slot.
 */
function pickDistance(aspect: number, portrait: boolean) {
  const key = `${aspect.toFixed(3)}${portrait ? 'p' : 'l'}`
  const hit = fitCache.get(key)
  if (hit !== undefined) return hit
  fitCam.aspect = aspect
  fitCam.updateProjectionMatrix()
  const turn = portrait ? -Math.PI / 2 : 0
  const fits = (d: number) => {
    fitCam.position.set(0, Math.sin(PICK_ELEVATION) * d, Math.cos(PICK_ELEVATION) * d)
    fitCam.lookAt(0, -0.02, 0.06)
    fitCam.updateMatrixWorld()
    for (const p of OUTLINE) {
      fitPt.copy(p).applyAxisAngle(UP, turn).project(fitCam)
      if (Math.abs(fitPt.x) > PICK_FILL || Math.abs(fitPt.y) > PICK_FILL) return false
    }
    return true
  }
  let lo = 1.5
  let hi = 40
  for (let i = 0; i < 22; i++) {
    const mid = (lo + hi) / 2
    if (fits(mid)) hi = mid
    else lo = mid
  }
  if (fitCache.size > 200) fitCache.clear()
  fitCache.set(key, hi)
  return hi
}

function fitDistance(aspect: number, w: number, h: number) {
  const v = THREE.MathUtils.degToRad(FOV) / 2
  const hz = Math.atan(Math.tan(v) * aspect)
  return Math.max(w / 2 / Math.tan(hz), h / 2 / Math.tan(v))
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}

/** Clicks and hovers that land on page UI belong to the UI, not to the tray behind it. */
const UI = 'a,button,input,select,textarea,label,summary,[role="dialog"],[role="button"],[data-tray-ignore]'
function fromUi(e: { nativeEvent: Event }) {
  const t = e.nativeEvent.target
  return t instanceof Element && !!t.closest(UI)
}

const poseTarget = (phase: TrayState['phase'], current: number) =>
  phase === 'hero' ? 0 : phase === 'away' ? current : 1

const tmp = new THREE.Vector3()
const box = new THREE.Box2()
const pt = new THREE.Vector2()

/** Plan-space outline points of a compartment (x right, y away), for projecting its screen rect. */
function compartmentCorners(c: Compartment): [number, number][] {
  if (c.kind === 'circle') {
    return [0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
      const a = (i / 8) * Math.PI * 2
      return [c.cx + Math.cos(a) * c.r, c.cy + Math.sin(a) * c.r]
    })
  }
  return [
    [c.x, c.y],
    [c.x + c.w, c.y],
    [c.x, c.y + c.h],
    [c.x + c.w, c.y + c.h],
  ]
}

interface RigProps {
  wrap: RefObject<HTMLDivElement | null>
  reduced: boolean
}

function Rig({ wrap, reduced }: RigProps) {
  const { camera, invalidate, size } = useThree()
  const tray = useRef<THREE.Group>(null)
  const shadow = useRef<THREE.Mesh>(null)
  const floorShade = useRef(0)
  const shadowTexture = useMemo(() => buildShadowTexture('#3a1626'), [])
  useEffect(() => () => shadowTexture.dispose(), [shadowTexture])
  const colors = useMemo(() => readTokenColors(), [])
  const coarse = useMemo(() => window.matchMedia('(pointer: coarse)').matches, [])

  const phase = useTray((s) => s.phase)
  const picks = useTray((s) => s.picks)
  const available = useTray((s) => s.available)
  const focus = useTray((s) => s.focus)
  const [hoveredWell, setHoveredWell] = useState<GroupId | null>(null)
  const heroHover = useTrayHovered()
  const picking = phase === 'pick'

  const a = useRef({
    slot: { x: sp(), y: sp(), w: sp(1), h: sp(1) },
    lastSlot: null as TrayState['slot'],
    /** The slot rect seen last frame, to tell a page scroll apart from a real move. */
    prevSlot: null as TrayState['slot'],
    opacity: '',
    visibility: '',
    slotGoneAt: 0,
    presence: sp(0),
    pose: sp(poseTarget(trayStore.get().phase, 0)),
    tiltX: sp(),
    tiltY: sp(),
    lift: sp(),
    pointer: new THREE.Vector2(),
    shown: false,
    phase: trayStore.get().phase,
    t: 0,
    /** Counts the rig's frames, so screen projections can be cached until the tray moves again. */
    frame: 0,
  })

  // Any store change wakes the loop. A vanished slot needs one more look after the grace period.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const off = trayStore.subscribe(() => {
      invalidate()
      if (!trayStore.get().slot) {
        clearTimeout(timer)
        timer = setTimeout(() => invalidate(), (noren.get() ? NOREN_GRACE_MS : SLOT_GRACE_MS) + 30)
      }
    })
    const offBus = stageBus.subscribe(() => invalidate())
    const onVis = () => invalidate()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      off()
      offBus()
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [invalidate])

  // Leaving the hero clears its hover; entering packed gives the tray a small celebratory hop.
  useEffect(() => {
    const st = a.current
    if (phase !== 'hero') stageBus.setHovered(false)
    if (phase === 'packed' && st.phase !== 'packed' && !reduced) st.lift.v += 3.2
    st.phase = phase
    setHoveredWell(null)
    invalidate()
  }, [phase, reduced, invalidate])

  // The pointer anywhere on the page steers the tilt. Touch is ignored: a tap would yank the tray.
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      const st = a.current
      const cx = st.slot.x.x + st.slot.w.x / 2
      const cy = st.slot.y.x + st.slot.h.x / 2
      const x = (e.clientX - cx) / (window.innerWidth * 0.5)
      const y = -(e.clientY - cy) / (window.innerHeight * 0.5)
      st.pointer.set(THREE.MathUtils.clamp(x, -1, 1), THREE.MathUtils.clamp(y, -1, 1))
      invalidate()
    }
    const onLeave = () => {
      a.current.pointer.set(0, 0)
      invalidate()
    }
    window.addEventListener('pointermove', onMove)
    document.documentElement.addEventListener('pointerleave', onLeave)
    return () => {
      window.removeEventListener('pointermove', onMove)
      document.documentElement.removeEventListener('pointerleave', onLeave)
    }
  }, [invalidate])

  const pointerCursor = (picking && hoveredWell !== null) || (phase === 'hero' && heroHover)
  useEffect(() => {
    document.body.classList.toggle('tray-pointer', pointerCursor)
    return () => document.body.classList.remove('tray-pointer')
  }, [pointerCursor])

  // Screen projections for DOM overlays (Ume, the stamp, labels). Overlays poll these every
  // animation frame while the tray may draw at 30 fps or not at all, so each answer is kept until
  // the tray's next frame: a repeat call between frames costs a map lookup, not a projection.
  // The canvas covers the viewport from its top left corner, so its size (kept by the canvas,
  // updated on resize) maps clip space to viewport pixels without reading window sizes per call.
  const getState = useThree((st) => st.get)
  useEffect(() => {
    const cache = new Map<string, unknown>()
    let cachedFrame = -1
    const memo = <T,>(key: string, compute: () => T): T => {
      if (cachedFrame !== a.current.frame) {
        cache.clear()
        cachedFrame = a.current.frame
      }
      if (cache.has(key)) return cache.get(key) as T
      const v = compute()
      cache.set(key, v)
      return v
    }
    const project = (corners: [number, number, number][]) => {
      const g = tray.current
      if (!g || a.current.presence.x < 0.05) return null
      g.updateWorldMatrix(true, false)
      box.makeEmpty()
      const { width: w, height: h } = getState().size
      for (const [x, y, z] of corners) {
        tmp.set(x, y, z).applyMatrix4(g.matrixWorld).project(camera)
        box.expandByPoint(pt.set(((tmp.x + 1) / 2) * w, ((1 - tmp.y) / 2) * h))
      }
      return new DOMRect(box.min.x, box.min.y, box.max.x - box.min.x, box.max.y - box.min.y)
    }
    const top = TRAY.body + TRAY.rimHeight + TRAY.bevel
    const trayCorners: [number, number, number][] = []
    for (const x of [-1, 1]) for (const z of [-1, 1]) for (const y of [-0.06, top]) trayCorners.push([(x * TRAY.width) / 2, y, (z * TRAY.depth) / 2])
    trayProjector.register({
      tray: () => memo('tray', () => project(trayCorners)),
      compartment: (id: Component) =>
        memo(`c:${id}`, () => {
          const comp = COMPARTMENTS.find((c) => c.id === id)
          if (!comp) return null
          const c: [number, number, number][] = []
          for (const [x, y] of compartmentCorners(comp)) for (const hy of [TRAY.floor, TRAY.body]) c.push([x, hy, -y])
          return project(c)
        }),
    })
    stageBus.registerPresence(() => a.current.presence.x)
    stageBus.registerRim((u, v) =>
      memo(`r:${u}:${v}`, () => {
        const g = tray.current
        if (!g || a.current.presence.x < 0.05) return null
        g.updateWorldMatrix(true, false)
        tmp.set(u * (TRAY.width / 2 - TRAY.rim / 2), top, -v * (TRAY.depth / 2 - TRAY.rim / 2))
        tmp.applyMatrix4(g.matrixWorld).project(camera)
        const { width: w, height: h } = getState().size
        return { x: ((tmp.x + 1) / 2) * w, y: ((1 - tmp.y) / 2) * h }
      }),
    )
    return () => {
      trayProjector.register(null)
      stageBus.registerRim(null)
      stageBus.registerPresence(null)
    }
  }, [camera, getState])

  useFrame((state, dt) => {
    const g = tray.current
    const st = a.current
    if (!g) return
    st.frame++
    const store = trayStore.get()
    const now = performance.now()
    let moving = false

    // Which rect to frame in. A missing slot is held for a moment before the tray hides.
    if (store.slot) {
      st.lastSlot = store.slot
      st.slotGoneAt = 0
    } else if (st.lastSlot && !st.slotGoneAt) {
      st.slotGoneAt = now
    }
    const grace = noren.get() ? NOREN_GRACE_MS : SLOT_GRACE_MS
    const slotLive = !!store.slot || (!!st.lastSlot && now - st.slotGoneAt < grace)
    const want = slotLive && store.phase !== 'away' ? 1 : 0
    const target = st.lastSlot

    // Scrolling and layout shifts: the same slot moving without changing size is the page
    // carrying it. Move the framing by the same amount in this same frame instead of springing
    // after it, so the tray stays glued to the page. A new slot or a new size still glides.
    const prev = st.prevSlot
    const s = store.slot
    if (s && prev && s !== prev && s.key !== undefined && s.key === prev.key && Math.abs(s.width - prev.width) < 0.5 && Math.abs(s.height - prev.height) < 0.5) {
      st.slot.x.x += s.x - prev.x
      st.slot.y.x += s.y - prev.y
    }
    if (store.slot) st.prevSlot = store.slot

    // First appearance (or back from hidden): jump straight to the new framing and pose.
    if (want === 1 && st.presence.x < 0.02 && target) {
      st.slot.x.x = target.x
      st.slot.y.x = target.y
      st.slot.w.x = target.width
      st.slot.h.x = target.height
      st.pose.x = poseTarget(store.phase, st.pose.x)
      st.pose.v = 0
    }
    if (target) {
      moving = step(st.slot.x, target.x, SLOT, dt, 0.1, reduced) || moving
      moving = step(st.slot.y, target.y, SLOT, dt, 0.1, reduced) || moving
      moving = step(st.slot.w, Math.max(target.width, 1), SLOT, dt, 0.1, reduced) || moving
      moving = step(st.slot.h, Math.max(target.height, 1), SLOT, dt, 0.1, reduced) || moving
    }
    moving = step(st.presence, want, PRESENCE, dt, 1e-3, reduced) || moving
    moving = step(st.pose, poseTarget(store.phase, st.pose.x), POSE, dt, 1e-4, reduced) || moving
    // Landed: visible and sitting in the slot it was asked for. Loose thresholds on purpose, so
    // screens get the signal as the tray settles, not after the last sub-pixel of overshoot.
    const near = (s: Spring, to: number) => Math.abs(to - s.x) < 2 && Math.abs(s.v) < 40
    const landed =
      want === 1 &&
      !!store.slot &&
      !!target &&
      st.presence.x > 0.9 &&
      near(st.slot.x, target.x) &&
      near(st.slot.y, target.y) &&
      near(st.slot.w, Math.max(target.width, 1)) &&
      near(st.slot.h, Math.max(target.height, 1)) &&
      Math.abs(poseTarget(store.phase, st.pose.x) - st.pose.x) < 0.02
    if (landed !== store.landed) queueMicrotask(() => trayStore.set({ landed }))
    const p = THREE.MathUtils.clamp(st.pose.x, -0.1, 1.1)
    floorShade.current = p
    const pres = Math.max(0, Math.min(1, st.presence.x))

    // Show or hide the whole canvas; nothing to draw means no frames at all.
    const el = wrap.current
    if (el) {
      // Only touch the style when it changes, so a still tray costs no style work.
      const opacity = pres > 0.999 ? '1' : pres.toFixed(3)
      const visibility = pres < 0.003 && want === 0 ? 'hidden' : 'visible'
      if (opacity !== st.opacity) el.style.opacity = st.opacity = opacity
      if (visibility !== st.visibility) el.style.visibility = st.visibility = visibility
    }
    if (pres < 0.003 && want === 0 && !moving) {
      // One last word to the riders, so they hide with the tray.
      stageBus.frame()
      return
    }

    // Pointer tilt on a spring: the target follows the pointer, the tray chases it with some lag.
    const hero = store.phase === 'hero'
    const tiltAmount = lerp(MAX_TILT, PICK_TILT, THREE.MathUtils.clamp(p, 0, 1))
    moving = step(st.tiltX, reduced ? 0 : st.pointer.x * tiltAmount, TILT, dt, 1e-4, reduced) || moving
    moving = step(st.tiltY, reduced ? 0 : st.pointer.y * tiltAmount, TILT, dt, 1e-4, reduced) || moving
    const liftTarget = hero && stageBus.isHovered() ? 1 : 0
    moving = step(st.lift, liftTarget, LIFT, dt, 1e-4, reduced) || moving

    // Idle drift: hero only, keeps going after the pointer stops.
    if (!reduced) st.t += Math.min(dt, 0.1)
    const t = st.t
    const idle = reduced ? 0 : Math.max(0, 1 - p)
    const sway = coarse ? 1.6 : 1
    const bob = idle * Math.sin(t * 1.1) * 0.07
    const swayX = idle * Math.sin(t * 0.45) * 0.035 * sway
    const swayY = idle * Math.sin(t * 0.33 + 1.2) * 0.06 * sway

    const W = st.slot.w.x
    const H = st.slot.h.x
    const aspect = W / Math.max(H, 1)
    const portrait = aspect < 0.8

    g.rotation.set(
      lerp(0.5, 0, p) - st.tiltY.x + swayX,
      lerp(-0.42, portrait ? -Math.PI / 2 : 0, p) + st.tiltX.x * 0.9 + swayY,
      lerp(0.07, 0, p) - st.tiltX.x * 0.35,
    )
    const away = 1 - pres
    g.position.set(0, bob + st.lift.x * 0.12 + lerp(0.1, 0, p) - away * 1.2, 0)
    g.scale.setScalar((1 + st.lift.x * 0.03) * lerp(0.86, 1, pres))

    // Camera: frames the tray inside the slot. The projection is the slot's own view, shifted so
    // the slot lands at its place on the full-screen canvas.
    const elevation = lerp(0.32, PICK_ELEVATION, p)
    const heroDist = fitDistance(aspect, TRAY.width * 1.24, TRAY.depth * 1.5)
    const pickDist = pickDistance(aspect, portrait)
    const dist = lerp(heroDist, pickDist, p)
    const cam = camera as THREE.PerspectiveCamera
    cam.position.set(0, Math.sin(elevation) * dist, Math.cos(elevation) * dist)
    cam.lookAt(0, lerp(0.05, -0.02, p), lerp(0, 0.06, p))
    cam.aspect = aspect
    cam.setViewOffset(W, H, -st.slot.x.x, -st.slot.y.x, size.width, size.height)
    cam.updateProjectionMatrix()
    // The pose and camera changed: cached projections from earlier in this frame are stale.
    st.frame++

    // Soft contact shadow, following the tray's turn and softening as it rises.
    const sh = shadow.current
    if (sh) {
      const height = g.position.y - SHADOW_Y
      const spread = 1 + Math.max(height, 0) * 0.18
      sh.rotation.set(-Math.PI / 2, 0, g.rotation.y)
      sh.scale.set(TRAY.width * 1.2 * spread, TRAY.depth * 1.35 * spread, 1)
      ;(sh.material as THREE.MeshBasicMaterial).opacity = (lerp(0.55, 0.32, THREE.MathUtils.clamp(p, 0, 1)) / (spread * spread)) * pres
    }

    // Riders (the hero mascot) move with this exact pose, in this same frame.
    stageBus.frame()

    // Next frame: right away while anything springs, at a gentle 30 fps for the idle drift alone,
    // and nothing at all when the tray is still or the tab is hidden.
    if (document.hidden) return
    // The drift moves the tray well under a pixel per frame, so 30 fps looks the same as 60.
    if (moving) state.invalidate()
    else if (hero && !reduced) stageBus.idleFrame(state.invalidate)
  })

  const over = useCallback((id: GroupId, e: ThreeEvent<PointerEvent> | ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (fromUi(e)) return
    setHoveredWell(id)
  }, [])
  const out = useCallback((id: GroupId) => setHoveredWell((cur) => (cur === id ? null : cur)), [])
  const select = useCallback((id: GroupId, e: ThreeEvent<PointerEvent> | ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (fromUi(e)) return
    trayEvents.emit({ type: 'compartment', component: id })
  }, [])

  const lit = useMemo(() => {
    if (!picking) return []
    const l: GroupId[] = []
    if (hoveredWell && available.includes(hoveredWell)) l.push(hoveredWell)
    if (focus && !l.includes(focus)) l.push(focus)
    return l
  }, [picking, hoveredWell, focus, available])

  return (
    <>
      <mesh ref={shadow} position={[0, SHADOW_Y, 0]} rotation-x={-Math.PI / 2} renderOrder={-1}>
        <planeGeometry />
        <meshBasicMaterial map={shadowTexture} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      <group ref={tray}>
        <TrayModel
          colors={colors}
          picking={picking}
          available={available}
          lit={lit}
          reduced={reduced}
          floorShade={floorShade}
          onOver={over}
          onOut={out}
          onSelect={select}
        />
        {COMPARTMENTS.map((c, i) => {
          const v = picks[c.id]
          if (v === undefined) return null
          const [x, y] = compartmentCenter(c)
          const [w, d] = compartmentSize(c)
          const fit = Math.min(w, d) * (c.kind === 'circle' ? 0.86 : 0.8)
          return (
            <group key={c.id} position={[x, TRAY.floor, -y]}>
              {typeof v === 'string' ? (
                <FoodDrop key={v} itemId={v} component={c.id} size={fit} reducedMotion={reduced} />
              ) : (
                <PaperSlip size={Math.min(w, d) * 1.05} turn={[-0.35, 0.22, -0.12, 0.4, -0.25][i]} reducedMotion={reduced} />
              )}
            </group>
          )
        })}
        {phase === 'hero' && (
          // One cheap box for hero hover and tap, instead of raycasting the detailed tray.
          <mesh
            position={[0, 0.1, 0]}
            onPointerOver={(e) => {
              e.stopPropagation()
              // A finger resting on the hero (or starting a swipe) is not a hover: no lift, so a
              // touch does not wake the tray at full frame rate. A tap still opens the game.
              if (e.pointerType === 'touch') return
              if (!fromUi(e)) stageBus.setHovered(true)
            }}
            onPointerOut={() => stageBus.setHovered(false)}
            onClick={(e) => {
              e.stopPropagation()
              if (fromUi(e)) return
              trayEvents.emit({ type: 'enter' })
            }}
          >
            <boxGeometry args={[TRAY.width + 0.1, 0.4, TRAY.depth + 0.1]} />
            <meshBasicMaterial visible={false} />
          </mesh>
        )}
      </group>
    </>
  )
}

function Studio() {
  const { gl, scene, invalidate } = useThree()
  useEffect(() => {
    const target = buildStudioEnvironment(gl)
    scene.environment = target.texture
    invalidate()
    return () => {
      scene.environment = null
      target.dispose()
    }
  }, [gl, scene, invalidate])
  return null
}

/** Visually hidden buttons, so keyboard and screen reader users can do everything a tap can. */
function StageControls() {
  const phase = useTray((s) => s.phase)
  const available = useTray((s) => s.available)
  const slot = useTray((s) => s.slot)
  if (!slot) return null
  if (phase === 'hero') {
    return (
      <div className="tray-a11y">
        <button
          type="button"
          onClick={() => trayEvents.emit({ type: 'enter' })}
          onFocus={() => stageBus.setHovered(true)}
          onBlur={() => stageBus.setHovered(false)}
        >
          {copy.tray.open}
        </button>
      </div>
    )
  }
  if (phase !== 'pick') return null
  return (
    <div className="tray-a11y" role="group" aria-label={copy.tray.compartments}>
      {COMPARTMENTS.filter((c) => available.includes(c.id)).map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => trayEvents.emit({ type: 'compartment', component: c.id })}
          onFocus={() => trayStore.set({ focus: c.id })}
        >
          {copy.tray.choose(copy.tray.names[c.id])}
        </button>
      ))}
    </div>
  )
}

/**
 * The persistent tray stage. Mount once in the shell, behind the page. Default export so it can
 * be lazy loaded: three.js only downloads on the screens that show the tray.
 */
export default function TrayStage() {
  const reduced = usePrefersReducedMotion()
  const dpr = useStageDpr()
  const raised = useNoren() !== 0
  const wrap = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!import.meta.env.DEV) return
    // Handy in the console and in screenshot scripts: poke the tray without the game screens.
    ;(window as unknown as { __tray?: unknown }).__tray = { store: trayStore, events: trayEvents, projector: trayProjector }
  }, [])

  return (
    <div ref={wrap} className={raised ? 'tray-stage is-raised' : 'tray-stage'} style={{ opacity: 0, visibility: 'hidden' }}>
      <Canvas
        frameloop="demand"
        dpr={dpr}
        eventSource={document.body}
        eventPrefix="client"
        camera={{ fov: FOV, near: 0.1, far: 60, position: [0, 2, 9] }}
        gl={{ antialias: true, alpha: true, toneMapping: THREE.NeutralToneMapping, powerPreference: 'high-performance' }}
        onCreated={({ camera }) => {
          // The rig owns aspect and view offset every frame; stop the canvas from resetting them.
          ;(camera as THREE.PerspectiveCamera & { manual?: boolean }).manual = true
        }}
      >
        <Studio />
        <directionalLight position={[2, 5, 3]} intensity={1.3} />
        <directionalLight position={[-3, 2, 4]} intensity={0.35} color="#ffd6e0" />
        <ambientLight intensity={0.22} />
        <Rig wrap={wrap} reduced={reduced} />
        <HeroFoods />
      </Canvas>
      <StageControls />
    </div>
  )
}
