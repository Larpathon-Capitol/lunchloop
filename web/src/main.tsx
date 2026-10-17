import { lazy, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './shared/base.css'
import './shared/ui/ui.css'
import { Shell } from './shared/ui/Shell'
import { Home } from './Home'

// Each view loads on its own, so the phone path never downloads the chart library.
const KitchenView = lazy(() => import('./kitchen/KitchenView').then((m) => ({ default: m.KitchenView })))
const StudentView = lazy(() => import('./student/StudentView').then((m) => ({ default: m.StudentView })))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<Home />} />
          <Route path="kitchen" element={<KitchenView />} />
          <Route path="student/*" element={<StudentView />} />
          <Route path="*" element={<Home />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
