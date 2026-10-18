/**
 * The LunchLoop mark: two rounded L strokes chasing each other around a tray, with a leaf in the
 * middle. Read as a tray from above, as a loop, and as the LL monogram. Colors come from
 * --mark-a, --mark-b, --mark-leaf and --mark-vein (see brand.css), so each world and each
 * header can tint it. public/favicon.svg draws the same paths with fixed colors.
 */
export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
      className={className ? `ll-mark ${className}` : 'll-mark'}
    >
      <path className="ll-mark__a" d="M5.5 11V20A6.5 6.5 0 0 0 12 26.5H20" />
      <path className="ll-mark__b" d="M26.5 21V12A6.5 6.5 0 0 0 20 5.5H12" />
      <path className="ll-mark__leaf" d="M11.6 20.4C11.2 14.6 14.6 11.2 20.4 11.6C20.8 17.4 17.4 20.8 11.6 20.4Z" />
      <path className="ll-mark__vein" d="M13.6 18.4L17.8 14.2" />
    </svg>
  )
}
