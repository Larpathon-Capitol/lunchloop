import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { animate, useMotionValue, useMotionValueEvent, useReducedMotion } from 'framer-motion'
import { celebrateCopy } from './copy'
import './celebrate.css'

export interface BrushProgressProps {
  /** 0 to 1 */
  value: number
  /** Any CSS color. Default vermilion. */
  color?: string
  /** Stroke height in px. Default 20. */
  height?: number
  label?: string
  className?: string
}

const STEP = 5

/**
 * Outline of a brush stroke that is L px long: a blunt press at the start, a slightly uneven body,
 * and a long taper where the brush lifts. The wobble depends on x, so the body does not shimmer as it grows.
 */
function strokePath(L: number, H: number, thick: number, yShift = 0, wobbleSeed = 0): string {
  if (L < 1) return ''
  const cy = H / 2 + yShift
  const half = (H * thick) / 2
  const tail = Math.min(L * 0.4, 38)
  const press = Math.min(L, 9)
  const top: string[] = []
  const bot: string[] = []
  const n = Math.max(2, Math.ceil(L / STEP))
  for (let i = 0; i <= n; i++) {
    const x = (i / n) * L
    const toEnd = L - x
    let t = 1
    if (x < press) t = 0.5 + 0.5 * Math.sin((x / press) * (Math.PI / 2))
    if (toEnd < tail) t = Math.min(t, Math.pow(toEnd / tail, 0.75))
    const wob = 1 + 0.07 * Math.sin(x * 0.045 + wobbleSeed) + 0.04 * Math.sin(x * 0.13 + wobbleSeed * 2)
    const drift = 1.2 * Math.sin(x * 0.02 + wobbleSeed)
    const h = half * t * wob
    top.push(`${(x + 2).toFixed(1)} ${(cy + drift - h).toFixed(1)}`)
    bot.push(`${(x + 2).toFixed(1)} ${(cy + drift + h * 0.92).toFixed(1)}`)
  }
  return `M${top.join('L')}L${bot.reverse().join('L')}Z`
}

/** A sumi brush stroke progress bar. It paints forward with the brush ease when value goes up. */
export function BrushProgress({ value, color = 'var(--shu)', height = 20, label = celebrateCopy.progressLabel, className }: BrushProgressProps) {
  const reduce = useReducedMotion()
  const wrap = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(300)
  const clamped = Math.max(0, Math.min(1, value))
  const progress = useMotionValue(clamped)
  const [p, setP] = useState(clamped)
  const uid = useId().replace(/:/g, '')

  useLayoutEffect(() => {
    const el = wrap.current
    if (!el) return
    setWidth(Math.max(40, el.clientWidth))
    const ro = new ResizeObserver(() => setWidth(Math.max(40, el.clientWidth)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useMotionValueEvent(progress, 'change', setP)

  useEffect(() => {
    if (reduce) {
      progress.set(clamped)
      return
    }
    const up = clamped > progress.get()
    const controls = animate(progress, clamped, up ? { duration: 0.65, ease: [0.7, 0, 0.2, 1] } : { duration: 0.3, ease: [0.2, 0.72, 0.16, 1] })
    return () => controls.stop()
  }, [clamped, reduce, progress])

  const usable = width - 4
  const L = usable * p
  const filterId = `brush-dry-${uid}`
  return (
    <div
      ref={wrap}
      className={`brush${className ? ` ${className}` : ''}`}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
    >
      <svg viewBox={`0 0 ${width} ${height}`} height={height} aria-hidden="true">
        <defs>
          {/* Ragged edge, plus fine streaks where the bristles ran dry. */}
          <filter id={filterId} x="-2%" y="-30%" width="104%" height="160%" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="2" seed="2" result="warp" />
            <feDisplacementMap in="SourceGraphic" in2="warp" scale="3" xChannelSelector="R" yChannelSelector="G" result="rough" />
            <feTurbulence type="fractalNoise" baseFrequency="0.012 0.7" numOctaves="2" seed="7" result="streak" />
            <feColorMatrix in="streak" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -9 0 0 0 6.9" result="keep" />
            <feComposite in="rough" in2="keep" operator="in" />
          </filter>
        </defs>
        {/* The empty track: a faint, thinner stroke along the whole length. */}
        <path d={strokePath(usable, height, 0.5, 0, 3)} filter={`url(#${filterId})`} style={{ fill: 'var(--line)' }} />
        {L > 0.5 && (
          <g filter={`url(#${filterId})`} style={{ fill: color }}>
            <path d={strokePath(L, height, 0.92)} />
            {/* A second, thinner strand that splits off near the tail. */}
            <path d={strokePath(L * 0.94, height, 0.3, height * 0.2, 1.7)} opacity="0.75" />
          </g>
        )}
      </svg>
    </div>
  )
}
