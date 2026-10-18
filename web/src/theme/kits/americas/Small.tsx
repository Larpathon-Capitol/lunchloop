// The small pieces of the Americas kit: the header band and the section corner.
import { useId } from 'react'
import type { ArtProps } from '../../types'
import { Banner } from './shapes'
import { sparklePath, usePageHidden } from './util'
import './americas.css'

/** One tiny papel picado flag for the header string: a notched hem and a punched diamond. */
function tinyFlag(x: number, fill: string) {
  return (
    <g key={x} transform={`translate(${x} 0)`}>
      <path d="M0 1.5H13V10.4L10.8 9L8.7 10.4L6.5 9L4.3 10.4L2.2 9L0 10.4Z" className={fill} />
      <path d="M6.5 3.6L8.4 5.5L6.5 7.4L4.6 5.5Z" className="amx-band-punch" />
    </g>
  )
}

const STRING_FILLS = ['amx-f-pink4', 'amx-f-cobalt', 'amx-f-leaf', 'amx-band-rosa', 'amx-f-paper'] as const

/**
 * Inside the sun-yellow game header: a string of tiny papel picado flags across the top edge,
 * a faint talavera tile wall fading in on the right, and a rosa rule along the bottom.
 */
export function HeaderBand() {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  return (
    <div className="amx amx-band" aria-hidden="true">
      <svg className="amx-band-tiles" width="100%" height="100%">
        <defs>
          <pattern id={`amx-t-${uid}`} width="30" height="30" patternUnits="userSpaceOnUse">
            <path d="M15 6C18 10 18 12 15 15C12 12 12 10 15 6ZM15 24C12 20 12 18 15 15C18 18 18 20 15 24ZM6 15C10 12 12 12 15 15C12 18 10 18 6 15ZM24 15C20 18 18 18 15 15C18 12 20 12 24 15Z" className="amx-f-cobalt" />
            <circle cx="15" cy="15" r="1.6" className="amx-band-rosa" />
            <path d="M0 0H5A5 5 0 0 1 0 5ZM30 0V5A5 5 0 0 1 25 0ZM0 30V25A5 5 0 0 1 5 30ZM30 30H25A5 5 0 0 1 30 25Z" className="amx-f-cobalt" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#amx-t-${uid})`} />
      </svg>
      <svg className="amx-band-string" width="100%" height="12">
        <defs>
          <pattern id={`amx-s-${uid}`} width="120" height="12" patternUnits="userSpaceOnUse">
            {STRING_FILLS.map((f, i) => tinyFlag(5.5 + i * 24, f))}
          </pattern>
        </defs>
        <rect width="100%" height="12" fill={`url(#amx-s-${uid})`} />
        <rect width="100%" height="1.5" y="0.75" className="amx-band-cord" />
      </svg>
      <div className="amx-band-rule" />
    </div>
  )
}

/** Three papel picado flags strung across a section corner, with a sparkle. About 132 by 112. */
export function Corner({ className, style }: ArtProps) {
  const hidden = usePageHidden()
  return (
    <svg
      className={`amx amx-corner${className ? ` ${className}` : ''}`}
      style={style}
      viewBox="0 0 132 112"
      data-paused={hidden || undefined}
      aria-hidden="true"
    >
      <Banner x0={4} y0={2} x1={134} y1={44} sag={10} count={3} scale={0.62} shift={1} />
      <g transform="translate(26 70)">
        <path d={sparklePath(9)} className="amx-f-yellow amx-twinkle" />
      </g>
      <g transform="translate(112 90)">
        <path d={sparklePath(6)} className="amx-f-pink4 amx-twinkle" style={{ animationDelay: '-1.3s' }} />
      </g>
    </svg>
  )
}
