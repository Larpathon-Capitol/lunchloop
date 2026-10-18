// The hero headline: words rise out of their own masks one after another, a marker swash paints
// in, the last word rises onto it, then keeps rolling through a few verbs while the swash
// stretches to fit each one. Screen readers get the plain sentence once.
import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { heroCopy } from './copy'

const rise = { type: 'spring', stiffness: 260, damping: 30, mass: 1 } as const
const roll = { type: 'spring', stiffness: 380, damping: 22, mass: 0.8 } as const
const ROTATE_MS = 2400

/** Props for the hero headline. */
export interface HeadlineProps {
  reduce: boolean
  /** Seconds before the first word rises. */
  delay?: number
}

function Word({ text, i, delay, reduce }: { text: string; i: number; delay: number; reduce: boolean }) {
  return (
    <span className="hl__mask">
      <motion.span
        className="hl__word"
        initial={reduce ? false : { y: '112%', rotate: 7 }}
        animate={{ y: '0%', rotate: 0 }}
        transition={{ ...rise, delay: delay + i * 0.07 }}
      >
        {text}
      </motion.span>
    </span>
  )
}

export function Headline({ reduce, delay = 0.15 }: HeadlineProps) {
  const words = heroCopy.titleWords
  const [n, setN] = useState(0)
  useEffect(() => {
    if (reduce) return
    let timer = 0
    const start = window.setTimeout(() => {
      timer = window.setInterval(() => {
        if (!document.hidden) setN((v) => (v + 1) % words.length)
      }, ROTATE_MS)
    }, 1600)
    return () => {
      window.clearTimeout(start)
      window.clearInterval(timer)
    }
  }, [reduce, words.length])
  const last = heroCopy.titleStart.length
  // The swash paints in once the last plain word is on its way; the rolling word lands on it.
  const swashAt = delay + last * 0.07 + 0.1
  const landAt = swashAt + 0.22
  // Each word's width, measured off screen, so the swash springs to fit the word on show.
  const sizer = useRef<HTMLSpanElement>(null)
  const [widths, setWidths] = useState<number[]>([])
  const measure = useCallback(() => {
    const el = sizer.current
    if (!el) return
    const next = Array.from(el.children, (c) => (c as HTMLElement).offsetWidth)
    setWidths((prev) => (prev.length === next.length && prev.every((w, i) => w === next[i]) ? prev : next))
  }, [])
  useLayoutEffect(() => {
    const el = sizer.current
    if (!el) return
    measure()
    // Watch each word: they change size when the display font arrives or the world switches.
    const ro = new ResizeObserver(measure)
    Array.from(el.children).forEach((c) => ro.observe(c))
    const fonts = document.fonts
    void fonts?.ready.then(measure)
    fonts?.addEventListener('loadingdone', measure)
    return () => {
      ro.disconnect()
      fonts?.removeEventListener('loadingdone', measure)
    }
  }, [measure])
  // Check again on every roll, so a late font or a world switch never leaves a word off its swash.
  useLayoutEffect(measure, [n, measure])
  const width = widths[n]
  return (
    <h1 className="hl" aria-label={heroCopy.titleLabel}>
      <span className="hl__line" aria-hidden="true">
        <Word text={heroCopy.titleStart[0]} i={0} delay={delay} reduce={reduce} />{' '}
        <Word text={heroCopy.titleStart[1]} i={1} delay={delay} reduce={reduce} />
      </span>
      <span className="hl__line" aria-hidden="true">
        <Word text={heroCopy.titleStart[2]} i={2} delay={delay} reduce={reduce} />{' '}
        <motion.span
          className="hl__spin"
          animate={width ? { width } : undefined}
          transition={reduce ? { duration: 0 } : roll}
        >
          {/* The swash behind the word paints in once, then stays while the words roll. */}
          <motion.span
            className="hl__swash"
            initial={reduce ? false : { scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.45, ease: [0.7, 0, 0.2, 1], delay: swashAt }}
          />
          <span className="hl__sizer" ref={sizer}>
            {words.map((w) => (
              <span key={w}>{w}</span>
            ))}
          </span>
          {/* Holds the line height and a first width before the sizer has measured. */}
          <span className="hl__ghost">{words[0]}</span>
          <span className="hl__mask hl__mask--spin">
            <AnimatePresence initial={false} mode="popLayout">
              <motion.span
                key={words[n]}
                className="hl__word hl__word--spin"
                initial={reduce ? false : { y: '110%' }}
                animate={{ y: '0%' }}
                exit={{ y: '-110%' }}
                transition={roll}
              >
                <motion.span
                  className="hl__word-in"
                  initial={reduce || n !== 0 ? false : { y: '112%', rotate: 7 }}
                  animate={{ y: '0%', rotate: 0 }}
                  transition={{ ...rise, delay: landAt }}
                >
                  {words[n]}
                </motion.span>
              </motion.span>
            </AnimatePresence>
          </span>
        </motion.span>
      </span>
    </h1>
  )
}
