import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../shared/base.css'
import './lab.css'
import { LabPage } from './LabPage'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LabPage />
  </StrictMode>,
)
