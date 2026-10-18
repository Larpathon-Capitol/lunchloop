// Lifts a mascot's speech bubble out of the page and into the mascot layer, just above the 3D
// canvas, so a hopping model never draws over its own words. The box follows its anchor element
// every frame while active (and a moment after, for the exit animation), then the loop stops.
// The layer sits below the header, tab bar, sheets and curtains, so bubbles never cover those.
import { useEffect, useRef, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { bubbleLayer } from './rig/bus'

/** How long the box keeps following after active turns off, so exit animations stay in place. */
const TAIL_MS = 600

export type FloatOverProps = {
  /** The element whose box the floating box copies. */
  anchor: RefObject<HTMLElement | null>
  /** True while something is showing. The follow loop only runs while active (plus a short tail). */
  active: boolean
  children: ReactNode
  className?: string
}

type VisibleCheck = HTMLElement & { checkVisibility?: (o: object) => boolean }

export function FloatOver({ anchor, active, children, className }: FloatOverProps) {
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let raf = 0
    const stopAt = active ? Infinity : performance.now() + TAIL_MS
    let frame = 0
    let visible = true
    const tick = () => {
      const el = anchor.current as VisibleCheck | null
      const b = box.current
      if (el && b) {
        // The visibility walk is the pricey part, so it runs every few frames.
        // The anchor may be an invisible placeholder (UmeInline's ghost bubble is visibility:
        // hidden on purpose), so its own visibility is ignored; the parent's still counts, so a
        // mascot hidden by its screen keeps its bubble hidden too.
        if (frame++ % 6 === 0) {
          const parent = (el.parentElement ?? el) as VisibleCheck
          visible = el.checkVisibility
            ? el.checkVisibility({ opacityProperty: true }) && !!parent.checkVisibility?.({ opacityProperty: true, visibilityProperty: true })
            : true
        }
        const r = el.getBoundingClientRect()
        const show = visible && r.width > 0
        b.style.visibility = show ? 'visible' : 'hidden'
        b.style.transform = `translate(${r.left}px, ${r.top}px)`
        b.style.width = `${r.width}px`
        b.style.height = `${r.height}px`
      }
      if (performance.now() < stopAt) raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [active, anchor])

  return createPortal(
    <div ref={box} className={`mascot-float${className ? ` ${className}` : ''}`}>
      {children}
    </div>,
    bubbleLayer(),
  )
}
