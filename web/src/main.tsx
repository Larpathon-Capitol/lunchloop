import { lazy, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import './shared/base.css'
import './shared/ui/ui.css'
import { applyStudentSchool, LIVE_SCHOOL, schoolForStudentUrl } from './shared/studentSchool'
import { Shell } from './shared/ui/Shell'
import { Home } from './Home'

// Each view loads on its own, so the phone path never downloads the chart library.
const SchoolArea = lazy(() => import('./school/SchoolArea').then((m) => ({ default: m.SchoolArea })))
const StudentView = lazy(() => import('./student/StudentView').then((m) => ({ default: m.StudentView })))

const Hub = lazy(() => import('./hub/Hub').then((m) => ({ default: m.Hub })))
const Backstage = lazy(() => import('./backstage/Backstage').then((m) => ({ default: m.Backstage })))
const BackstageSimulated = lazy(() => import('./backstage/Backstage').then((m) => ({ default: m.BackstageSimulated })))
const BackstageLive = lazy(() => import('./backstage/Backstage').then((m) => ({ default: m.BackstageLive })))

/**
 * The student game. /student plays in the simulated school (or the one in ?school=), /live plays in
 * the real live demo school. The school is set while this renders, before StudentView's effects
 * make their first request. One component serves both paths so moving between them never remounts.
 */
function GameRoute() {
  const { pathname, search } = useLocation()
  const live = pathname.split('/')[1] === 'live'
  applyStudentSchool(live ? LIVE_SCHOOL : schoolForStudentUrl(search))
  return <StudentView />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<Home />} />
          {/* The live school's front door: the same hero, into /live. Share this one, not /live. */}
          <Route path="join" element={<Home live />} />
          <Route path="kitchen" element={<Navigate to="/school/kitchen" replace />} />
          <Route path="hub" element={<Hub />} />
          <Route path="school/*" element={<SchoolArea />} />
          <Route path="student/*" element={<GameRoute />} />
          <Route path="live/admin/*" element={<SchoolArea lockedSchool={LIVE_SCHOOL} base="/live/admin" />} />
          <Route path="live/*" element={<GameRoute />} />
          <Route path="behind-the-scenes" element={<Backstage />} />
          <Route path="behind-the-scenes/simulated" element={<BackstageSimulated />} />
          <Route path="behind-the-scenes/live" element={<BackstageLive />} />
          <Route path="behind-the-scenes/*" element={<Navigate to="/behind-the-scenes" replace />} />
          <Route path="*" element={<Home />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
