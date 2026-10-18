// The one WebGL canvas every mascot on the page shares. It is fixed over the whole viewport,
// above the page but below the header, tab bar, sheets, toasts and curtains (z-index in
// ume.css), and it never takes pointer events. Each mascot gets its own patch of the canvas,
// cut with a scissor to the stage box its DOM element reports, and its own camera. All the
// models live in one scene, spaced far apart, so the lights and the environment are shared.
//
// The rig here owns every whole-body motion (hops, squash and stretch, spins, tilt, breathing,
// petting wobble) and feeds the model its RigInput each frame (see ./contract.ts).
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Component, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from 'react'
import * as THREE from 'three'
import type { MascotId } from '../../theme/types'
import { FEET, STAGE, pointer, rigBus, type MascotHandle, type RigCommand } from '../rig/bus'
import type { RigInput } from './contract'
import { ToyLights } from './lights'
import { MODELS } from './models'

/** World units per slot width: the 1 unit tall model fills about 87% of its slot. */
const UNITS_PER_SLOT = 1.15
const FOV = 20
const SPACING = 40
/** How long the canvas lingers after the last mascot leaves, so a route change does not rebuild it. */
const LINGER_MS = 3000
/**
 * Frame pacing. The canvas only draws on demand: at full rate while a mascot hops, wiggles,
 * looks around, talks or blinks; at 30 fps while it only breathes and sways (a few pixels over
 * seconds, so the eye cannot tell); and not at all while no mascot is on screen.
 */
const CALM_FRAME_MS_FINE = 1000 / 30 - 5
/**
 * Phones and tablets: 20 fps for the calm breathing, the same pace as the tray's idle drift there
 * (see stageBus), so the hero mascot riding the rim moves in step with it and the phone's GPU
 * draws the full-screen canvas a third less often. Quick moves still get full rate.
 */
const CALM_FRAME_MS_TOUCH = 1000 / 20 - 5
const CALM_FRAME_MS = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches ? CALM_FRAME_MS_TOUCH : CALM_FRAME_MS_FINE
/** Tiny mascots (the header badge) breathe well under a pixel per frame: 12 fps looks the same. */
const TINY_CALM_FRAME_MS = 1000 / 12 - 5
const TINY_SIZE = 40
/** While nothing is on screen, how often to look again (a stage shown by CSS, a queued move). */
const ASLEEP_POLL_MS = 250
/** Moods whose own loops (wing flaps, flutters) are quick enough to want full frame rate. */
const LIVELY = new Set(['happy', 'excited', 'petted', 'surprised'])
/** Mood poses ease in over about half a second; keep full rate a little longer than that. */
const MOOD_EASE_S = 0.8

/** What this frame drew and asked for. Reset by Clear, filled by each Instance, acted on by Pace. */
type Plan = {
  cleared: boolean
  drew: boolean
  drewLast: boolean
  fast: boolean
  calm: boolean
  calmMs: number
  timer: number
  hidden: boolean
  /** The phone tab bar's box this frame (null: none), measured by the first mascot that needs it. */
  bar?: DOMRect | null
}
/** One canvas exists at a time, so one plan. */
const plan: Plan = { cleared: false, drew: false, drewLast: false, fast: false, calm: false, calmMs: CALM_FRAME_MS, timer: 0, hidden: false }
/** Last mood each handle's rig has acted on, so the asleep poll can spot a change. */
const seenMood = new Map<number, string>()

type Spring = { x: number; v: number }
const sp = (x: number): Spring => ({ x, v: 0 })

/** Semi-implicit Euler in small slices, so a long frame cannot blow it up. */
function step(s: Spring, target: number, k: number, c: number, dt: number) {
  let left = Math.min(dt, 0.1)
  while (left > 0) {
    const h = Math.min(left, 1 / 120)
    s.v += (k * (target - s.x) - c * s.v) * h
    s.x += s.v * h
    left -= h
  }
}

const rand = (a: number, b: number) => a + Math.random() * (b - a)
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
const ease = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2)
const damp = (from: number, to: number, rate: number, dt: number) => from + (to - from) * (1 - Math.exp(-rate * dt))

type Idle = 'look' | 'wiggle' | 'wave' | 'hop' | 'dance' | 'stretch' | 'sway'

/** Idle habits per mascot, as a weighted bag. */
const HABITS: Record<MascotId, Idle[]> = {
  chispa: ['wiggle', 'wiggle', 'wave', 'wave', 'hop', 'dance', 'look'],
  ume: ['look', 'look', 'stretch', 'sway', 'hop', 'stretch'],
  lafa: ['sway', 'wiggle', 'look', 'look', 'wave', 'dance', 'hop'],
}

type Jump = { phase: 'antic' | 'air'; t: number; T: number; h: number; spin: number; travel: boolean }
type Queued = { h: number; spin: number; travel?: number; delay: number }

/** All the per-mascot motion state. Mutated in place every frame, never in React state. */
function makeSim() {
  return {
    sy: sp(1),
    scale: sp(0),
    tilt: sp(0),
    turn: sp(0),
    nod: sp(0),
    back: sp(0),
    y: 0,
    spin: 0,
    jump: null as Jump | null,
    queue: [] as Queued[],
    wait: 0,
    puffUntil: 0,
    stretchUntil: 0,
    swayUntil: 0,
    wiggle: 0,
    lookOverride: null as { x: number; y: number; until: number } | null,
    nextIdle: rand(4, 8),
    blinkAt: rand(2.5, 5),
    blinkT: -1,
    blinkTwice: false,
    pet: 0,
    lastMood: 'idle' as string,
    moodLoop: 0,
    talkSince: -1,
    visibleCheck: 0,
    visible: true,
    swapping: false,
    moodAt: 0,
  }
}
type Sim = ReturnType<typeof makeSim>

function queueHop(sim: Sim, h: number, spin = 0, delay = 0) {
  if (sim.queue.length < 4) sim.queue.push({ h, spin, delay })
}

function runCommand(sim: Sim, cmd: RigCommand, reduced: boolean, time: number) {
  if (cmd.type === 'squish') {
    sim.sy.x = Math.min(sim.sy.x, 0.9)
    return
  }
  if (reduced) return
  switch (cmd.type) {
    case 'hop':
      queueHop(sim, cmd.height ?? 0.16, cmd.spin ?? 0)
      break
    case 'double':
      queueHop(sim, 0.26)
      queueHop(sim, 0.32, 0, 0.04)
      break
    case 'jumpBack':
      sim.back.v -= 3.2
      sim.nod.v -= 2.4
      queueHop(sim, 0.12)
      break
    case 'puff':
      sim.puffUntil = time + 1.8
      break
    case 'wiggle':
      sim.wiggle = 1
      break
    case 'air':
      sim.queue.push({ h: 0, spin: 0, travel: cmd.ms / 1000, delay: 0 })
      break
  }
}

function startIdle(sim: Sim, kind: Idle, input: RigInput, time: number) {
  switch (kind) {
    case 'look':
      sim.lookOverride = { x: rand(-0.9, 0.9), y: rand(-0.3, 0.6), until: time + rand(1.2, 2.2) }
      break
    case 'wiggle':
      sim.wiggle = 1
      break
    case 'wave':
      input.bounce = 1
      sim.wiggle = 0.5
      break
    case 'hop':
      queueHop(sim, 0.14)
      break
    case 'dance':
      sim.wiggle = 1
      queueHop(sim, 0.1)
      queueHop(sim, 0.1, 0, 0.05)
      queueHop(sim, 0.16, 0, 0.05)
      break
    case 'stretch':
      sim.stretchUntil = time + 1.1
      break
    case 'sway':
      sim.swayUntil = time + 2.4
      break
  }
}

/** Mood choreography: what happens when a mood starts, and the loop while it lasts. */
function moodTick(sim: Sim, mood: string, dt: number, entered: boolean, time: number) {
  if (entered) {
    sim.moodLoop = 0
    if (mood === 'happy') queueHop(sim, 0.24, 1)
    if (mood === 'excited') {
      queueHop(sim, 0.26)
      queueHop(sim, 0.34, 0, 0.04)
    }
    if (mood === 'surprised') {
      sim.back.v -= 3.2
      sim.nod.v -= 2.4
      queueHop(sim, 0.12)
    }
    if (mood === 'proud') sim.puffUntil = time + 3
    if (mood === 'petted') sim.wiggle = 0.7
    return
  }
  sim.moodLoop += dt
  if (mood === 'happy' && sim.moodLoop > 0.95) {
    sim.moodLoop = 0
    queueHop(sim, 0.1)
  }
  if (mood === 'excited' && sim.moodLoop > 1.5) {
    sim.moodLoop = 0
    queueHop(sim, 0.22)
    queueHop(sim, 0.28, 0, 0.04)
  }
}

/** The soft contact shadow under each mascot. One per canvas, disposed with it (see Scene). */
function makeContactShadow() {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.45, 'rgba(255,255,255,0.55)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(c)
}

// Each mascot gets its own spot in the shared scene, far from the others, so no camera sees two.
const taken = new Set<number>()
function takeSpot() {
  let n = 0
  while (taken.has(n)) n++
  taken.add(n)
  return n
}

function Ready({ onReady }: { onReady: () => void }) {
  useLayoutEffect(onReady, [onReady])
  return null
}

function Instance({ h, shadowMap }: { h: MascotHandle; shadowMap: THREE.Texture }) {
  const { gl, size: canvas, invalidate } = useThree()
  const [shown, setShown] = useState<MascotId>(h.mascot)
  const body = useRef<THREE.Group>(null)
  const shadow = useRef<THREE.Mesh>(null)
  // The motion state and the camera are mutated every frame, so they live in refs, made on first use.
  const simRef = useRef<Sim | null>(null)
  const getSim = () => (simRef.current ??= makeSim())
  const camRef = useRef<THREE.PerspectiveCamera | null>(null)
  const input = useRef<RigInput>({ mood: h.mood, pet: 0, look: { x: 0, y: 0 }, blink: 0, talk: 0, time: 0, bounce: 0 })
  const [spot] = useState(takeSpot)
  useEffect(() => () => void taken.delete(spot), [spot])
  const gx = spot * SPACING
  const loaded = useRef(false)
  const wasReady = useRef(false)

  const onReady = useMemo(
    () => () => {
      const sim = getSim()
      loaded.current = true
      if (!wasReady.current) {
        wasReady.current = true
        // First appearance: a quick pop rather than a cut. Reduced motion just shows it.
        if (h.reduced) sim.scale.x = 1
        else {
          sim.scale.x = 0.55
          sim.sy.x = 1.15
        }
        rigBus.markReady(h)
      } else if (sim.swapping) {
        sim.swapping = false
        if (!h.reduced) {
          sim.scale.x = 0.3
          sim.sy.x = 1.25
          queueHop(sim, 0.24, 1, 0.1)
        } else sim.scale.x = 1
      }
      invalidate()
    },
    [h, invalidate],
  )

  useFrame((state, dt) => {
    const i = input.current
    const g = body.current
    if (!g) return
    const sim = getSim()
    i.time += dt
    const t = i.time
    const reduced = h.reduced

    // ---- Where the stage box is, and whether to draw at all.
    const r = h.stage.getBoundingClientRect()
    if (--sim.visibleCheck <= 0) {
      sim.visibleCheck = 12
      const el = h.stage as HTMLElement & { checkVisibility?: (o: object) => boolean }
      sim.visible = el.checkVisibility ? el.checkVisibility({ opacityProperty: true, visibilityProperty: true }) : true
    }
    const onScreen = sim.visible && r.width > 2 && r.bottom > 0 && r.top < canvas.height && r.right > 0 && r.left < canvas.width

    // ---- World swap: hop out, change the model, pop back in.
    if (h.mascot !== shown && !sim.swapping) {
      if (reduced || !onScreen || !loaded.current) {
        setShown(h.mascot)
        sim.swapping = true
      } else if (sim.scale.x < 0.08) {
        setShown(h.mascot)
        sim.swapping = true
        sim.scale.x = 0
        sim.scale.v = 0
      }
    }
    const leaving = h.mascot !== shown

    // ---- Commands, mood, idle habits.
    for (let cmd = rigBus.nextCommand(h); cmd; cmd = rigBus.nextCommand(h)) runCommand(sim, cmd, reduced, t)
    const mood = h.mood
    i.mood = mood
    const entered = mood !== sim.lastMood
    sim.lastMood = mood
    seenMood.set(h.id, mood)
    if (entered) sim.moodAt = t
    if (!reduced) {
      moodTick(sim, mood, dt, entered, t)
      if (mood === 'idle' || mood === 'sleepy' || mood === 'curious') {
        sim.nextIdle -= dt
        if (sim.nextIdle <= 0 && !sim.jump && onScreen) {
          sim.nextIdle = rand(5, 12)
          const bag = HABITS[shown]
          const pick = mood === 'sleepy' ? (Math.random() < 0.6 ? 'stretch' : 'sway') : bag[Math.floor(Math.random() * bag.length)]
          startIdle(sim, pick, i, t)
        }
      }
    } else sim.queue.length = 0

    // ---- Hops: anticipation squash, stretch on the way up, squash on landing.
    if (!sim.jump && sim.queue.length && !leaving) {
      sim.wait -= dt
      if (sim.wait <= 0) {
        const q = sim.queue.shift()!
        sim.jump = { phase: 'antic', t: 0, T: q.travel ?? 0.3 + q.h * 0.75, h: q.h, spin: q.spin, travel: q.travel !== undefined }
        sim.wait = sim.queue[0]?.delay ?? 0
      }
    }
    let syTarget = 1
    const j = sim.jump
    if (j) {
      j.t += dt
      if (j.phase === 'antic') {
        syTarget = 0.84
        if (j.t > 0.085) {
          j.phase = 'air'
          j.t = 0
          sim.sy.x = 1.14 + j.h * 0.2
          sim.sy.v = 0
        }
      } else {
        const p = Math.min(1, j.t / j.T)
        sim.y = j.travel ? 0 : 4 * j.h * p * (1 - p)
        sim.spin = j.spin * Math.PI * 2 * ease(p)
        syTarget = p < 0.55 ? 1.08 : 1
        if (p >= 1) {
          sim.y = 0
          sim.spin = 0
          sim.sy.x = Math.min(sim.sy.x, 0.8 - Math.min(0.12, j.h * 0.25))
          sim.sy.v = 0
          i.bounce = 1
          sim.jump = null
        }
      }
    }

    // ---- Pet level builds with each pet and drains smoothly.
    const kick = rigBus.takeKick(h)
    if (kick) sim.pet = Math.min(1, sim.pet + kick)
    sim.pet = Math.max(0, sim.pet - dt * 0.45)
    i.pet = damp(i.pet, sim.pet, 6, dt)
    const pet = i.pet

    // ---- Look: a fixed point, then the mouse (if it moved lately), else idle glances.
    const S = h.size
    const headX = r.left + r.width / 2
    const headY = r.top + (STAGE.top + FEET - 0.6) * S
    let lx = 0
    let ly = 0
    if (sim.lookOverride && t < sim.lookOverride.until) {
      lx = sim.lookOverride.x
      ly = sim.lookOverride.y
    } else {
      sim.lookOverride = null
      const target = h.lookAt ?? (pointer.at && performance.now() - pointer.at < 6000 ? pointer : null)
      if (target) {
        lx = clamp((target.x - headX) / 280, -1, 1)
        ly = clamp(-(target.y - headY) / 280, -1, 1)
      }
    }
    if (mood === 'thinking') {
      lx = 0.55
      ly = 0.6
    }
    if (mood === 'sleepy') ly = Math.min(ly, -0.2)
    i.look.x = damp(i.look.x, lx, 7, dt)
    i.look.y = damp(i.look.y, ly, 7, dt)

    // ---- Blink on a random 2.5 to 5 s timer, sometimes twice. Kept under reduced motion.
    if (sim.blinkT < 0 && t > sim.blinkAt) {
      sim.blinkT = 0
      sim.blinkTwice = Math.random() < 0.22
    }
    if (sim.blinkT >= 0) {
      sim.blinkT += dt
      const b = sim.blinkT
      const one = (s: number) => (s < 0 || s > 0.13 ? 0 : 1 - Math.abs(s - 0.065) / 0.065)
      i.blink = Math.max(one(b), sim.blinkTwice ? one(b - 0.2) : 0)
      if (b > (sim.blinkTwice ? 0.36 : 0.16)) {
        sim.blinkT = -1
        sim.blinkAt = t + rand(2.5, 5)
        i.blink = 0
      }
    }
    if (mood === 'petted' || pet > 0.5) i.blink = Math.max(i.blink, 0.85)

    // ---- Talking mouth: chatter for the first moment of each bubble.
    if (h.talking && sim.talkSince < 0) sim.talkSince = t
    if (!h.talking) sim.talkSince = -1
    const chatter = sim.talkSince >= 0 && t - sim.talkSince < 1.6 ? 0.35 + 0.65 * Math.abs(Math.sin((t - sim.talkSince) * 13)) : 0
    i.talk = damp(i.talk, chatter, 18, dt)
    i.bounce = Math.max(0, i.bounce - dt * 1.6)

    // ---- Whole body springs.
    const breatheAmp = reduced ? 0 : mood === 'sleepy' ? 0.035 : 0.022
    const breathe = 1 + breatheAmp * Math.sin(t * (mood === 'sleepy' ? 1.6 : 2.4))
    if (t < sim.stretchUntil) syTarget = Math.max(syTarget, 1.12)
    if (mood === 'petted' || pet > 0.05) syTarget -= 0.1 * Math.max(pet, mood === 'petted' ? 0.6 : 0)
    if (mood === 'sleepy') syTarget -= 0.03
    step(sim.sy, syTarget, 480, 11, dt)

    const puff = t < sim.puffUntil || mood === 'proud' ? 1.09 : 1
    const scaleTarget = leaving ? 0 : loaded.current ? puff : 0
    if (reduced) {
      sim.scale.x = scaleTarget
      sim.scale.v = 0
    } else step(sim.scale, scaleTarget, leaving ? 300 : 380, leaving ? 24 : 16, dt)

    const lookAmt = reduced ? 0 : 1
    let tiltTarget = -i.look.x * 0.07 * lookAmt
    if (mood === 'thinking') tiltTarget += 0.16
    if (!reduced && (mood === 'sleepy' || t < sim.swayUntil)) tiltTarget += Math.sin(t * 1.3) * 0.08
    step(sim.tilt, tiltTarget, 120, 14, dt)
    step(sim.turn, i.look.x * 0.42 * lookAmt, 90, 14, dt)
    step(sim.nod, (-i.look.y * 0.1 + (mood === 'proud' ? -0.12 : 0) + (mood === 'curious' ? 0.08 : 0)) * lookAmt, 120, 13, dt)
    step(sim.back, 0, 160, 16, dt)

    let wob = 0
    if (sim.wiggle > 0 && !reduced) {
      sim.wiggle = Math.max(0, sim.wiggle - dt * 1.1)
      wob = Math.sin(t * 17) * 0.13 * sim.wiggle
    }
    if (!reduced) wob += Math.sin(t * 13) * 0.06 * pet

    const sy = sim.sy.x * breathe
    const sx = 1 + (1 - sim.sy.x) * 0.9 + (mood === 'petted' ? 0.03 : 0) * pet
    const s = Math.max(0, sim.scale.x)
    g.position.set(gx, sim.y, sim.back.x)
    g.rotation.set(sim.nod.x, sim.turn.x + sim.spin, sim.tilt.x + wob)
    g.scale.set(sx * s, sy * s, sx * s)

    const sh = shadow.current
    if (sh) {
      const lift = Math.min(1, sim.y * 2.2)
      sh.scale.set(0.95 * sx * s * (1 - lift * 0.35), 0.42 * s * (1 - lift * 0.35), 1)
      ;(sh.material as THREE.MeshBasicMaterial).opacity = 0.3 * (1 - lift * 0.55) * Math.min(1, s * 1.5)
    }

    // ---- Pacing: anything quicker than breathing asks for the next frame right away.
    if (onScreen) {
      const settling = (s: Spring, to: number) => Math.abs(s.v) > 0.05 || Math.abs(s.x - to) > 0.004
      const fast =
        !!sim.jump ||
        sim.queue.length > 0 ||
        leaving ||
        sim.swapping ||
        sim.wiggle > 0 ||
        pet > 0.005 ||
        sim.blinkT >= 0 ||
        i.talk > 0.005 ||
        chatter > 0 ||
        i.bounce > 0 ||
        LIVELY.has(mood) ||
        t - sim.moodAt < MOOD_EASE_S ||
        Math.abs(i.look.x - lx) > 0.01 ||
        Math.abs(i.look.y - ly) > 0.01 ||
        settling(sim.sy, syTarget) ||
        settling(sim.scale, scaleTarget) ||
        Math.abs(sim.turn.v) > 0.05 ||
        Math.abs(sim.nod.v) > 0.05 ||
        Math.abs(sim.back.v) > 0.05 ||
        Math.abs(sim.back.x) > 0.004 ||
        Math.abs(sim.tilt.v) > 0.15
      // Tiny mascots (the header faces) blink and wiggle under a pixel per frame at 30 fps, so their
      // quick moves get 30 fps instead of every frame. Three of them blinking out of step would
      // otherwise keep the whole canvas at full rate most of the time.
      if (fast && S <= TINY_SIZE) {
        plan.calm = true
        plan.calmMs = Math.min(plan.calmMs, CALM_FRAME_MS_FINE)
      } else if (fast) plan.fast = true
      else {
        plan.calm = true
        plan.calmMs = Math.min(plan.calmMs, S <= TINY_SIZE ? TINY_CALM_FRAME_MS : CALM_FRAME_MS)
      }
    }

    // ---- Draw into this mascot's own patch of the canvas.
    if (!onScreen || !loaded.current && !leaving) return
    const u = UNITS_PER_SLOT / S
    const viewH = r.height * u
    const feetFromCenter = ((STAGE.top + FEET) * S - r.height / 2) * u
    const dist = viewH / 2 / Math.tan(THREE.MathUtils.degToRad(FOV / 2))
    const camera = (camRef.current ??= new THREE.PerspectiveCamera(FOV, 1, 0.1, 30))
    camera.aspect = r.width / r.height
    camera.fov = FOV
    camera.position.set(gx, feetFromCenter, dist)
    camera.lookAt(gx, feetFromCenter, 0)
    camera.updateProjectionMatrix()
    const bottom = canvas.height - r.bottom
    gl.setViewport(r.left, bottom, r.width, r.height)
    // The phone tab bar sits inside the page's stacking context, under this canvas, so stop
    // drawing at its top edge instead of painting over it.
    // Measured once per frame for every mascot on the canvas, not once per mascot.
    if (plan.bar === undefined) plan.bar = document.querySelector('.tabbar')?.getBoundingClientRect() ?? null
    const bar = plan.bar
    const clipBottom = bar && bar.height > 0 && bar.top < r.bottom ? Math.max(r.top, bar.top) : r.bottom
    if (clipBottom <= r.top) return
    if (!plan.cleared) {
      gl.setScissorTest(false)
      gl.clear(true, true, false)
      plan.cleared = true
    }
    plan.drew = true
    gl.setScissor(r.left, canvas.height - clipBottom, r.width, clipBottom - r.top)
    gl.setScissorTest(true)
    gl.render(state.scene, camera)
    gl.setScissorTest(false)
  }, 2)

  const Model = MODELS[shown]
  return (
    <group>
      <group ref={body} position={[gx, 0, 0]} scale={0}>
        <Suspense fallback={null}>
          <Model input={input as MutableRefObject<RigInput>} />
          <Ready key={shown} onReady={onReady} />
        </Suspense>
      </group>
      <mesh ref={shadow} position={[gx, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={-1}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={shadowMap} color="#5a1a33" transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
}

/** True when a stage box is visible and inside the viewport. */
function onScreen(stage: HTMLElement) {
  const r = stage.getBoundingClientRect()
  if (r.width <= 2 || r.bottom <= 0 || r.right <= 0 || r.top >= window.innerHeight || r.left >= window.innerWidth) return false
  const el = stage as HTMLElement & { checkVisibility?: (o: object) => boolean }
  return el.checkVisibility ? el.checkVisibility({ opacityProperty: true, visibilityProperty: true }) : true
}

/** Starts each frame's plan. The canvas is cleared lazily, by the first mascot that draws. */
function Clear() {
  useFrame(({ gl }) => {
    gl.autoClear = false
    plan.cleared = false
    plan.drew = false
    plan.bar = undefined
    plan.fast = false
    plan.calm = false
    plan.calmMs = TINY_CALM_FRAME_MS
  }, 1)
  return null
}

/**
 * Ends each frame: wipes a canvas that showed a mascot last frame but none now, hides the canvas
 * while it is empty (so the browser stops compositing a full-screen layer), and books the next
 * frame at the rate the mascots asked for.
 */
function Pace() {
  const invalidate = useThree((s) => s.invalidate)
  useFrame((state) => {
    const gl = state.gl
    if (!plan.drew && plan.drewLast && !plan.cleared) {
      gl.setScissorTest(false)
      gl.clear(true, true, false)
    }
    plan.drewLast = plan.drew
    const hide = !plan.drew
    if (hide !== plan.hidden) {
      plan.hidden = hide
      gl.domElement.style.visibility = hide ? 'hidden' : 'visible'
    }
    if (document.hidden) return
    if (plan.fast) state.invalidate()
    else if (plan.calm && !plan.timer) {
      plan.timer = window.setTimeout(() => {
        plan.timer = 0
        invalidate()
      }, plan.calmMs)
    }
  }, 3)

  // Wake-ups for a sleeping canvas: scrolling and resizing move the stage boxes, mascots come and
  // go, and a slow poll catches anything else (a stage shown by CSS, a hop queued off screen).
  useEffect(() => {
    const wake = () => invalidate()
    const poll = window.setInterval(() => {
      if (document.hidden || plan.fast || plan.calm) return
      for (const h of rigBus.all().values()) {
        if (h.commands.length || h.petKick || seenMood.get(h.id) !== h.mood || onScreen(h.stage)) {
          invalidate()
          return
        }
      }
    }, ASLEEP_POLL_MS)
    window.addEventListener('scroll', wake, { passive: true, capture: true })
    window.addEventListener('resize', wake)
    document.addEventListener('visibilitychange', wake)
    const off = rigBus.subscribe(wake)
    return () => {
      window.clearInterval(poll)
      window.clearTimeout(plan.timer)
      plan.timer = 0
      window.removeEventListener('scroll', wake, { capture: true })
      window.removeEventListener('resize', wake)
      document.removeEventListener('visibilitychange', wake)
      off()
    }
  }, [invalidate])
  return null
}

function useHandles(): MascotHandle[] {
  const [list, setList] = useState(() => [...rigBus.all().values()])
  useEffect(() => {
    const sync = () => setList([...rigBus.all().values()])
    sync()
    return rigBus.subscribe(sync)
  }, [])
  return list
}

/** Everything inside the canvas. Owns the shared shadow texture, so it goes when the canvas goes. */
function Scene({ list }: { list: MascotHandle[] }) {
  const [shadowMap] = useState(makeContactShadow)
  useEffect(() => () => shadowMap.dispose(), [shadowMap])
  return (
    <>
      <ToyLights />
      <Clear />
      {list.map((h) => (
        <Instance key={h.id} h={h} shadowMap={shadowMap} />
      ))}
      <Pace />
    </>
  )
}

/** If the canvas cannot start (no WebGL context, a lost driver), draw nothing: the posters stay up. */
class NoCanvas extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

/** Mounted once by the bus. Keeps a canvas only while mascots exist. */
export function MascotLayer() {
  const list = useHandles()
  useEffect(() => {
    // Handy in the console and in screenshot scripts.
    if (import.meta.env.DEV) (window as unknown as { __mascots?: unknown }).__mascots = rigBus
  }, [])
  const any = list.length > 0
  const [alive, setAlive] = useState(any)
  // A new mascot brings the canvas back right away (set during render, not in an effect).
  if (any && !alive) setAlive(true)
  useEffect(() => {
    if (any) return
    const id = window.setTimeout(() => setAlive(false), LINGER_MS)
    return () => window.clearTimeout(id)
  }, [any])
  if (!alive) return null
  return (
    <NoCanvas>
      <Canvas
        className="mascot-layer__canvas"
        frameloop="demand"
        dpr={[1, 2]}
        gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }}
        camera={{ fov: FOV, position: [0, 0.5, 6] }}
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
        events={undefined}
      >
        <Scene list={list} />
      </Canvas>
    </NoCanvas>
  )
}
