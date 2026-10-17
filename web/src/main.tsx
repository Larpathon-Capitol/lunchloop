import { lazy, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './shared/base.css'
import './shared/ui/ui.css'
import { setStudentSchool } from './shared/api'
import { Shell } from './shared/ui/Shell'
import { Home } from './Home'

// Each view loads on its own, so the phone path never downloads the chart library.
const SchoolArea = lazy(() => import('./school/SchoolArea').then((m) => ({ default: m.SchoolArea })))
const StudentView = lazy(() => import('./student/StudentView').then((m) => ({ default: m.StudentView })))

// A student link like /student?school=demo picks the school before anything loads.
setStudentSchool(new URLSearchParams(location.search).get('school'))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<Home />} />
          <Route path="kitchen" element={<Navigate to="/school/kitchen" replace />} />
          <Route path="school/*" element={<SchoolArea />} />
          <Route path="student/*" element={<StudentView />} />
          <Route path="*" element={<Home />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
