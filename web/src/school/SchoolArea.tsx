import { lazy, Suspense, useCallback, useState } from 'react'
import { NavLink, Route, Routes } from 'react-router-dom'
import { motion } from 'framer-motion'
import { copy } from '../shared/copy'
import { useReducedMotion } from '../shared/motion'
import { Loading } from '../shared/ui/Notice'
import { SignIn } from './SignIn'
import { Wants } from './Wants'
import { clearSession, loadSession, saveSession } from './session'
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

/** Everything under /school: the sign-in, or the signed-in panel with its two sections. */
export function SchoolArea() {
  const reduce = !!useReducedMotion()
  const [session, setSession] = useState<SchoolSession | null>(loadSession)
  const [expired, setExpired] = useState(false)

  const signedIn = useCallback((s: SchoolSession) => {
    saveSession(s)
    setExpired(false)
    setSession(s)
  }, [])
  const signOut = useCallback(() => {
    clearSession()
    setExpired(false)
    setSession(null)
  }, [])
  const ranOut = useCallback(() => {
    clearSession()
    setExpired(true)
    setSession(null)
  }, [])

  if (!session) return <SignIn onSignedIn={signedIn} expired={expired} />

  return (
    <div className="s-panel">
      <div className="s-bar">
        <p className="s-bar__school">{session.school.name}</p>
        <button type="button" className="btn btn--quiet s-bar__out" onClick={signOut}>
          {t.signOut}
        </button>
      </div>
      <nav className="s-tabs" aria-label={t.subNavLabel}>
        <SubLink to="/school" end label={t.navWants} reduce={reduce} />
        <SubLink to="/school/kitchen" label={t.navKitchen} reduce={reduce} />
      </nav>
      <Routes>
        <Route index element={<Wants session={session} onExpired={ranOut} />} />
        <Route
          path="kitchen"
          element={
            <Suspense fallback={<Loading />}>
              <KitchenView />
            </Suspense>
          }
        />
        <Route path="*" element={<Wants session={session} onExpired={ranOut} />} />
      </Routes>
    </div>
  )
}
