import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// VITE_BASE is "/lunchloop/" when building for GitHub Pages, "/" otherwise.
// In dev and preview, /api is forwarded to the FastAPI server (uvicorn api.main:app).
const apiTarget = process.env.LUNCHLOOP_API ?? 'http://127.0.0.1:8000'

export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  server: { proxy: { '/api': apiTarget } },
  preview: { proxy: { '/api': apiTarget } },
})
