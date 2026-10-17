import { useId, type SVGProps } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

/* A plum branch in ink and wash. Each segment is one brush stroke, pressed at the start and
   thinning out, with dry-brush streaks running along it (its filter works in a frame rotated to
   match). Blossoms are boneless washes with pigment pooling at the petal edges. Set --plum-ink
   on a parent to recolor the branch ink. */

// Warm brown-black bark ink for the indigo ground, where pure sumi would vanish.
const BARK_ON_AI = '#46302a'

// x0, y0, x1, y1, start width, end width, bend, dry (1 = feibai streaks)
type Stroke = [number, number, number, number, number, number, number, 0 | 1]
// x, y, radius, rotation, kind (0 open face, 1 side view, 2 bud), appears after stroke n
type Bloom = [number, number, number, number, 0 | 1 | 2, number]
// x, y, radius: ink pools at joints and moss dots
type Dot = [number, number, number]
interface Art { box: string; strokes: Stroke[]; blooms: Bloom[]; dots: Dot[] }

const ART: Record<'corner' | 'branch', Art> = {
  corner: {
    box: '0 0 300 200',
    strokes: [
      [322, -8, 252, 38, 15, 10, 5, 1],
      [254, 37, 197, 57, 9.5, 6.5, -5, 1],
      [198, 57, 132, 94, 6.5, 2.6, 6, 0],
      [133, 94, 76, 104, 2.6, 0, -3, 0],
      [262, 32, 241, 94, 7, 3.6, 5, 1],
      [241, 93, 228, 150, 3.4, 0, -4, 0],
      [212, 52, 186, 20, 2.4, 0, 2, 0],
      [162, 81, 152, 122, 2, 0, -2, 0],
      [239, 88, 268, 124, 2, 0, 3, 0],
      [296, 9, 304, 40, 3, 0, -2, 0],
    ],
    blooms: [
      [214, 70, 17, 10, 0, 1],
      [150, 104, 13, -20, 0, 2],
      [250, 118, 15, 30, 0, 8],
      [188, 26, 11, -30, 1, 6],
      [78, 104, 3.4, 0, 2, 3],
      [228, 151, 3, 0, 2, 5],
      [304, 42, 3.2, 0, 2, 9],
    ],
    dots: [[252, 38, 4.6], [197, 57, 3.6], [241, 93, 2.6], [176, 70, 1.3], [281, 22, 1.5], [116, 98, 1]],
  },
  branch: {
    box: '0 0 400 400',
    strokes: [
      [-16, 410, 70, 330, 24, 16, -8, 1],
      [68, 333, 96, 252, 15, 10.5, 7, 1],
      [95, 255, 178, 206, 10.5, 6.5, -7, 1],
      [177, 207, 252, 188, 6.5, 3.4, 5, 0],
      [251, 189, 318, 140, 3.4, 0, -4, 0],
      [97, 258, 121, 150, 7, 3.6, -6, 1],
      [120, 152, 150, 74, 3.4, 0, 5, 0],
      [50, 350, 150, 330, 8, 3, -5, 1],
      [149, 330, 222, 302, 2.8, 0, 4, 0],
      [203, 200, 214, 118, 2.4, 0, 2, 0],
      [110, 205, 70, 172, 2.2, 0, -2, 0],
      [139, 328, 162, 284, 2, 0, 2, 0],
      [286, 163, 300, 120, 1.7, 0, -2, 0],
    ],
    blooms: [
      [178, 214, 20, 12, 0, 2],
      [128, 176, 20, -14, 0, 5],
      [214, 124, 21, 24, 0, 9],
      [262, 204, 16, -30, 0, 3],
      [150, 86, 14, 18, 1, 6],
      [226, 304, 17, -8, 0, 8],
      [74, 174, 13, -40, 1, 10],
      [318, 138, 4, 0, 2, 4],
      [151, 70, 3.6, 0, 2, 6],
      [162, 282, 4, 0, 2, 11],
      [300, 117, 3.4, 0, 2, 12],
    ],
    dots: [[69, 332, 6], [96, 254, 5], [177, 207, 3.6], [252, 189, 2.4], [150, 330, 2.2], [84, 296, 1.6], [138, 230, 1.4], [228, 195, 1.2], [30, 372, 2.2]],
  },
}

const f = (n: number) => Math.round(n * 10) / 10

/** Outline of one brush stroke laid along +x: pressed start, swelling slightly, tapering out. */
function brush(L: number, w0: number, w1: number, bend: number): string {
  const n = 16
  const top: string[] = []
  const bot: string[] = []
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const y = 4 * bend * t * (1 - t)
    const w = ((w0 + (w1 - w0) * t ** 0.9) * (1 + 0.16 * Math.sin(Math.PI * Math.min(t * 1.4, 1)))) / 2
    const s = (4 * bend * (1 - 2 * t)) / L
    const k = 1 / Math.hypot(1, s)
    top.push(`${f(t * L - s * k * w)} ${f(y + k * w)}`)
    bot.unshift(`${f(t * L + s * k * w)} ${f(y - k * w)}`)
  }
  const r = f(w0 / 2)
  return `M${top.join('L')}L${bot.join('L')}A${r} ${r * 1.15} 0 0 0 ${top[0]}Z`
}

// Small deterministic wobble so no two petals match.
const jit = (i: number, a: number) => 1 + a * Math.sin(i * 12.9898 + 4.1)

export interface PlumSprigProps extends Omit<SVGProps<SVGSVGElement>, 'ref'> {
  variant?: 'corner' | 'branch'
  /** Ground it is painted on. Defaults: corner on washi, branch on indigo. */
  ground?: 'washi' | 'ai'
  /** Branch variant: strokes draw in and blossoms open one by one. Static under reduced motion. */
  grow?: boolean
  title?: string
}

export function PlumSprig({ variant = 'corner', ground, grow = false, className, title, style, ...svgProps }: PlumSprigProps) {
  const id = 'pl' + useId().replace(/[^a-zA-Z0-9]/g, '')
  const reduce = useReducedMotion()
  const art = ART[variant]
  const onAi = (ground ?? (variant === 'branch' ? 'ai' : 'washi')) === 'ai'
  const anim = grow && !reduce
  const ink = `var(--plum-ink, ${onAi ? BARK_ON_AI : 'var(--sumi)'})`

  // Stroke timing: each stroke starts when the one it grows from is mostly done.
  const starts: number[] = []
  art.strokes.forEach(([x0, y0], i) => {
    let from = -1
    let best = 1e9
    for (let j = 0; j < i; j++) {
      const s = art.strokes[j]
      const d = Math.min(Math.hypot(s[0] - x0, s[1] - y0), Math.hypot(s[2] - x0, s[3] - y0))
      if (d < best) { best = d; from = j }
    }
    starts.push(from < 0 ? 0.1 : starts[from] + 0.32)
  })
  const ends = art.strokes.map(([x0, y0, x1, y1], i) => starts[i] + 0.5 + Math.hypot(x1 - x0, y1 - y0) / 600)

  return (
    <svg
      viewBox={art.box}
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      style={{ overflow: 'visible', ...style }}
      {...svgProps}
    >
      {title && <title>{title}</title>}
      <defs>
        <filter id={`${id}w`} x="-0.2" y="-1.5" width="1.4" height="4">
          <feTurbulence type="fractalNoise" baseFrequency="0.55" numOctaves={2} seed={4} />
          <feDisplacementMap in="SourceGraphic" scale="2.4" xChannelSelector="R" yChannelSelector="G" result="r" />
          <feGaussianBlur in="r" stdDeviation="0.3" />
        </filter>
        <filter id={`${id}d`} x="-0.1" y="-0.6" width="1.2" height="2.2">
          <feTurbulence type="fractalNoise" baseFrequency="0.5" numOctaves={2} seed={7} />
          <feDisplacementMap in="SourceGraphic" scale="3" xChannelSelector="R" yChannelSelector="G" result="r" />
          <feTurbulence type="fractalNoise" baseFrequency="0.008 0.5" numOctaves={3} seed={11} />
          <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -24 0 0 0 13.4" result="streak" />
          <feTurbulence type="fractalNoise" baseFrequency="0.03" seed={3} />
          <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 30 0 0 0 -14.6" />
          <feComposite in="streak" operator="over" result="mask" />
          <feComposite in="r" in2="mask" operator="in" result="dry" />
          <feComponentTransfer in="r" result="tone">
            <feFuncA type="linear" slope={onAi ? 0.3 : 0.36} />
          </feComponentTransfer>
          <feMerge>
            <feMergeNode in="tone" />
            <feMergeNode in="dry" />
          </feMerge>
        </filter>
        <filter id={`${id}p`} x="-0.4" y="-0.4" width="1.8" height="1.8">
          <feTurbulence type="fractalNoise" baseFrequency="0.07" numOctaves={2} seed={2} />
          <feDisplacementMap in="SourceGraphic" scale="3.2" xChannelSelector="R" yChannelSelector="G" result="s" />
          <feGaussianBlur in="s" stdDeviation="1.5" result="b" />
          <feComposite in="s" in2="b" operator="arithmetic" k2={onAi ? 1.15 : 1.35} k3={onAi ? -0.45 : -0.8} result="edge" />
          <feComponentTransfer in="b" result="bleed">
            <feFuncA type="linear" slope="0.22" />
          </feComponentTransfer>
          <feMerge>
            <feMergeNode in="bleed" />
            <feMergeNode in="edge" />
          </feMerge>
        </filter>
      </defs>

      <g fill={ink}>
        {art.strokes.map(([x0, y0, x1, y1, w0, w1, bend, dry], i) => {
          const L = Math.hypot(x1 - x0, y1 - y0)
          const deg = f((Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI)
          return (
            <g key={i} transform={`translate(${x0} ${y0}) rotate(${deg})`} filter={`url(#${id}${dry ? 'd' : 'w'})`}>
              {anim && (
                <mask id={`${id}m${i}`} maskUnits="userSpaceOnUse" x={-40} y={-40} width={L + 80} height={80}>
                  <motion.path
                    d={`M${-w0} 0Q${f(L / 2)} ${2 * bend} ${f(L + 4)} 0`}
                    fill="none"
                    stroke="#fff"
                    strokeWidth={w0 * 1.6 + 10}
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ delay: starts[i], duration: 0.5 + L / 600, ease: [0.7, 0, 0.2, 1] }}
                  />
                </mask>
              )}
              <path d={brush(L, w0, w1, bend)} mask={anim ? `url(#${id}m${i})` : undefined} />
            </g>
          )
        })}
        <motion.g
          filter={`url(#${id}w)`}
          initial={anim ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          transition={{ delay: Math.max(...ends) - 0.2, duration: 0.4 }}
        >
          {art.dots.map(([x, y, r], i) => (
            <ellipse key={i} cx={x} cy={y} rx={r} ry={r * 0.8} transform={`rotate(${i * 47} ${x} ${y})`} />
          ))}
        </motion.g>
      </g>

      {art.blooms.map(([x, y, r, rot, kind, after], i) => {
        const delay = ends[after] + 0.12 * i
        const tint = onAi && i % 3 === 1 ? 'var(--sakura)' : 'var(--ume)'
        return (
          <g key={i} transform={`translate(${x} ${y}) rotate(${rot})`}>
            <motion.g
              initial={anim ? { scale: 0.2, opacity: 0, rotate: -25 } : false}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={{ delay, type: 'spring', stiffness: 170, damping: 16 }}
            >
              {kind === 2 ? (
                <>
                  <ellipse rx={r} ry={r * 1.15} fill="var(--ume)" fillOpacity={onAi ? 1 : 0.85} filter={`url(#${id}p)`} />
                  <path d={`M${-r * 0.8} ${r * 0.5}Q0 ${r * 1.9} ${r * 0.8} ${r * 0.5}Q0 ${r * 1.1} ${-r * 0.8} ${r * 0.5}`} fill={ink} />
                </>
              ) : (
                <>
                  <g fill={tint} filter={`url(#${id}p)`}>
                    {(kind === 0 ? [0, 72, 144, 216, 288] : [-62, -10, 42]).map((a, j) => {
                      const t = ((a - 90 + 9 * Math.sin(i * 5 + j * 3)) * Math.PI) / 180
                      const d = r * (kind === 0 ? 0.5 : 0.62) * jit(i + j, 0.08)
                      return (
                        <circle
                          key={j}
                          cx={f(Math.cos(t) * d)}
                          cy={f(Math.sin(t) * d)}
                          r={f(r * 0.5 * jit(i * 3 + j, 0.14))}
                          fillOpacity={(onAi ? 1 : 0.6) * jit(i * 7 + j, 0.15)}
                        />
                      )
                    })}
                  </g>
                  {kind === 0 && <circle r={r * 0.17} fill="var(--ume)" />}
                  {kind === 1 && (
                    <g fill={ink}>
                      <ellipse cx={-r * 0.16} cy={r * 0.34} rx={r * 0.17} ry={r * 0.08} transform={`rotate(-38 ${-r * 0.16} ${r * 0.34})`} />
                      <ellipse cx={r * 0.16} cy={r * 0.34} rx={r * 0.17} ry={r * 0.08} transform={`rotate(38 ${r * 0.16} ${r * 0.34})`} />
                    </g>
                  )}
                  <g strokeLinecap="round" stroke={onAi ? 'var(--kin-light)' : ink} strokeOpacity={onAi ? 0.7 : 0.55} strokeWidth={0.4}>
                    {Array.from({ length: kind === 0 ? 12 : 5 }, (_, j) => {
                      const a = kind === 0 ? (j * 30 + 7) * (Math.PI / 180) : (-130 + j * 20) * (Math.PI / 180)
                      const len = r * (kind === 0 ? 0.36 : 0.55) * jit(i + j * 5, 0.25)
                      const ex = f(Math.cos(a) * len)
                      const ey = f(Math.sin(a) * len)
                      return (
                        <g key={j}>
                          <line x1={0} y1={kind === 0 ? 0 : -r * 0.1} x2={ex} y2={ey} />
                          <circle cx={ex} cy={ey} r={0.75} fill="var(--kin-light)" stroke="none" />
                        </g>
                      )
                    })}
                  </g>
                </>
              )}
            </motion.g>
          </g>
        )
      })}
    </svg>
  )
}
