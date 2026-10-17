// Header bar decoration for the courtyard world: a faint star lattice fading in on the right,
// a gold dot rule along the top and a truck-art scalloped hem along the bottom edge.
import { useId } from 'react'
import { starPath } from './geometry'
import './medi.css'

export function HeaderBand() {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  return (
    <div className="mk mk-band" aria-hidden="true">
      <svg className="mk-band-lattice" width="100%" height="100%">
        <defs>
          <pattern id={`hb-l-${uid}`} width="36" height="36" patternUnits="userSpaceOnUse">
            <path d={starPath(18, 18, 11)} className="f-none s-p2" strokeWidth="1.2" />
            <path d="M0 -4L4 0L0 4L-4 0ZM36 -4L40 0L36 4L32 0ZM0 32L4 36L0 40L-4 36ZM36 32L40 36L36 40L32 36Z" className="f-p3" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#hb-l-${uid})`} />
      </svg>
      <div className="mk-band-top" />
      <svg className="mk-band-hem" preserveAspectRatio="none">
        <defs>
          <pattern id={`hb-s-${uid}`} width="16" height="12" patternUnits="userSpaceOnUse" y="0">
            <path d="M0 12A8 7.5 0 0 1 16 12Z" className="f-p4" />
            <circle cx="8" cy="9" r="1.7" className="f-au" />
          </pattern>
        </defs>
        <rect y="0" width="100%" height="12" fill={`url(#hb-s-${uid})`} />
        <rect y="10" width="100%" height="2" className="f-tq" />
      </svg>
    </div>
  )
}
