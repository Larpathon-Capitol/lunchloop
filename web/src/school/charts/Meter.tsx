/** A thin progress bar for a tile foot. Decorative; say the number in text next to it. */
export function Meter({ fraction }: { fraction: number }) {
  const f = Math.max(0, Math.min(1, Number.isFinite(fraction) ? fraction : 0))
  return (
    <span className="c-meter" aria-hidden="true">
      <span className="c-meter__fill" style={{ transform: `scaleX(${f})` }} />
    </span>
  )
}
