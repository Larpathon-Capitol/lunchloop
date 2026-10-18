/**
 * Tiny columns for a short series, oldest first. The last column can be marked as "now".
 * Decorative to screen readers: pass the same story in `label` for the title tooltip and
 * say it in text nearby.
 */
export function SparkBars({ values, highlightLast = true, height = 32 }: { values: number[]; highlightLast?: boolean; height?: number }) {
  const n = values.length
  if (n === 0) return null
  const max = Math.max(1, ...values)
  const gap = 3
  const w = 8
  const width = n * w + (n - 1) * gap
  return (
    <svg className="c-spark" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <line className="c-spark__base" x1="0" x2={width} y1={height - 0.5} y2={height - 0.5} />
      {values.map((v, i) => {
        const h = v > 0 ? Math.max(3, (v / max) * (height - 2)) : 0
        const now = highlightLast && i === n - 1
        return (
          <rect
            key={i}
            className={now ? 'c-spark__bar c-spark__bar--now' : 'c-spark__bar'}
            x={i * (w + gap)}
            y={height - 1 - h}
            width={w}
            height={h}
            rx={2}
          />
        )
      })}
    </svg>
  )
}
