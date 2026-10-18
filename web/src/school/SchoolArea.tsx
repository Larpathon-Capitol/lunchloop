import { lazy, Suspense, useCallback, useState } from 'react'
import { NavLink, Route, Routes } from 'react-router-dom'
import { motion } from 'framer-motion'
import { copy } from '../shared/copy'
import { useReducedMotion } from '../shared/motion'
import { Loading } from '../shared/ui/Notice'
import { SignIn } from './SignIn'
import { Wants } from './Wants'
import { ServiceTab } from './parts/ServiceTab'
import { DEMO_SCHOOL, LIVE_SCHOOL } from '../shared/studentSchool'
import { useDemoDate } from '../shared/demo'
import { DemoBar } from '../shared/ui/DemoBar'
import { LiveDayBar } from '../shared/ui/LiveDayBar'
import { clearSession, loadAnySession, loadSession, saveSession } from './session'
import type { SchoolSession } from './session'
import './school.css'

const t = copy.school
const KitchenView = lazy(() => import('../kitchen/KitchenView').then((m) => ({ default: m.KitchenView })))

const underlineSpring = { type: 'spring', stiffness: 520, damping: 38 } as const

function SubLink({ to, label, end, reduce }: { to: string; label: string; end?: boolean; reduce: boolean }) {
  return (
    <NavLink to={to} end={end} className="s-tabs__link">
      {({ isActive }) => (
        <>
          {label}
          {isActive && (
            <motion.span
              layoutId="school-underline"
              className="s-tabs__underline"
              transition={reduce ? { duration: 0 } : underlineSpring}
            />
          )}
        </>
      )}
    </NavLink>
  )
}

/**
 * Everything under /school: the sign-in, or the signed-in panel with its sections
 * (What students want, Lunch service, Kitchen) behind a sub-nav that sticks to the top.
 * With lockedSchool (the live demo at /live/admin) there is no picker, no demo shortcut and
 * no Kitchen section.
 */
export function SchoolArea({ lockedSchool, base = '/school' }: { lockedSchool?: string; base?: string }) {
  const reduce = !!useReducedMotion()
  const [session, setSession] = useState<SchoolSession | null>(() =>
    lockedSchool ? loadSession(lockedSchool) : loadAnySession([LIVE_SCHOOL]),
  )
  const [expired, setExpired] = useState(false)
  const demoDate = useDemoDate()
  // The live day, once staff move it from the bar. Changing it reloads the sections below.
  const [liveDay, setLiveDay] = useState<string | null>(null)

  const signedIn = useCallback((s: SchoolSession) => {
    saveSession(s)
    setExpired(false)
    setSession(s)
  }, [])
  const signOut = useCallback(() => {
    if (session) clearSession(session.school.school_id)
    setExpired(false)
    setSession(null)
  }, [session])
  const ranOut = useCallback(() => {
    if (session) clearSession(session.school.school_id)
    setExpired(true)
    setSession(null)
  }, [session])

  if (!session) return <SignIn onSignedIn={signedIn} expired={expired} lockedSchool={lockedSchool} />

  // Presenter controls only for the simulated demo school, never on the live panel.
  const demo = !lockedSchool && session.school.school_id === DEMO_SCHOOL
  // The live panel gets the real day control instead: it moves the day for everyone.
  const live = lockedSchool === LIVE_SCHOOL && session.school.school_id === LIVE_SCHOOL

  return (
    <div className="s-panel">
      <div className="s-bar">
        <div>
          <p className="s-bar__school">{session.school.name}</p>
          {lockedSchool && <p className="s-bar__note">{t.live.note}</p>}
        </div>
        <button type="button" className="btn btn--quiet s-bar__out" onClick={signOut}>
          {t.signOut}
        </button>
      </div>
      <nav className="s-tabs" aria-label={t.subNavLabel}>
        <div className="s-tabs__row">
          <SubLink to={base} end label={t.navWants} reduce={reduce} />
          <SubLink to={`${base}/service`} label={t.navService} reduce={reduce} />
          {!lockedSchool && <SubLink to={`${base}/kitchen`} label={t.navKitchen} reduce={reduce} />}
        </div>
      </nav>
      {demo && <DemoBar school={DEMO_SCHOOL} className="s-demobar" />}
      {live && <LiveDayBar token={session.token} onExpired={ranOut} onDay={setLiveDay} className="s-demobar" />}
      {/* A new simulated or live day remounts the section, so it loads that day's numbers. */}
      <Routes key={demo ? (demoDate ?? 'today') : live ? (liveDay ?? 'today') : 'fixed'}>
        <Route index element={<Wants session={session} onExpired={ranOut} />} />
        <Route path="service" element={<ServiceTab session={session} onExpired={ranOut} />} />
        {!lockedSchool && (
          <Route
            path="kitchen"
            element={
              <Suspense fallback={<Loading />}>
                <KitchenView />
              </Suspense>
            }
          />
        )}
        <Route path="*" element={<Wants session={session} onExpired={ranOut} />} />
      </Routes>
    </div>
  )
}
