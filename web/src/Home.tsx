import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { driftPetals } from './celebrate'
import { Ume } from './mascot'
import { api } from './shared/api'
import { copy } from './shared/copy'
import { deviceId } from './shared/device'
import { Tray as TrayIcon } from './shared/icons'
import { useReducedMotion } from './shared/motion'
import { sound } from './shared/sound'
import { applyStudentSchool, schoolForStudentUrl } from './shared/studentSchool'
import { Cloth } from './shared/ui/Noren'
import { noren, useNoren } from './shared/ui/norenStore'
import { stageBus, useTrayHovered } from './tray/stageBus'
import { trayEvents, trayProjector, trayStore, TraySlot } from './tray/store'
import './home.css'

const loadGame = () => import('./student/StudentView')

/**
 * Warms the game the moment the student shows intent (hover, focus, press): its code, and the
 * student's own record and tomorrow's tray, so the server has them hot when the game asks.
 * Runs once per page load.
 */
let warmed = false
function warmGame(search: string) {
  void loadGame()
  if (warmed) return
  warmed = true
  applyStudentSchool(schoolForStudentUrl(search))
  const device = deviceId()
  void api.me(device).catch(() => undefined)
  void api.getTray(device).catch(() => undefined)
}

/** Headline lines rise out of their own masks, one after another. */
const lineIn = (i: number) => ({ duration: 1, ease: [0.2, 0.72, 0.16, 1] as const, delay: 0.2 + 0.09 * i })
const leave = { duration: 0.24, ease: [0.4, 0, 1, 1] as const }
/** Text has left by now; the curtain takes over and the route changes underneath it. */
const HANDOFF_MS = 240

function Headline({ lines, reduce }: { lines: readonly string[]; reduce: boolean }) {
  return (
    <h1 className="home__title">
      {lines.map((line, i) => (
        <span className="home__line" key={line}>
          <motion.span
            className="home__line-inner"
            initial={reduce ? false : { y: '110%' }}
            animate={{ y: '0%' }}
            transition={lineIn(i)}
          >
            {line}
          </motion.span>
        </span>
      ))}
    </h1>
  )
}

/** The indigo field behind the canvas. Lives on <body> so the tray (one layer up) floats over it. */
function Field() {
  const ref = useRef<HTMLDivElement>(null)
  // Once the curtain is up it carries the cloth; this copy steps aside so the page shows through the split.
  const parting = useNoren() !== 0
  useEffect(() => {
    const el = ref.current
    if (!el) return
    return driftPetals(el, { count: 7, opacity: 0.55 })
  }, [])
  return createPortal(
    <div className="home-field" ref={ref} aria-hidden="true" hidden={parting}>
      <Cloth />
    </div>,
    document.body,
  )
}

/** Ume sitting on the front rim of the tray, riding along as it bobs and tilts. */
function UmeOnTray({ show }: { show: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState(0)
  useEffect(() => {
    let raf = 0
    let last = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const el = ref.current
      const rect = trayProjector.tray()
      const p = stageBus.rimPoint(-0.74, -1)
      if (!el || !rect || !p) return
      const want = Math.round(Math.min(132, Math.max(60, rect.width * 0.16)))
      if (Math.abs(want - last) > 3) {
        last = want
        setSize(want)
      }
      el.style.transform = `translate3d(${p.x - last / 2}px, ${p.y - last * 0.86}px, 0)`
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])
  return (
    <div ref={ref} className={show && size ? 'home__ume is-on' : 'home__ume'} style={{ width: size || undefined }}>
      {size > 0 && <Ume mood="happy" size={size} bubbleAlign="start" />}
    </div>
  )
}

export function Home() {
  const reduce = !!useReducedMotion()
  const navigate = useNavigate()
  const { search } = useLocation()
  const hovered = useTrayHovered()
  const [leaving, setLeaving] = useState(false)
  const leavingRef = useRef(false)
  // The handoff's pending timer and frame, so leaving home mid-transition cancels them.
  const handoff = useRef<{ timer: number; frame: number }>({ timer: 0, frame: 0 })

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

  const warm = useCallback(() => warmGame(search), [search])
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
    const to = { pathname: '/student', search }
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
  }, [navigate, search, reduce, warm])

  useEffect(() => trayEvents.on((e) => e.type === 'enter' && go()), [go])

  return (
    <div className="home">
      <Field />
      <TraySlot className="home__slot" />
      <UmeOnTray show={!leaving} />
      <motion.div
        className="home__copy"
        animate={leaving ? { opacity: 0, y: 28 } : { opacity: 1, y: 0 }}
        transition={leaving ? leave : { duration: 0 }}
      >
        <Headline lines={copy.home.titleLines} reduce={reduce} />
        <motion.div
          className="home__rest"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.75 }}
        >
          <p className="home__lead">{copy.home.lead}</p>
          <div className="home__actions">
            <button
              type="button"
              className="btn btn--primary home__cta"
              onClick={go}
              onPointerEnter={warm}
              onPointerDown={warm}
              onFocus={warm}
            >
              {copy.home.studentCta}
            </button>
            <Link to="/school" className="home__staff">
              {copy.home.schoolCta}
            </Link>
          </div>
          <p className="home__sim">{copy.home.simulated}</p>
        </motion.div>
      </motion.div>
      <p className={hovered && !leaving ? 'home__hint is-on' : 'home__hint'} aria-hidden="true">
        <TrayIcon width={20} height={20} />
        {copy.home.hoverLabel}
      </p>
    </div>
  )
}
