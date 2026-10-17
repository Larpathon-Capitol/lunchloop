// The small pieces of the Americas kit: the header band and the section corner.
import type { ArtProps } from '../../types'
import { Banner } from './shapes'
import { sparklePath, usePageHidden } from './util'
import './americas.css'

/**
 * Inside the cobalt game header: a yellow pinstripe and a pink checker rail on the
 * bottom edge, and a short string of tiny flags tucked into the top right corner.
 */
export function HeaderBand() {
  const hidden = usePageHidden()
  return (
    <div className="amx amx-band" data-paused={hidden || undefined} aria-hidden="true">
      <svg className="amx-band-flags is-right" viewBox="0 0 120 30">
        <Banner x0={-4} y0={-2} x1={124} y1={2} sag={3} count={4} scale={0.36} shift={1} />
      </svg>
      <div className="amx-band-hem" />
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
