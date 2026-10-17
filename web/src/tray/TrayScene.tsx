import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import * as THREE from 'three'
import { compartmentCenter, COMPARTMENTS, TRAY } from './geometry'
import { FoodCluster } from './Food'
import { GROUPS, resolveColors, type GroupColors, type GroupId } from './groups'
import { approach } from './motion'
import { buildShadowTexture, buildStudioEnvironment } from './studio'
import { TrayModel } from './TrayModel'
import type { TrayMode, TraySceneProps } from './types'
import './tray.css'

const TRANSITION_MS = 1050
/** Max pointer tilt in hero mode: about 12 degrees. */
const MAX_TILT = THREE.MathUtils.degToRad(12)
/** Pointer tilt left in pick mode, so the tray still feels alive but stays easy to aim at. */
const PICK_TILT = THREE.MathUtils.degToRad(2.5)
const FOV = 30
/** Height of the floor the shadow sits on. */
const SHADOW_Y = -0.9

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}

/** True while the scene is on screen and the tab is visible, so the render loop can stop otherwise. */
function useOnScreen(ref: RefObject<HTMLElement | null>) {
  const [inView, setInView] = useState(true)
  const [pageVisible, setPageVisible] = useState(() => typeof document === 'undefined' || !document.hidden)
  useEffect(() => {
    const el = ref.current
    const onVis = () => setPageVisible(!document.hidden)
    document.addEventListener('visibilitychange', onVis)
    let io: IntersectionObserver | undefined
    if (el && 'IntersectionObserver' in window) {
      io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting))
      io.observe(el)
    }
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      io?.disconnect()
    }
  }, [ref])
  return inView && pageVisible
}

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
const lerp = THREE.MathUtils.lerp

/** Camera distance that fits a `w` by `h` box in view at the current aspect ratio. */
function fitDistance(aspect: number, w: number, h: number) {
  const v = THREE.MathUtils.degToRad(FOV) / 2
  const hz = Math.atan(Math.tan(v) * aspect)
  return Math.max(w / 2 / Math.tan(hz), h / 2 / Math.tan(v))
}

interface RigProps {
  mode: TrayMode
  colors: GroupColors
  filled: Partial<Record<GroupId, boolean>>
  reduced: boolean
  active: boolean
  onEnter?: () => void
  onSelectGroup?: (group: GroupId) => void
}

/** Owns every animated value: hero/pick progress, pointer tilt, idle float, hover lift, and the camera. */
function Rig({ mode, colors, filled, reduced, active, onEnter, onSelectGroup }: RigProps) {
  const { camera, gl, size, invalidate } = useThree()
  const tray = useRef<THREE.Group>(null)
  const shadow = useRef<THREE.Mesh>(null)
  const shadowTexture = useMemo(() => buildShadowTexture(), [])
  useEffect(() => () => shadowTexture.dispose(), [shadowTexture])
  const picking = mode === 'pick'
  const [trayHover, setTrayHover] = useState(false)
  const [hoveredGroup, setHoveredGroup] = useState<GroupId | null>(null)
  const coarse = useMemo(() => window.matchMedia('(pointer: coarse)').matches, [])

  const anim = useRef({
    p: picking ? 1 : 0,
    from: picking ? 1 : 0,
    to: picking ? 1 : 0,
    start: 0,
    duration: 0,
    lift: 0,
    pointer: new THREE.Vector2(),
    tilt: new THREE.Vector2(),
  })

  // Start a transition from wherever we are now, so reversing mid-way stays smooth.
  useEffect(() => {
    const a = anim.current
    const to = mode === 'pick' ? 1 : 0
    a.from = a.p
    a.to = to
    a.start = performance.now()
    a.duration = TRANSITION_MS * Math.abs(to - a.p)
    setHoveredGroup(null)
    setTrayHover(false)
    invalidate()
  }, [mode, invalidate])

  useEffect(() => invalidate(), [active, reduced, filled, colors, invalidate])

  // Track the mouse over the whole window (not just the canvas) so the hero reacts like a backdrop.
  // Touch is ignored for tilt: a tap would otherwise snap the tray toward the finger.
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      const r = gl.domElement.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) return
      const x = ((e.clientX - r.left) / r.width) * 2 - 1
      const y = -(((e.clientY - r.top) / r.height) * 2 - 1)
      anim.current.pointer.set(THREE.MathUtils.clamp(x, -1, 1), THREE.MathUtils.clamp(y, -1, 1))
      invalidate()
    }
    const onLeave = () => {
      anim.current.pointer.set(0, 0)
      invalidate()
    }
    window.addEventListener('pointermove', onMove)
    document.documentElement.addEventListener('pointerleave', onLeave)
    return () => {
      window.removeEventListener('pointermove', onMove)
      document.documentElement.removeEventListener('pointerleave', onLeave)
    }
  }, [gl, invalidate])

  const pointerCursor = (picking && hoveredGroup !== null) || (!picking && trayHover)
  useEffect(() => {
    gl.domElement.style.cursor = pointerCursor ? 'pointer' : ''
  }, [gl, pointerCursor])

  useFrame((state, dt) => {
    const a = anim.current
    const g = tray.current
    if (!g) return

    // Hero <-> pick progress.
    if (reduced || a.duration === 0) {
      a.p = a.to
    } else {
      const k = Math.min((performance.now() - a.start) / a.duration, 1)
      a.p = lerp(a.from, a.to, easeInOutCubic(k))
    }
    const p = a.p
    const transitioning = p !== a.to

    // Pointer tilt, damped. Reduced motion keeps the tray still.
    const tiltAmount = lerp(MAX_TILT, PICK_TILT, p)
    const tx = reduced ? 0 : a.pointer.x * tiltAmount
    const ty = reduced ? 0 : a.pointer.y * tiltAmount
    const prevX = a.tilt.x
    const prevY = a.tilt.y
    a.tilt.x = approach(a.tilt.x, tx, 4, dt, reduced)
    a.tilt.y = approach(a.tilt.y, ty, 4, dt, reduced)
    const tilting = Math.abs(a.tilt.x - prevX) + Math.abs(a.tilt.y - prevY) > 1e-5

    const liftTarget = !picking && trayHover ? 1 : 0
    const prevLift = a.lift
    a.lift = approach(a.lift, liftTarget, 8, dt, reduced)
    const lifting = Math.abs(a.lift - prevLift) > 1e-5

    // Idle float, hero only. On touch screens the sway is a bit larger since there is no pointer.
    const t = state.clock.elapsedTime
    const idle = reduced ? 0 : 1 - p
    const sway = coarse ? 1.6 : 1
    const bob = idle * Math.sin(t * 1.1) * 0.07
    const swayX = idle * Math.sin(t * 0.45) * 0.035 * sway
    const swayY = idle * Math.sin(t * 0.33 + 1.2) * 0.06 * sway

    // Hero pose: angled and tipped toward the viewer. Pick pose: flat and square.
    // On tall screens the pick view turns the tray a quarter turn so its long side runs up the
    // screen, which makes every compartment a bigger tap target.
    const aspect = size.width / Math.max(size.height, 1)
    const portrait = aspect < 0.8
    g.rotation.set(
      lerp(0.5, 0, p) - a.tilt.y + swayX,
      lerp(-0.42, portrait ? -Math.PI / 2 : 0, p) + a.tilt.x * 0.9 + swayY,
      lerp(0.07, 0, p) - a.tilt.x * 0.35,
    )
    g.position.set(0, bob + a.lift * 0.14 + lerp(0.1, 0, p), 0)
    g.scale.setScalar(1 + a.lift * 0.03)

    // Camera: low 3/4 angle in hero, high top-down-ish 3/4 in pick. Distance fits the tray to the view.
    const elevation = lerp(0.32, 0.98, p)
    const heroFrac = aspect >= 1 ? 0.56 : 0.86
    const heroDist = fitDistance(aspect, TRAY.width / heroFrac, TRAY.depth * 1.9)
    const across = portrait ? TRAY.depth : TRAY.width
    const along = portrait ? TRAY.width : TRAY.depth
    const pickDist = fitDistance(aspect, across * 1.12, (along * Math.sin(elevation) + 0.3) * 1.3)
    const dist = lerp(heroDist, pickDist, p)
    camera.position.set(0, Math.sin(elevation) * dist, Math.cos(elevation) * dist)
    camera.lookAt(0, lerp(0.05, -0.02, p), lerp(0, 0.06, p))

    // Fake contact shadow: follows the tray's turn, and softens as the tray rises.
    const sh = shadow.current
    if (sh) {
      const height = g.position.y - SHADOW_Y
      const spread = 1 + height * 0.18
      sh.rotation.set(-Math.PI / 2, 0, g.rotation.y)
      sh.scale.set(TRAY.width * 1.2 * spread, TRAY.depth * 1.35 * spread, 1)
      ;(sh.material as THREE.MeshBasicMaterial).opacity = 0.5 / (spread * spread)
    }

    const hero = !reduced && p < 1
    if (active && (hero || transitioning || tilting || lifting)) state.invalidate()
  })

  const hoverTray = useCallback(
    (inside: boolean) => (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation()
      setTrayHover(inside)
    },
    [],
  )
  const onHoverGroup = useCallback((id: GroupId, inside: boolean) => {
    setHoveredGroup((cur) => (inside ? id : cur === id ? null : cur))
  }, [])
  const select = useCallback((id: GroupId) => onSelectGroup?.(id), [onSelectGroup])

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
        lit={hoveredGroup ? [hoveredGroup] : []}
        reduced={reduced}
        onOver={(id, e) => {
          e.stopPropagation()
          onHoverGroup(id, true)
        }}
        onOut={(id) => onHoverGroup(id, false)}
        onSelect={(id, e) => {
          e.stopPropagation()
          select(id)
        }}
      />
      {COMPARTMENTS.map((c) => {
        const [x, y] = compartmentCenter(c)
        return (
          <FoodCluster
            key={c.id}
            group={c.id}
            color={colors[c.id]}
            filled={!!filled[c.id]}
            reduced={reduced}
            position={[x, TRAY.floor, -y]}
          />
        )
      })}
      {!picking && (
        // One cheap box for hero hover and tap, instead of raycasting the detailed tray.
        <mesh
          position={[0, 0.1, 0]}
          onPointerOver={hoverTray(true)}
          onPointerOut={hoverTray(false)}
          onClick={(e) => {
            e.stopPropagation()
            onEnter?.()
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

/** Sets scene.environment once from the procedural studio. */
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

/** Visually hidden buttons so keyboard and screen reader users can do everything the 3D scene does. */
function AccessibleControls({ mode, onEnter, onSelectGroup }: Pick<TraySceneProps, 'mode' | 'onEnter' | 'onSelectGroup'>) {
  if (mode === 'hero') {
    return onEnter ? (
      <div className="tray-a11y">
        <button type="button" onClick={onEnter}>
          Open the lunch tray
        </button>
      </div>
    ) : null
  }
  return onSelectGroup ? (
    <div className="tray-a11y" role="group" aria-label="Food groups">
      {GROUPS.map((g) => (
        <button key={g.id} type="button" onClick={() => onSelectGroup(g.id)}>
          {g.label}
        </button>
      ))}
    </div>
  ) : null
}

/**
 * Silver lunch tray scene. Default export so it can be code split:
 * `const TrayScene = lazy(() => import('./tray/TrayScene'))`.
 */
export default function TrayScene({
  mode,
  onEnter,
  onSelectGroup,
  filled,
  colors,
  reducedMotion,
  className,
  style,
}: TraySceneProps) {
  const prefersReduced = usePrefersReducedMotion()
  const reduced = reducedMotion ?? prefersReduced
  const wrap = useRef<HTMLDivElement>(null)
  const active = useOnScreen(wrap)
  const palette = useMemo(() => resolveColors(colors), [colors])
  const filledMap = useMemo(() => filled ?? {}, [filled])

  return (
    <div
      ref={wrap}
      className={['tray-scene', className].filter(Boolean).join(' ')}
      style={style}
    >
      <div
        className="tray-canvas"
        role="img"
        aria-label={mode === 'hero' ? 'A silver school lunch tray' : 'Lunch tray with five food group compartments'}
      >
      <Canvas
        frameloop="demand"
        dpr={[1, 2]}
        camera={{ fov: FOV, near: 0.1, far: 60, position: [0, 2, 9] }}
        gl={{ antialias: true, alpha: true, toneMapping: THREE.NeutralToneMapping, powerPreference: 'high-performance' }}
      >
        <Studio />
        <directionalLight position={[2, 5, 3]} intensity={1.2} />
        <ambientLight intensity={0.25} />
        <Rig
          mode={mode}
          colors={palette}
          filled={filledMap}
          reduced={reduced}
          active={active}
          onEnter={onEnter}
          onSelectGroup={onSelectGroup}
        />
      </Canvas>
      </div>
      <AccessibleControls mode={mode} onEnter={onEnter} onSelectGroup={onSelectGroup} />
    </div>
  )
}
