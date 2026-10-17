import { Suspense, useEffect, useRef } from 'react'
import { NavLink, Link, Outlet, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { copy } from '../copy'
import { useReducedMotion } from '../motion'
import { setMuted, useMuted } from '../sound'
import { Logo } from './Logo'
import { Loading } from './Notice'

const underlineSpring = { type: 'spring', stiffness: 520, damping: 38 } as const

function NavItem({ to, label, reduce }: { to: string; label: string; reduce: boolean }) {
  return (
    <NavLink to={to} className="shell__link">
      {({ isActive }) => (
        <>
          {label}
          {isActive && (
            <motion.span
              layoutId="shell-underline"
              className="shell__underline"
              transition={reduce ? { duration: 0 } : underlineSpring}
            />
          )}
        </>
      )}
    </NavLink>
  )
}

export function Shell() {
  const muted = useMuted()
  const reduce = !!useReducedMotion()
  const { pathname } = useLocation()
  // One key per top-level view, so the Student view's own sub-routes never remount.
  const view = pathname.split('/')[1] || 'home'
  const mainRef = useRef<HTMLElement>(null)
  const firstRender = useRef(true)
  const skipEnter = firstRender.current
  firstRender.current = false

  useEffect(() => {
    document.title = view === 'school' ? copy.app.titleSchool : view === 'student' ? copy.app.titleStudent : copy.app.titleHome
  }, [view])

  return (
    <>
      <a
        className="skip-link"
        href="#main"
        onClick={(e) => {
          e.preventDefault()
          mainRef.current?.focus()
        }}
      >
        {copy.app.skipToMain}
      </a>
      <header className="shell__bar">
        <div className="shell__inner">
          <Link to="/" className="shell__brand">
            <Logo />
            <span className="shell__brand-name">{copy.app.name}</span>
          </Link>
          <nav className="shell__nav" aria-label={copy.app.navLabel}>
            <NavItem to="/student" label={copy.app.navStudent} reduce={reduce} />
            <NavItem to="/school" label={copy.app.navSchool} reduce={reduce} />
          </nav>
          <button
            className="shell__mute"
            onClick={() => setMuted(!muted)}
            aria-pressed={!muted}
            aria-label={copy.app.sound}
            title={muted ? copy.app.soundTurnOn : copy.app.soundTurnOff}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M11 5 6 9H3v6h3l5 4z" />
              {muted ? <path d="m16 9 5 6m0-6-5 6" /> : <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />}
            </svg>
          </button>
        </div>
      </header>
      {/* Opacity only: a transform here would trap position:fixed sheets inside the Student view. */}
      <motion.main
        key={view}
        id="main"
        ref={mainRef}
        tabIndex={-1}
        className="shell__main"
        initial={skipEnter || reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
      >
        <Suspense fallback={<Loading />}>
          <Outlet />
        </Suspense>
      </motion.main>
    </>
  )
}
