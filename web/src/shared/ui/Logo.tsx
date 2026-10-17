/**
 * The LunchLoop mark: a plate seen from above with a loop inside it.
 * Solid shapes and a filled arrowhead so it stays readable at 16px.
 * Keep public/favicon.svg in sync (it uses the same shapes with fixed colors).
 */
export function Logo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="10.25" fill="none" stroke="var(--ink)" strokeWidth="2.5" />
      <path d="M12 6.8A5.2 5.2 0 1 1 6.8 12" fill="none" stroke="var(--accent-mark)" strokeWidth="2.5" strokeLinecap="butt" />
      <path d="M4.3 12.4h5l-2.5-3.7z" fill="var(--accent-mark)" />
    </svg>
  )
}
