// GitHub Pages only knows files. Copy index.html to each app route so links like
// /live open with a normal 200 instead of going through the 404 fallback.
import { copyFileSync, mkdirSync } from 'node:fs'

const routes = [
  'hub', 'student', 'student/called-it', 'student/badges',
  'school', 'school/kitchen', 'kitchen',
  'live', 'live/called-it', 'live/badges', 'live/admin',
  'behind-the-scenes',
]

for (const route of routes) {
  mkdirSync(`dist/${route}`, { recursive: true })
  copyFileSync('dist/index.html', `dist/${route}/index.html`)
}
copyFileSync('dist/index.html', 'dist/404.html')
