// A paper sheet with a soft top edge (a noren hem in East Asia). A bottom sheet on phones (drag down to close),
// a side panel on laptops. Modal: the rest of the page goes inert while it is open.
import { AnimatePresence, motion, useReducedMotion, type PanInfo } from 'framer-motion'
import { useRef, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { Close } from '../shared/icons'
import { copy } from '../shared/copy'
import { useDialog, useWide } from './dialog'
import { fade, sheetSpring } from './springs'

interface Props {
  open: boolean
  onClose: () => void
  labelledBy: string
  /** Gets focus when the sheet opens. Defaults to the close button. */
  initialFocus?: RefObject<HTMLElement | null>
  /** Sits under the noren edge, left of the close button. */
  head: ReactNode
  children: ReactNode
  className?: string
}

function Inner({ onClose, labelledBy, initialFocus, head, children, className }: Omit<Props, 'open'>) {
  const reduce = useReducedMotion()
  const wide = useWide()
  const root = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  useDialog(root, true, onClose, initialFocus ?? closeRef)

  const away = wide ? { x: '100%' } : { y: '100%' }
  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 80 || info.velocity.y > 500) onClose()
  }

  return (
    <div className="sheet" ref={root}>
      <motion.div
        className="sheet__scrim"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={reduce ? fade : { duration: 0.22 }}
      />
      <motion.div
        className={`sheet__panel${wide ? ' sheet__panel--side' : ''}${className ? ` ${className}` : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        initial={reduce ? { opacity: 0 } : away}
        animate={reduce ? { opacity: 1 } : { x: 0, y: 0 }}
        exit={reduce ? { opacity: 0 } : away}
        transition={reduce ? fade : sheetSpring}
        drag={reduce || wide ? false : 'y'}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.6 }}
        onDragEnd={onDragEnd}
      >
        <div className="sheet__noren" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="sheet__head">
          <div className="sheet__head-main">{head}</div>
          <button ref={closeRef} type="button" className="icon-btn" onClick={onClose} aria-label={copy.student.picker.close}>
            <Close />
          </button>
        </div>
        <div className="sheet__body">{children}</div>
      </motion.div>
    </div>
  )
}

/** Rendered into <body>, so it sits above the page, the tray stage and the docked mascot. */
export function Sheet({ open, ...rest }: Props) {
  return createPortal(<AnimatePresence>{open && <Inner key="sheet" {...rest} />}</AnimatePresence>, document.body)
}
