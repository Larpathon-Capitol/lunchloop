import { copy } from '../copy'

/** The "Simulated data" label. Put it in the same spot on every screen that shows a number. */
export function SimulatedTag() {
  return (
    <span className="sim-tag" title={copy.app.simulatedHelp}>
      <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 7v4M8 4.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      {copy.app.simulated}
    </span>
  )
}
