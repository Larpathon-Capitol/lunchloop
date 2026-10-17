// Student view: a daily loop of spin, vote and guess, with three tabs at the bottom.
import { LayoutGroup, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { copy } from '../shared/copy'
import { press } from '../shared/motion'
import { BadgesScreen } from './BadgesScreen'
import { CalledItScreen } from './CalledItScreen'
import { FoodSheet } from './FoodSheet'
import { screenSpring, instant } from './springs'
import { StudentProvider } from './state'
import { useGameBase } from '../shared/studentSchool'
import { TodayScreen } from './TodayScreen'
import './student.css'

const t = copy.student.tabs

const TABS = [
  {
    to: '',
    label: t.today,
    icon: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <circle cx="12" cy="12" r="4.5" />
      </>
    ),
  },
  {
    to: '/called-it',
    label: t.calledIt,
    icon: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 3.5v4M12 16.5v4M3.5 12h4M16.5 12h4" />
        <circle cx="12" cy="12" r="1.5" />
      </>
    ),
  },
  {
    to: '/badges',
    label: t.badges,
    icon: (
      <>
        <circle cx="12" cy="9.5" r="5.5" />
        <path d="m8.5 13.8-1.5 6.7 5-2.5 5 2.5-1.5-6.7" />
      </>
    ),
  },
]

function tabIndex(pathname: string) {
  if (pathname.includes('/called-it')) return 1
  if (pathname.includes('/badges')) return 2
  return 0
}

function Screens() {
  const location = useLocation()
  const reduce = useReducedMotion()
  const index = tabIndex(location.pathname)
  const prev = useRef(index)
  // The shell already fades the whole view in, so the first screen doesn't fade again.
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
      className="student__screen"
      initial={reduce || first ? false : { opacity: 0, x: direction * 24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={reduce ? instant : screenSpring}
    >
      <Routes location={location}>
        <Route index element={<TodayScreen />} />
        <Route path="called-it" element={<CalledItScreen />} />
        <Route path="badges" element={<BadgesScreen />} />
        <Route path="*" element={<TodayScreen />} />
      </Routes>
    </motion.div>
  )
}

function TabBar() {
  const reduce = useReducedMotion()
  const { base, search } = useGameBase()
  return (
    <nav className="tabbar" aria-label={t.label}>
      <LayoutGroup id="student-tabs">
        <ul className="tabbar__list">
          {TABS.map((tab) => (
            <li key={tab.to}>
              <NavLink to={`${base}${tab.to}${search}`} end className="tabbar__link">
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <motion.span
                        layoutId="tab-mark"
                        className="tabbar__mark"
                        transition={reduce ? instant : screenSpring}
                      />
                    )}
                    <motion.svg
                      viewBox="0 0 24 24"
                      className="tabbar__icon"
                      aria-hidden="true"
                      whileTap={press}
                    >
                      {tab.icon}
                    </motion.svg>
                    <span>{tab.label}</span>
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

export function StudentView() {
  return (
    <StudentProvider>
      <div className="student-view">
        <div className="student">
          <Screens />
        </div>
        <TabBar />
        <FoodSheet />
      </div>
    </StudentProvider>
  )
}
