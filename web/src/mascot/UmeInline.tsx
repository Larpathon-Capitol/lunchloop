// The mascot inside the page layout, used wherever the floating dock would cover content. A small
// mascot with its speech bubble beside it, in space the layout reserves, so nothing ever sits under it.
// Driven by the same store as the dock, so ume.react() and ume.say() work the same everywhere.
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useDocked } from './dock'
import { announce, useUmeState } from './store'
import { Ume } from './Ume'
import './ume.css'

const BUBBLE_MS = 3800
/** A line said this recently (say, the greeting while the tray was loading) still shows on mount. */
const FRESH_MS = 1500

export type UmeInlineProps = {
  /** Ume's width in CSS pixels. */
  size?: number
  /** Rendered under the bubble, beside Ume (the tray's progress line, for example). */
  children?: ReactNode
  className?: string
}

export function UmeInline({ size = 56, children, className }: UmeInlineProps) {
  const docked = useDocked()
  const state = useUmeState()
  const reduce = useReducedMotion()
  const [bubble, setBubble] = useState<{ text: string; id: number } | null>(() =>
    state.line && performance.now() - state.lineAt < FRESH_MS ? { text: state.line, id: state.lineId } : null,
  )
  const seen = useRef(state.lineId)

  useEffect(() => {
    if (state.lineId === seen.current) return
    seen.current = state.lineId
    if (!state.line) return
    setBubble({ text: state.line, id: state.lineId })
    announce(state.line)
  }, [state.line, state.lineId])

  useEffect(() => {
    if (!bubble) return
    const id = window.setTimeout(() => setBubble(null), BUBBLE_MS)
    return () => window.clearTimeout(id)
  }, [bubble])

  if (docked) return children ? <div className={className}>{children}</div> : null

  return (
    <div className={`ume-inline${className ? ` ${className}` : ''}`} style={{ ['--ume-inline-size' as string]: `${size}px` }}>
      <span className="ume-inline__ume">
        <Ume size={size} mood={state.mood} hopKey={state.hopId} talking={!!bubble} />
      </span>
      <div className="ume-inline__col">
        <div className="ume-inline__say">
          <AnimatePresence>
            {bubble && (
              <motion.p
                key={bubble.id}
                className="ume-inline__bubble"
                initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.85, x: -6 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, transition: { duration: 0.16 } }}
                transition={reduce ? { duration: 0.12 } : { type: 'spring', stiffness: 520, damping: 26 }}
              >
                {bubble.text}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
        {children}
      </div>
    </div>
  )
}
