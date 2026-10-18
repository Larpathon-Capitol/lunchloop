/**
 * A ring gauge: one fraction drawn as an arc, the percent in the middle.
 * Decorative to screen readers; the caller puts the same number in text nearby.
 */
export function Ring({ fraction, size = 64, stroke = 8, label }: { fraction: number; size?: number; stroke?: number; label?: string }) {
  const f = Math.max(0, Math.min(1, Number.isFinite(fraction) ? fraction : 0))
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <svg className="c-ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle className="c-ring__track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} fill="none" />
      {f > 0 && (
        <circle
          className="c-ring__fill"
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${Math.max(0.001, f * c)} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      )}
      {label && (
        <text className="c-ring__text" x="50%" y="50%" dominantBaseline="central" textAnchor="middle">
          {label}
        </text>
      )}
    </svg>
  )
}
