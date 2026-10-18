import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion, useMotionValue, useSpring, type MotionValue } from 'framer-motion'
import { Ume, type UmeMood } from './mascot'
import { FEET, rigBus, type MascotHandle } from './mascot/rig/bus'
import { api } from './shared/api'
import { deviceId } from './shared/device'
import { Tray as TrayIcon } from './shared/icons'
import { useReducedMotion } from './shared/motion'
import { sound } from './shared/sound'
import { applyStudentSchool, LIVE_SCHOOL, schoolForStudentUrl } from './shared/studentSchool'
import { noren } from './shared/ui/norenStore'
import { useKit } from './theme/registry'
import { heroCopy } from './tray/hero/copy'
import { Countdown } from './tray/hero/Countdown'
import { Headline } from './tray/hero/Headline'
import { HeroCta } from './tray/hero/HeroCta'
import { StickerField } from './tray/hero/StickerField'
import { stageBus, useTrayHovered } from './tray/stageBus'
import { trayEvents, trayProjector, trayStore, TraySlot } from './tray/store'
import './home.css'

/*
 * The home hero: one full screen, no scroll. The world's backdrop behind, the steel tray floating
 * in it with the mascot riding the rim, food stickers around it, and the words and the button.
 * Tapping the tray or the button sends the tray gliding into the game behind the world's curtain.
 * The bottom band of the screen is left free of words: the tray canvas draws foods along it.
 *
 * Two doors use it: / for the simulated school (into /student) and /join for the live school,
 * where every vote is real (into /live).
 */

const loadGame = () => import('./student/StudentView')

/**
 * Warms the game the moment the student shows intent (hover, focus, press): its code, and the
 * student's own record and tomorrow's tray, so the server has them hot when the game asks.
 * Runs once per school per page load.
 */
const warmed = new Set<string>()
function warmGame(school: string) {
  void loadGame()
  if (warmed.has(school)) return
  warmed.add(school)
  applyStudentSchool(school)
  const device = deviceId()
  void api.me(device).catch(() => undefined)
  void api.getTray(device).catch(() => undefined)
}

const leave = { duration: 0.24, ease: [0.4, 0, 1, 1] as const }
/** Text has left by now; the curtain takes over and the route changes underneath it. */
const HANDOFF_MS = 240
const drift = { stiffness: 120, damping: 20, mass: 1 }
const settle = { type: 'spring', stiffness: 260, damping: 30, mass: 1 } as const
/** The hanging clock drops in and swings once on its cords before it settles. */
const swing = { type: 'spring', stiffness: 170, damping: 11, mass: 1 } as const

const coarsePointer = () => window.matchMedia('(pointer: coarse)').matches

/**
 * Pointer offset from the viewport center, -0.5 to 0.5 on each axis, through Drift springs.
 * On touch screens there is no pointer to follow, so it wanders slowly on its own instead.
 * Still under reduced motion. The idle loop pauses while the tab is hidden.
 */
function useHeroPointer(reduce: boolean) {
  const rx = useMotionValue(0)
  const ry = useMotionValue(0)
  const px = useSpring(rx, drift)
  const py = useSpring(ry, drift)
  useEffect(() => {
    if (reduce) {
      rx.set(0)
      ry.set(0)
      return
    }
    if (coarsePointer()) {
      let raf = 0
      const t0 = performance.now()
      const tick = (now: number) => {
        raf = requestAnimationFrame(tick)
        if (document.hidden) return
        const t = (now - t0) / 1000
        rx.set(Math.sin(t * 0.21) * 0.22 + Math.sin(t * 0.07) * 0.08)
        ry.set(Math.sin(t * 0.17 + 1.3) * 0.14)
      }
      raf = requestAnimationFrame(tick)
      return () => cancelAnimationFrame(raf)
    }
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      rx.set(e.clientX / window.innerWidth - 0.5)
      ry.set(e.clientY / window.innerHeight - 0.5)
    }
    const onLeave = () => {
      rx.set(0)
      ry.set(0)
    }
    window.addEventListener('pointermove', onMove)
    document.documentElement.addEventListener('pointerleave', onLeave)
    return () => {
      window.removeEventListener('pointermove', onMove)
      document.documentElement.removeEventListener('pointerleave', onLeave)
    }
  }, [reduce, rx, ry])
  return { px, py }
}

/**
 * The world's backdrop and the far stickers, on <body> behind the tray stage (which sits one
 * layer up), so the tray floats in front of them.
 */
function Backdrop({ px, py, reduce, leaving }: { px: MotionValue<number>; py: MotionValue<number>; reduce: boolean; leaving: boolean }) {
  const kit = useKit()
  const Art = kit.HeroBackdrop
  return createPortal(
    <div className="home-field" aria-hidden="true">
      <Art px={px} py={py} />
      <StickerField px={px} py={py} reduce={reduce} leaving={leaving} layer="far" />
    </div>,
    document.body,
  )
}

/** Mascot size on the rim, from the tray's width on screen: a real character, not a charm. */
const rimSize = (trayWidth: number, wide: boolean) =>
  Math.round(wide ? Math.min(180, Math.max(150, trayWidth * 0.27)) : Math.min(110, Math.max(96, trayWidth * 0.3)))

/** Where on the rim the mascot stands: left of center on the front edge (see stageBus.rimPoint). */
const RIM_U = -0.62
const RIM_V = -1

/**
 * The mascot standing on the front rim of the tray, riding along as it bobs and tilts. It is
 * mounted from the first frame with a size guessed from the slot and fades with the tray itself,
 * so it is on the rim the moment the tray appears. It waves hello on load, hops when the tray is
 * hovered and follows the pointer with its eyes (the rig's default).
 */
function MascotOnTray({ show, reduce, wide }: { show: boolean; reduce: boolean; wide: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const rig = useRef<MascotHandle | null>(null)
  const [size, setSize] = useState(() => {
    const slot = trayStore.get().slot
    return rimSize(slot ? slot.width * 0.8 : window.innerWidth * (wide ? 0.4 : 0.8), wide)
  })
  const sizeRef = useRef(size)
  const wideRef = useRef(wide)
  useEffect(() => {
    wideRef.current = wide
  }, [wide])
  const hovered = useTrayHovered()
  const [hop, setHop] = useState(0)
  const [mood, setMood] = useState<UmeMood>('idle')

  // Hello: once the tray has landed, a happy hop and a wave (the wing or arm flaps on landing).
  useEffect(() => {
    if (reduce) return
    const a = window.setTimeout(() => {
      setMood('happy')
      setHop((h) => h + 1)
    }, 900)
    const b = window.setTimeout(() => {
      const h = rig.current
      if (h) {
        rigBus.send(h, { type: 'wiggle' })
        rigBus.send(h, { type: 'hop', height: 0.12 })
      }
    }, 1700)
    const c = window.setTimeout(() => setMood('idle'), 3200)
    return () => {
      window.clearTimeout(a)
      window.clearTimeout(b)
      window.clearTimeout(c)
    }
  }, [reduce])

  useEffect(() => {
    if (!hovered || reduce) return
    setHop((h) => h + 1)
    setMood('excited')
    const t = window.setTimeout(() => setMood('idle'), 1600)
    return () => window.clearTimeout(t)
  }, [hovered, reduce])

  useEffect(() => {
    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const el = ref.current
      if (!el) return
      const p = stageBus.rimPoint(RIM_U, RIM_V)
      const rect = trayProjector.tray()
      if (!p || !rect) {
        el.style.opacity = '0'
        return
      }
      const want = rimSize(rect.width, wideRef.current)
      if (Math.abs(want - sizeRef.current) > 4) {
        sizeRef.current = want
        setSize(want)
      }
      const s = sizeRef.current
      el.style.opacity = String(Math.min(1, stageBus.presence()))
      // Feet right on the rim line, so it stands on the steel.
      el.style.transform = `translate3d(${p.x - s / 2}px, ${p.y - s * FEET}px, 0)`
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div ref={ref} className={show ? 'home__mascot' : 'home__mascot is-gone'} style={{ width: size, opacity: 0 }}>
      <Ume mood={mood} size={size} hopKey={hop} bubbleAlign="start" rigRef={rig} />
    </div>
  )
}

const WIDE_QUERY = '(min-width: 900px)'

/** True on wide screens; follows resizes and rotation. */
function useWide() {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(WIDE_QUERY)
      mq.addEventListener('change', onChange)
      return () => mq.removeEventListener('change', onChange)
    },
    () => window.matchMedia(WIDE_QUERY).matches,
    () => false,
  )
}

/** Props for the hero. */
export interface HomeProps {
  /** The live school's door (/join): real votes, straight into /live, no demo links. */
  live?: boolean
}

export function Home({ live = false }: HomeProps) {
  const reduce = !!useReducedMotion()
  const navigate = useNavigate()
  const { search } = useLocation()
  const school = live ? LIVE_SCHOOL : schoolForStudentUrl(search)
  const hovered = useTrayHovered()
  const [leaving, setLeaving] = useState(false)
  const leavingRef = useRef(false)
  // The handoff's pending timer and frame, so leaving home mid-transition cancels them.
  const handoff = useRef<{ timer: number; frame: number }>({ timer: 0, frame: 0 })
  const { px, py } = useHeroPointer(reduce)
  const wide = useWide()
  const [paused, setPaused] = useState(false)

  // Every request from here on (the warm-up, then the game) goes to this door's school.
  useEffect(() => {
    applyStudentSchool(school)
  }, [school])

  useEffect(() => {
    trayStore.set({ phase: 'hero', focus: null })
    // Warm the game's code now, so the route can swap in under the curtain without a wait.
    void loadGame()
    const h = handoff.current
    return () => {
      window.clearTimeout(h.timer)
      cancelAnimationFrame(h.frame)
    }
  }, [])

  // CSS loops (stickers, the button's shine) stop while the tab is hidden.
  useEffect(() => {
    const onVis = () => setPaused(document.hidden)
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  const warm = useCallback(() => warmGame(school), [school])
  // Hovering or focusing the tray is intent too.
  useEffect(() => {
    if (hovered) warm()
  }, [hovered, warm])

  const go = useCallback(() => {
    if (leavingRef.current) return
    leavingRef.current = true
    warm()
    setLeaving(true)
    sound.tap()
    stageBus.setHovered(false)
    trayStore.set({ phase: 'entering' })
    const to = live ? { pathname: '/live', search: '' } : { pathname: '/student', search }
    if (reduce) {
      navigate(to)
      return
    }
    const h = handoff.current
    h.timer = window.setTimeout(() => {
      // Curtain first, in its own commit; the route changes underneath it on the next frame.
      noren.part()
      h.frame = requestAnimationFrame(() => navigate(to))
    }, HANDOFF_MS)
  }, [navigate, search, reduce, warm, live])

  useEffect(() => trayEvents.on((e) => e.type === 'enter' && go()), [go])

  const out = leaving ? { opacity: 0, y: 24 } : { opacity: 1, y: 0 }

  return (
    <div className={paused ? 'home is-paused' : 'home'}>
      <Backdrop px={px} py={py} reduce={reduce} leaving={leaving} />
      <TraySlot className="home__slot" />
      <StickerField px={px} py={py} reduce={reduce} leaving={leaving} layer="near" />
      <MascotOnTray show={!leaving} reduce={reduce} wide={wide} />

      {/* The lock-in clock hangs at the top center, where the eye lands first. */}
      <motion.div
        className="home__clock"
        initial={reduce ? false : { opacity: 0, y: -40, rotate: -5 }}
        animate={leaving ? { opacity: 0, y: -24 } : { opacity: 1, y: 0, rotate: 0 }}
        transition={leaving ? leave : { ...swing, delay: reduce ? 0 : 0.45 }}
      >
        <Countdown reduce={reduce} />
      </motion.div>

      <motion.div
        className={live ? 'home__copy home__copy--live' : 'home__copy'}
        initial={reduce ? false : { opacity: 0, y: 48 }}
        animate={out}
        transition={leaving ? leave : { ...settle, delay: 0.05 }}
      >
        <Headline reduce={reduce} delay={0.15} />
        <motion.p
          className="home__lead"
          initial={reduce ? false : { opacity: 0, x: -18 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ ...settle, delay: reduce ? 0 : 0.55 }}
        >
          {heroCopy.lead}
        </motion.p>
        <div className="home__actions">
          <HeroCta onClick={go} onIntent={warm} reduce={reduce} delay={0.7}>
            {heroCopy.cta}
          </HeroCta>
        </div>
        {!live && (
          <motion.p
            className="home__quiet"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: reduce ? 0 : 1.1 }}
          >
            <Link to="/hub" className="home__staff">
              {heroCopy.staff}
            </Link>
            <span className="home__sim">{heroCopy.simulated}</span>
          </motion.p>
        )}
      </motion.div>

      <p className={hovered && !leaving ? 'home__hint is-on' : 'home__hint'} aria-hidden="true">
        <TrayIcon width={20} height={20} />
        {heroCopy.hoverLabel}
      </p>
    </div>
  )
}
