import { lazy, Suspense, useEffect, useRef } from 'react'
import { NavLink, Link, Outlet, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { UmeDock } from '../../mascot'
import { copy } from '../copy'
import { useReducedMotion } from '../motion'
import { useKit } from '../../theme/registry'
import { ThemeSwitcher } from '../../theme/ThemeSwitcher'
import { Logo } from './Logo'
import { NorenCurtain } from './Noren'
import { useNoren } from './norenStore'
import { Loading } from './Notice'

// three.js and the tray only download on the screens that show the tray.
const TrayStage = lazy(() => import('../../tray/TrayStage'))

const underlineSpring = { type: 'spring', stiffness: 520, damping: 38 } as const

/** Top-level views that are staff pages: they keep the nav and never show the tray. */
const STAFF_VIEWS = new Set(['school', 'kitchen', 'hub', 'behind-the-scenes'])

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

/** The game header's decoration: the current world's band (garland, noren hem, tile border). */
function HeaderBand() {
  const { HeaderBand: Band } = useKit()
  return (
    <span className="shell__band" aria-hidden="true">
      <Band />
    </span>
  )
}

export function Shell() {
  const reduce = !!useReducedMotion()
  const parting = useNoren() !== 0
  const { pathname } = useLocation()
  const [, seg1 = '', seg2 = ''] = pathname.split('/')
  // One key per top-level view, so the Student view's own sub-routes never remount.
  const view = seg1 || 'home'
  const liveAdmin = view === 'live' && seg2 === 'admin'
  // The student game, in the simulated school or the live one.
  const inGame = (view === 'student' || view === 'live') && !liveAdmin
  // Peers on /live (and anywhere they tap from there) get a header with nowhere to wander to.
  const liveGame = inGame && view === 'live'
  // Staff pages keep the nav. Everything else that isn't the game shows the home hero (index and unknown paths).
  const staff = liveAdmin || STAFF_VIEWS.has(view)
  // Behind the scenes opens on the feed that matches where you are: live from the live panel,
  // simulated from the simulated school's panel, the chooser from everywhere else.
  const backstageTo = liveAdmin
    ? '/behind-the-scenes/live'
    : view === 'school' || view === 'kitchen'
      ? '/behind-the-scenes/simulated'
      : '/behind-the-scenes'
  const home = !inGame && !staff
  // /student and /live get separate keys, so switching between them starts the game fresh in the other school.
  const viewKey = liveAdmin ? 'live-admin' : liveGame ? 'game-live' : inGame ? 'game' : view
  const mode = home ? 'home' : inGame ? 'game' : 'staff'
  const mainRef = useRef<HTMLElement>(null)
  // Only staff pages fade in. Home and the game hand over through the tray and the noren instead.
  const fadeIn = !reduce && mode === 'staff'

  // tokens.css scopes staff styles (calm headings, no world display face) on this.
  useEffect(() => {
    document.documentElement.dataset.mode = mode
  }, [mode])

  useEffect(() => {
    const titles: Record<string, string> = {
      school: copy.app.titleSchool,
      game: copy.app.titleStudent,
      'game-live': copy.app.titleLive,
      'live-admin': copy.app.titleLiveAdmin,
      hub: copy.app.titleHub,
      'behind-the-scenes': copy.app.titleBackstage,
    }
    document.title = titles[viewKey] ?? copy.app.titleHome
  }, [viewKey, liveGame])

  const logo = <Logo size={home ? 'hero' : 'bar'} />
  const brand = liveGame ? (
    <span className="shell__brand shell__brand--static">{logo}</span>
  ) : (
    <Link to="/" className="shell__brand">
      {logo}
    </Link>
  )

  return (
    <div className={`shell shell--${mode}`}>
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
      <header className={`shell__bar shell__bar--${mode}`}>
        {inGame && <HeaderBand />}
        <div className="shell__inner">
          {brand}
          {liveGame && <p className="shell__live">{copy.app.liveLabel}</p>}
          {staff && (
            <nav className="shell__nav" aria-label={copy.app.navLabel}>
              <NavItem to="/hub" label={copy.hub.nav} reduce={reduce} />
              <NavItem to={liveAdmin ? '/live/admin' : '/school'} label={copy.app.navSchool} reduce={reduce} />
              <NavItem to={backstageTo} label={copy.app.navBackstage} reduce={reduce} />
            </nav>
          )}
          {inGame && <ThemeSwitcher compact collapse className="shell__switch" />}
        </div>
      </header>
      {(home || inGame) && (
        <Suspense fallback={null}>
          <TrayStage />
        </Suspense>
      )}
      {/* Opacity only: a transform here would trap position:fixed sheets inside the Student view. */}
      <motion.main
        key={viewKey}
        id="main"
        ref={mainRef}
        tabIndex={-1}
        className={`shell__main shell__main--${mode}`}
        initial={fadeIn ? { opacity: 0 } : false}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
      >
        {/* Home and the game load under the noren curtain: nothing visible to collide with the tray. */}
        <Suspense
          fallback={
            mode === 'staff' ? (
              <Loading />
            ) : (
              <p className="visually-hidden" role="status" aria-live="polite">
                {copy.loading}
              </p>
            )
          }
        >
          <Outlet />
        </Suspense>
      </motion.main>
      {/* Ume waits for the curtain to finish before stepping in. */}
      {inGame && <UmeDock hidden={parting} />}
      <NorenCurtain />
    </div>
  )
}
