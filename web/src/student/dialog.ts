// Modal plumbing shared by the picker and the food sheet: everything outside goes inert,
// Tab wraps inside, Escape closes, and focus returns to where it was.
import { useEffect, useRef, useSyncExternalStore, type RefObject } from 'react'

/**
 * Makes everything outside `el` inert (not focusable, hidden from screen readers),
 * by marking the siblings of `el` and of each of its ancestors. Returns an undo.
 */
function inertOutside(el: HTMLElement) {
  const changed: HTMLElement[] = []
  for (let node: HTMLElement | null = el; node && node !== document.body; node = node.parentElement) {
    const parent: HTMLElement | null = node.parentElement
    if (!parent) break
    for (const sib of Array.from(parent.children)) {
      if (sib === node || !(sib instanceof HTMLElement) || sib.inert) continue
      sib.inert = true
      changed.push(sib)
    }
  }
  return () => changed.forEach((n) => (n.inert = false))
}

const FOCUSABLE = 'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'

/** While `open`: focus `first` (or the first control), trap Tab, close on Escape, restore focus after. */
export function useDialog(root: RefObject<HTMLElement | null>, open: boolean, onClose: () => void, first?: RefObject<HTMLElement | null>) {
  const close = useRef(onClose)
  useEffect(() => {
    close.current = onClose
  })
  useEffect(() => {
    if (!open || !root.current) return
    const returnTo = document.activeElement as HTMLElement | null
    const undoInert = inertOutside(root.current)
    const start = first?.current ?? root.current.querySelector<HTMLElement>(FOCUSABLE)
    start?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        close.current()
        return
      }
      if (e.key !== 'Tab' || !root.current) return
      const items = Array.from(root.current.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (!items.length) return
      const head = items[0]
      const tail = items[items.length - 1]
      const inside = root.current.contains(document.activeElement)
      if (e.shiftKey && (document.activeElement === head || !inside)) {
        e.preventDefault()
        tail.focus()
      } else if (!e.shiftKey && (document.activeElement === tail || !inside)) {
        e.preventDefault()
        head.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      undoInert()
      returnTo?.focus({ preventScroll: true })
    }
  }, [open, root, first])
}

const WIDE = '(min-width: 960px)'

/** True on laptop-width screens, where the game lays out side by side. */
export function useWide(): boolean {
  return useSyncExternalStore(
    (l) => {
      const mq = window.matchMedia(WIDE)
      mq.addEventListener('change', l)
      return () => mq.removeEventListener('change', l)
    },
    () => window.matchMedia(WIDE).matches,
    () => false,
  )
}
