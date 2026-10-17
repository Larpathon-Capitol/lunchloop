import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { animate, motion, useMotionValue, useTransform } from 'framer-motion'
import { api } from './shared/api'
import { copy } from './shared/copy'
import { fmtDay, fmtInt } from './shared/format'
import { useReducedMotion } from './shared/motion'
import { useApi } from './shared/useApi'
import { SimulatedTag } from './shared/ui/SimulatedTag'
import './home.css'

const lineSpring = { type: 'spring', stiffness: 210, damping: 25, mass: 0.9 } as const
const traySpring = { type: 'spring', stiffness: 260, damping: 26 } as const

/** Each line rises out of its own mask. Under reduced motion it simply renders in place. */
function Headline({ lines, reduce }: { lines: string[]; reduce: boolean }) {
  return (
    <h1 className="home__title">
      {lines.map((line, i) => (
        <span className="home__line" key={line}>
          <motion.span
            className="home__line-inner"
            initial={reduce ? false : { y: '115%' }}
            animate={{ y: '0%' }}
            transition={{ ...lineSpring, delay: 0.08 * i }}
          >
            {line}
          </motion.span>
        </span>
      ))}
    </h1>
  )
}

/** A lunch tray from above. The plate carries the same loop as the logo. Flat shapes, token colors only. */
function Tray({ reduce }: { reduce: boolean }) {
  return (
    <motion.svg
      className="home__tray"
      viewBox="0 0 320 208"
      role="img"
      aria-label={copy.home.trayLabel}
      initial={reduce ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...traySpring, delay: 0.25 }}
    >
      {/* tray: flat under-edge, body, heavy rim, then the compartments */}
      <rect x="3" y="9" width="314" height="196" rx="8" fill="var(--line)" />
      <rect x="3" y="3" width="314" height="196" rx="8" fill="var(--surface)" stroke="var(--ink)" strokeWidth="3" />
      <rect x="16" y="16" width="170" height="170" rx="8" fill="var(--paper)" />
      <rect x="198" y="16" width="104" height="76" rx="8" fill="var(--paper)" />
      <rect x="198" y="104" width="104" height="82" rx="8" fill="var(--paper)" />
      {/* plate, with the loop */}
      <circle cx="101" cy="105" r="64" fill="var(--line)" />
      <circle cx="101" cy="100" r="64" fill="var(--surface)" stroke="var(--ink)" strokeWidth="3" />
      <circle cx="101" cy="100" r="46" fill="var(--paper)" />
      <motion.path
        d="M101 70A30 30 0 1 1 71 100"
        fill="none"
        stroke="var(--accent-mark)"
        strokeWidth="7"
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.3, ease: [0.2, 0, 0, 1], delay: 0.45 }}
      />
      <motion.path
        d="M60 101h22l-11-18z"
        fill="var(--accent-mark)"
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.12, delay: 0.7 }}
      />
      {/* fruit */}
      <circle cx="236" cy="58" r="22" fill="var(--accent-mark)" />
      <path d="M236 36c0-8 6-12 12-12 0 8-5 12-12 12z" fill="var(--ink)" />
      <circle cx="278" cy="66" r="14" fill="var(--surface)" stroke="var(--ink)" strokeWidth="3" />
      <rect x="276" y="46" width="4" height="9" rx="2" fill="var(--ink)" />
      {/* bowl */}
      <circle cx="232" cy="150" r="28" fill="var(--surface)" stroke="var(--ink)" strokeWidth="3" />
      <circle cx="232" cy="150" r="19" fill="var(--slate)" />
      {/* milk carton */}
      <path d="M268 120h24l3 14v48a4 4 0 0 1-4 4h-22a4 4 0 0 1-4-4v-48z" fill="var(--surface)" stroke="var(--ink)" strokeWidth="3" strokeLinejoin="round" />
      <rect x="268" y="146" width="24" height="18" fill="var(--slate)" />
    </motion.svg>
  )
}

function Count({ value, reduce }: { value: number; reduce: boolean }) {
  const mv = useMotionValue(reduce ? value : 0)
  const text = useTransform(mv, (v) => fmtInt(v))
  useEffect(() => {
    if (reduce) {
      mv.set(value)
      return
    }
    const controls = animate(mv, value, { duration: 0.3, ease: [0.2, 0, 0, 1] })
    return () => controls.stop()
  }, [value, reduce, mv])
  return <motion.span className="num">{text}</motion.span>
}

function Meter({ reduce }: { reduce: boolean }) {
  const [meter] = useApi(api.meter)
  return (
    <div className="home__meter" aria-live="polite">
      {meter.state === 'ready' && (
        <>
          <p className="home__meter-line">
            <span className="home__meter-num">
              <Count value={meter.data.servings_saved} reduce={reduce} />
            </span>{' '}
            {copy.home.meterSuffix}, {copy.home.meterWeek(fmtDay(meter.data.week_start, { month: 'short', day: 'numeric' }))}
          </p>
          <SimulatedTag />
        </>
      )}
      {meter.state === 'loading' && <p className="home__meter-note">{copy.home.meterLoading}</p>}
      {meter.state === 'error' && <p className="home__meter-note">{copy.home.meterError}</p>}
    </div>
  )
}

export function Home() {
  const reduce = !!useReducedMotion()
  return (
    <div className="home">
      <div className="home__copy">
        <Headline lines={copy.home.titleLines} reduce={reduce} />
        <p className="home__lead">{copy.home.lead}</p>
        <div className="home__actions">
          <Link to="/student" className="btn btn--primary home__cta">
            {copy.home.studentCta}
          </Link>
          <Link to="/school" className="btn btn--quiet home__cta">
            {copy.home.schoolCta}
          </Link>
        </div>
      </div>
      <div className="home__visual">
        <Tray reduce={reduce} />
        <Meter reduce={reduce} />
      </div>
    </div>
  )
}
