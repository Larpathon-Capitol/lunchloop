/**
 * The LunchLoop mark: the steel tray seen from above. A silver body with a polished inner rim,
 * and five wells in their food group glazes, laid out like the 3D tray. The steel has its own
 * outline, so the mark holds up on indigo and on paper. public/favicon.svg draws the same mark.
 */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={(size * 20) / 28} viewBox="0 0 28 20" aria-hidden="true" focusable="false" className="logo-mark">
      <rect x="0.7" y="0.7" width="26.6" height="18.6" rx="4.6" fill="var(--line)" stroke="var(--nezumi)" strokeWidth="1.1" />
      <rect x="2.1" y="2.1" width="23.8" height="15.8" rx="3.3" fill="none" stroke="var(--shoji)" strokeWidth="0.9" />
      <rect x="3.6" y="3.6" width="6.2" height="5.6" rx="1.4" fill="var(--g-fruit)" />
      <rect x="10.8" y="3.6" width="6.4" height="5.6" rx="1.4" fill="var(--g-vegetable)" />
      <circle cx="21.3" cy="6.4" r="2.9" fill="var(--g-milk)" />
      <rect x="3.6" y="10.2" width="6.8" height="6.2" rx="1.4" fill="var(--g-grain)" />
      <rect x="11.4" y="10.2" width="13" height="6.2" rx="1.4" fill="var(--g-entree)" />
    </svg>
  )
}
