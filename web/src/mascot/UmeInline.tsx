// The mascot inside the page layout, used wherever the floating dock would cover content. A small
// mascot with its speech bubble beside it, in space the layout reserves, so nothing ever sits under it.
// Driven by the same store as the dock, so ume.react() and ume.say() work the same everywhere.
// The bubble's space is held by an invisible copy in the layout; the visible bubble is lifted
// above the 3D layer (FloatOver), so a hop never draws the model over the words.
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useDocked } from './dock'
import { FloatOver } from './FloatOver'
import { announce, ume, useUmeState } from './store'
import { Ume } from './Ume'
import './ume.css'

const BUBBLE_MS = 3800
/** A line said this recently (say, the greeting while the tray was loading) still shows on mount. */
const FRESH_MS = 1500
/** Smallest inline mascot that still reads clearly as a 3D character. */
const MIN_SIZE = 64

export type UmeInlineProps = {
  /** Mascot width in CSS pixels. Never drawn smaller than 64. */
  size?: number
  /** Rendered under the bubble, beside the mascot (the tray's progress line, for example). */
  children?: ReactNode
  className?: string
}

type Bubble = { text: string; id: number }

/** Petted lines show in the inline bubble's reserved space, never floating over the page. */
const sayInline = (text: string) => ume.say(text)

export function UmeInline({ size = 64, children, className }: UmeInlineProps) {
  const px = Math.max(MIN_SIZE, size)
  const docked = useDocked()
  const state = useUmeState()
  const reduce = useReducedMotion()
  const [bubble, setBubble] = useState<Bubble | null>(() =>
    state.line && performance.now() - state.lineAt < FRESH_MS ? { text: state.line, id: state.lineId } : null,
  )
  // The text that holds the bubble's space; kept through the exit animation.
  const [held, setHeld] = useState<string | null>(bubble?.text ?? null)
  const [seen, setSeen] = useState(state.lineId)
  // A new line from the store shows a new bubble (adjusted during render, not in an effect).
  if (state.lineId !== seen) {
    setSeen(state.lineId)
    if (state.line) {
      setBubble({ text: state.line, id: state.lineId })
      setHeld(state.line)
    }
  }

  // Announce new lines (not the one already showing on mount).
  const announced = useRef(bubble?.id ?? state.lineId)
  useEffect(() => {
    if (!bubble || bubble.id === announced.current) return
    announced.current = bubble.id
    announce(bubble.text)
  }, [bubble])

  useEffect(() => {
    if (!bubble) return
    const id = window.setTimeout(() => setBubble(null), BUBBLE_MS)
    return () => window.clearTimeout(id)
  }, [bubble])

  const ghost = useRef<HTMLParagraphElement>(null)
  const root = useRef<HTMLDivElement>(null)
  // Which side Ume stands on (phone headings put it at the end of the row), for the bubble's tail.
  const markTail = (p: HTMLParagraphElement | null) => {
    if (p && root.current) p.dataset.tail = getComputedStyle(root.current).flexDirection === 'row-reverse' ? 'end' : 'start'
  }
  const showing = useRef(bubble)
  useEffect(() => {
    showing.current = bubble
  }, [bubble])

  if (docked) return children ? <div className={className}>{children}</div> : null

  return (
    <div ref={root} className={`ume-inline${className ? ` ${className}` : ''}`} style={{ ['--ume-inline-size' as string]: `${px}px` }}>
      <span className="ume-inline__ume">
        <Ume size={px} mood={state.mood} hopKey={state.hopId} talking={!!bubble} onLine={sayInline} />
      </span>
      <div className="ume-inline__col">
        <div className="ume-inline__say">
          {held && (
            <p ref={ghost} className="ume-inline__bubble ume-inline__bubble--ghost" aria-hidden="true">
              {held}
            </p>
          )}
        </div>
        {children}
      </div>
      <FloatOver anchor={ghost} active={!!bubble}>
        <AnimatePresence onExitComplete={() => !showing.current && setHeld(null)}>
          {bubble && (
            <motion.p
              key={bubble.id}
              ref={markTail}
              className="ume-inline__bubble ume-inline__bubble--live"
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.16 } }}
              transition={reduce ? { duration: 0.12 } : { type: 'spring', stiffness: 520, damping: 26 }}
            >
              {bubble.text}
            </motion.p>
          )}
        </AnimatePresence>
      </FloatOver>
    </div>
  )
}
