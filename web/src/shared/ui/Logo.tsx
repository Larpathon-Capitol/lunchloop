/**
 * The LunchLoop mark: the five-compartment tray seen from above, each well in its food group's
 * glaze. Same layout as the 3D tray. The outline takes the text color, so it works on indigo and
 * on paper. public/favicon.svg still carries the older mark and should be redrawn to match.
 */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={(size * 20) / 28} viewBox="0 0 28 20" aria-hidden="true" focusable="false" className="logo-mark">
      <rect x="1" y="1" width="26" height="18" rx="4.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <rect x="4.4" y="4" width="6.2" height="5.4" rx="1.6" fill="var(--g-fruit)" />
      <rect x="11.6" y="4" width="6.2" height="5.4" rx="1.6" fill="var(--g-vegetable)" />
      <circle cx="21" cy="6.7" r="2.6" fill="var(--g-milk)" />
      <rect x="4.4" y="10.6" width="6.6" height="5.4" rx="1.6" fill="var(--g-grain)" />
      <rect x="12" y="10.6" width="11.6" height="5.4" rx="1.6" fill="var(--g-entree)" />
    </svg>
  )
}
