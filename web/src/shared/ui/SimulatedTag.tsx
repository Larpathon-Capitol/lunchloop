import { copy } from '../copy'

/**
 * The "Simulated data" label. Put it in the same spot on every screen that shows a number.
 * On the live demo pass `live`: the menu is simulated but the votes are real, and the label says so.
 */
export function SimulatedTag({ live = false }: { live?: boolean }) {
  return (
    <span className="sim-tag" title={live ? copy.app.simulatedLiveHelp : copy.app.simulatedHelp}>
      <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 7v4M8 4.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      {live ? copy.app.simulatedLive : copy.app.simulated}
    </span>
  )
}
