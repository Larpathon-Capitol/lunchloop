/**
 * The LunchLoop mark: a lunch tray seen from above. A thick plum outline, a light tray body so it
 * holds up on pink and on dark header bars, and three chunky wells with the big one bottom-right.
 * public/favicon.svg draws the same mark with fixed colors.
 */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={(size * 20) / 28} viewBox="0 0 28 20" aria-hidden="true" focusable="false" overflow="visible" className="logo-mark">
      <rect x="1" y="1" width="26" height="18" rx="5" fill="var(--surface, #FFF4F7)" stroke="var(--ink, #3A1626)" strokeWidth="2" />
      <rect x="3.8" y="3.8" width="5.8" height="12.4" rx="1.8" fill="var(--pink-2, #FFC2D1)" />
      <circle cx="17.6" cy="6.2" r="2.4" fill="var(--leaf, #5FB77A)" />
      <rect x="11.4" y="10" width="12.8" height="6.2" rx="1.8" fill="var(--pink-5, #FB6F92)" />
    </svg>
  )
}
