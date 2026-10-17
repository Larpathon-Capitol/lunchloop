// The student game: HUD on top, four tabs (Tray, Vote, Call it, Stamps). Bottom tab bar on
// phones, a segmented control at the top on laptops. Keeps the 3D tray stage in step.
import { LayoutGroup, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useRef, useState, type ComponentType } from 'react'
import { NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { greetingLine, ume } from '../mascot'
import { api, type FreeItem } from '../shared/api'
import { copy } from '../shared/copy'
import { Ballot, Crystal, Seal, Tray, type IconProps } from '../shared/icons'
import { press } from '../shared/motion'
import { LIVE_SCHOOL, activeStudentSchool, useGameBase } from '../shared/studentSchool'
import { SimulatedTag } from '../shared/ui/SimulatedTag'
import { COMPONENTS, trayStore } from '../tray/store'
import { CallItScreen } from './CallItScreen'
import { FoodSheet } from './FoodSheet'
import { Hud } from './Hud'
import { fade, screenSpring, tabSpring } from './springs'
import { StampsScreen } from './StampsScreen'
import { useDemoDate } from '../shared/demo'
import { StudentProvider, useStudent } from './state'
import { FreeBanner } from './FreeBanner'
import { LunchCheckIn } from './LunchCheckIn'
import { TrayScreen } from './TrayScreen'
import { VoteScreen } from './VoteScreen'
import './student.css'

const t = copy.student.tabs
const GREETED_KEY = 'lunchloop.ume.greeted'

const TABS: { to: string; label: string; Icon: ComponentType<IconProps> }[] = [
  { to: '', label: t.tray, Icon: Tray },
  { to: '/vote', label: t.vote, Icon: Ballot },
  { to: '/call-it', label: t.callIt, Icon: Crystal },
  { to: '/stamps', label: t.stamps, Icon: Seal },
]

function tabIndex(pathname: string) {
  if (pathname.includes('/vote')) return 1
  if (pathname.includes('/call-it') || pathname.includes('/called-it')) return 2
  if (pathname.includes('/stamps') || pathname.includes('/badges')) return 3
  return 0
}

function Screens() {
  const location = useLocation()
  const reduce = useReducedMotion()
  const index = tabIndex(location.pathname)
  const prev = useRef(index)
  // The shell already fades the whole view in, so the first screen doesn't slide again.
  const [initial] = useState(index)
  const [moved, setMoved] = useState(false)
  const first = !moved && index === initial
  const direction = Math.sign(index - prev.current)
  useEffect(() => {
    if (index !== initial) setMoved(true)
    prev.current = index
  }, [index, initial])

  return (
    <motion.div
      key={index}
      className="game__screen"
      initial={first ? false : reduce ? { opacity: 0 } : { opacity: 0, x: direction * 48 }}
      animate={{ opacity: 1, x: 0 }}
      transition={reduce ? fade : screenSpring}
    >
      <Routes location={location}>
        <Route index element={<TrayScreen />} />
        <Route path="vote" element={<VoteScreen />} />
        <Route path="call-it" element={<CallItScreen />} />
        <Route path="called-it" element={<CallItScreen />} />
        <Route path="stamps" element={<StampsScreen />} />
        <Route path="badges" element={<StampsScreen />} />
        <Route path="*" element={<TrayScreen />} />
      </Routes>
    </motion.div>
  )
}

function Tabs({ variant }: { variant: 'bar' | 'segment' }) {
  const reduce = useReducedMotion()
  const { base, search } = useGameBase()
  return (
    <nav className={variant === 'bar' ? 'tabbar' : 'segment'} aria-label={t.label}>
      <LayoutGroup id={`game-tabs-${variant}`}>
        <ul className={`${variant === 'bar' ? 'tabbar' : 'segment'}__list`}>
          {TABS.map(({ to, label, Icon }) => (
            <li key={to}>
              <NavLink to={`${base}${to}${search}`} end={to === ''} className={`${variant === 'bar' ? 'tabbar' : 'segment'}__link`}>
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <motion.span layoutId={`tab-mark-${variant}`} className={`${variant === 'bar' ? 'tabbar' : 'segment'}__mark`} transition={reduce ? { duration: 0 } : tabSpring} />
                    )}
                    <motion.span className="tab__icon" whileTap={press}>
                      <Icon />
                    </motion.span>
                    <span className="tab__label">{label}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </LayoutGroup>
    </nav>
  )
}

/** Keeps the 3D stage in step with the tab, the menu, and the picks. */
function StageSync() {
  const { pathname } = useLocation()
  const { tray, draft } = useStudent()
  const onTray = tabIndex(pathname) === 0
  const data = tray.state === 'ready' ? tray.data : null
  const packed = !!data?.picks
  useEffect(() => {
    trayStore.set({
      phase: onTray ? (packed ? 'packed' : 'pick') : 'away',
      available: data ? data.groups.map((g) => g.component) : COMPONENTS,
      picks: data?.picks ?? draft,
    })
  }, [onTray, packed, data, draft])
  useEffect(() => () => trayStore.set({ phase: 'away', focus: null }), [])
  return null
}

/** The mascot says hello once per browser session. */
function useGreeting() {
  useEffect(() => {
    let seen = false
    try {
      seen = sessionStorage.getItem(GREETED_KEY) === '1'
      sessionStorage.setItem(GREETED_KEY, '1')
    } catch {
      // Storage blocked: greet every visit, which is harmless.
    }
    if (seen) return
    const id = window.setTimeout(() => ume.react('happy', greetingLine()), 700)
    return () => window.clearTimeout(id)
  }, [])
}

const FREE_POLL_MS = 20_000

/**
 * Today's lunch, above every tab: free leftovers staff just announced, and the after-lunch
 * check-in for students who packed a tray for today. Free food is rechecked every 20 seconds
 * while the page is visible, since staff free it near the end of service.
 */
function TodayStrip() {
  const { me, refreshMe } = useStudent()
  const [free, setFree] = useState<FreeItem[] | null>(null)
  useEffect(() => {
    let alive = true
    const check = () => {
      if (document.hidden) return
      api.free().then((r) => alive && setFree(r.free)).catch(() => {})
    }
    const id = window.setInterval(check, FREE_POLL_MS)
    document.addEventListener('visibilitychange', check)
    return () => {
      alive = false
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', check)
    }
  }, [])
  return (
    <>
      <FreeBanner free={free ?? me?.free_today ?? []} />
      <LunchCheckIn lunch={me?.today_lunch ?? null} onAnswered={() => void refreshMe()} />
    </>
  )
}

function Game() {
  const { me, calendar, tray, hudBump } = useStudent()
  useGreeting()
  const today = calendar?.today ?? (tray.state === 'ready' ? tray.data.open_date : null)
  const packed = tray.state === 'ready' && !!tray.data.picks
  const doneToday = !!(me?.packed_today || me?.voted_today || packed)
  return (
    <div className="game">
      <div className="game__top">
        <Hud today={today} streak={me?.streak ?? null} xp={me?.xp ?? null} doneToday={doneToday} bump={hudBump} />
        <Tabs variant="segment" />
        <span className="game__sim game__sim--top">
          <SimulatedTag live={activeStudentSchool() === LIVE_SCHOOL} />
        </span>
      </div>
      <TodayStrip />
      <Screens />
      <p className="game__sim game__sim--foot">
        <SimulatedTag live={activeStudentSchool() === LIVE_SCHOOL} />
      </p>
      <Tabs variant="bar" />
      <FoodSheet />
      <StageSync />
    </div>
  )
}

/**
 * One provider per school. Moving between ?school=demo and ?school=live remounts it, so no
 * player stats, tray, draft, catalog or vote from one school leak into the other.
 */
export function StudentView() {
  const school = activeStudentSchool()
  // A presenter stepping the simulated calendar starts the game fresh on the new day.
  const demoDay = useDemoDate()
  const day = school === 'live' ? '' : (demoDay ?? '')
  useEffect(() => {
    // The 3D tray is shared with the page shell: clear the old school's picks and menu too.
    trayStore.set({ picks: {}, available: COMPONENTS, focus: null })
  }, [school, day])
  return (
    <StudentProvider key={`${school}:${day}`}>
      <Game />
    </StudentProvider>
  )
}
