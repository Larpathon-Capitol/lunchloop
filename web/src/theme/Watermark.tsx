// A faint, world-specific wallpaper behind the game screens. Each tab gets its own composition
// (cutlery on Tray, ballots on Vote, stars on Call it, a passport page on Stamps) drawn in the
// active world's ornaments. It is portaled to <body> so it sits under the fixed 3D tray stage,
// never takes pointer events, and only repaints when the world or the tab changes.
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { useThemeId } from './store'
import { TILE, tileFor, type GameTab } from './watermark/tiles'
import './watermark/watermark.css'

function tabOf(pathname: string): GameTab {
  if (pathname.includes('/vote')) return 'vote'
  if (pathname.includes('/call-it') || pathname.includes('/called-it')) return 'call'
  if (pathname.includes('/stamps') || pathname.includes('/badges')) return 'stamps'
  return 'tray'
}

export function GameWatermark() {
  const world = useThemeId()
  const { pathname } = useLocation()
  const tab = tabOf(pathname)
  if (typeof document === 'undefined') return null
  return createPortal(
    <div className="gwm" data-tab={tab} aria-hidden="true">
      {/* Keyed so a new world or tab fades in once instead of swapping abruptly. */}
      <div key={`${world}:${tab}`} className="gwm__tile" style={{ backgroundImage: tileFor(world, tab), backgroundSize: `${TILE * 2}px ${TILE}px` }} />
    </div>,
    document.body,
  )
}
