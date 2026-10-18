// Lunch service for staff: who checked in after eating today's packed tray, which foods ran out,
// and a compact button per food to make its leftovers free. Foods students packed come first,
// most ran out first; the rest fold behind one "show more" toggle.
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { motion } from 'framer-motion'
import { api, ApiError } from '../shared/api'
import type { AdminSummary, ServiceView } from '../shared/api'
import { free as freeCopy } from '../shared/copy/free'
import { service as sc } from '../shared/copy/service'
import { useReducedMotion } from '../shared/motion'
import { TRAY_ORDER } from './trayTypes'
import { CheckInSummary } from './service/CheckInSummary'
import { ServiceRow, type ServiceItem as Item } from './service/ServiceRow'
import './service.css'

const t = freeCopy.service
const pop = { type: 'spring', stiffness: 380, damping: 22, mass: 0.8 } as const
const timeFmt = { hour: 'numeric', minute: '2-digit' } as const
/** Packed foods shown before the "show more" toggle (fewer on phones). Free foods always show. */
const FIRST = 6
const FIRST_PHONE = 4
const PHONE = '(max-width: 599px)'

function subscribePhone(cb: () => void) {
  const m = window.matchMedia(PHONE)
  m.addEventListener('change', cb)
  return () => m.removeEventListener('change', cb)
}
const isPhone = () => window.matchMedia(PHONE).matches

/** Local free state for a food while a change is in flight or until the next summary confirms it. */
interface Override {
  free: boolean
  sending: boolean
}

export interface ServicePanelProps {
  /** `service` from the admin summary; null when nobody packed a tray for today. */
  service: ServiceView | null
  /** `free` from the admin summary, for the "free since" time. */
  freeList: AdminSummary['free']
  token: string
  /** Ask the summary to refresh now (after a change). */
  onChanged: () => void
  /** The staff sign-in ran out. */
  onExpired: () => void
}

export function ServicePanel({ service, freeList, token, onChanged, onExpired }: ServicePanelProps) {
  const reduce = !!useReducedMotion()
  const [overrides, setOverrides] = useState<Record<string, Override>>({})
  const [confirming, setConfirming] = useState<Item | null>(null)
  const [note, setNote] = useState<{ text: string; bad: boolean } | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const returnTo = useRef<HTMLElement | null>(null)

  // Fresh numbers from the server settle every finished change (adjusting state during render).
  const [seen, setSeen] = useState(service)
  if (seen !== service) {
    setSeen(service)
    const keep = Object.entries(overrides).filter(([, v]) => v.sending)
    if (keep.length !== Object.keys(overrides).length) setOverrides(Object.fromEntries(keep))
  }

  useEffect(() => {
    const d = dialogRef.current
    if (!d) return
    if (confirming && !d.open) d.showModal()
    if (!confirming && d.open) d.close()
  }, [confirming])

  async function setFree(item: Item, value: boolean) {
    setOverrides((o) => ({ ...o, [item.item_id]: { free: value, sending: true } }))
    setNote(null)
    try {
      await api.adminFree(token, item.item_id, value)
      setOverrides((o) => ({ ...o, [item.item_id]: { free: value, sending: false } }))
      setNote({ text: value ? t.madeFree(item.name) : t.endedFree(item.name), bad: false })
      onChanged()
    } catch (e) {
      setOverrides((o) => {
        const next = { ...o }
        delete next[item.item_id]
        return next
      })
      const err = e instanceof ApiError ? e : new ApiError(0, String(e))
      if (err.status === 401) {
        onExpired()
        return
      }
      setNote({ text: t.failed(item.name, err.status === 0 ? t.offline : err.message), bad: true })
    }
  }

  function ask(item: Item, el: HTMLElement) {
    if (item.waiting > 0) {
      returnTo.current = el
      setConfirming(item)
    } else {
      void setFree(item, true)
    }
  }

  function closeDialog(go: boolean) {
    const item = confirming
    setConfirming(null)
    // Put focus back on the row's button, which is still there after a cancel.
    requestAnimationFrame(() => returnTo.current?.focus())
    if (go && item) void setFree(item, true)
  }

  const sinceOf = (id: string) => {
    const hit = freeList.find((f) => f.item_id === id)
    if (!hit) return null
    const d = new Date(hit.since)
    return Number.isNaN(d.getTime()) ? null : d.toLocaleTimeString([], timeFmt)
  }

  const isFreeNow = (item: Item) => overrides[item.item_id]?.free ?? item.free

  return (
    <section className="s-svc" aria-labelledby="s-svc-h">
      <div className="s-svc__head">
        <h2 id="s-svc-h" className="s-sec-title">
          {t.heading}
        </h2>
        <p className="s-sec-sub">{sc.sub}</p>
      </div>

      {!service ? (
        <p className="s-hint s-hint--empty s-svc__none">{t.none}</p>
      ) : (
        <>
          <CheckInSummary service={service} />
          <FoodList
            items={service.items}
            isFree={isFreeNow}
            overrides={overrides}
            sinceOf={sinceOf}
            reduce={reduce}
            onMakeFree={ask}
            onUndo={(item) => void setFree(item, false)}
          />
        </>
      )}

      <p className={note?.bad ? 's-svc__note s-svc__note--bad' : 's-svc__note'} role="status" aria-live="polite">
        {note?.text ?? ''}
      </p>

      <dialog
        ref={dialogRef}
        className="s-svc__dialog"
        aria-labelledby="s-svc-dlg-h"
        aria-describedby="s-svc-dlg-b"
        onCancel={(e) => {
          e.preventDefault()
          closeDialog(false)
        }}
        onClick={(e) => {
          // A click on the backdrop lands on the dialog element itself.
          if (e.target === e.currentTarget) closeDialog(false)
        }}
      >
        {confirming && (
          <motion.div
            className="s-svc__dlg"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.92, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={reduce ? { duration: 0.15 } : pop}
          >
            <h2 id="s-svc-dlg-h" className="s-svc__dlg-title">
              {t.confirmTitle}
            </h2>
            <p id="s-svc-dlg-b" className="s-svc__dlg-body">
              {t.confirmBody(confirming.waiting, confirming.name)}
            </p>
            <div className="s-svc__dlg-actions">
              <button type="button" className="btn btn--quiet" onClick={() => closeDialog(false)} autoFocus>
                {t.cancel}
              </button>
              <button type="button" className="btn-press" onClick={() => closeDialog(true)}>
                {t.confirm}
              </button>
            </div>
          </motion.div>
        )}
      </dialog>
    </section>
  )
}

const groupRank = (c: Item['component']) => TRAY_ORDER.indexOf(c)

/** Most ran out first, then most still waiting, then most wanted; ties keep tray order. */
function rank(a: Item, b: Item) {
  return b.missed - a.missed || b.waiting - a.waiting || b.wanted - a.wanted || groupRank(a.component) - groupRank(b.component)
}

interface FoodListProps {
  items: Item[]
  isFree: (item: Item) => boolean
  overrides: Record<string, Override>
  sinceOf: (id: string) => string | null
  reduce: boolean
  onMakeFree: (item: Item, el: HTMLElement) => void
  onUndo: (item: Item) => void
}

function FoodList({ items, isFree, overrides, sinceOf, reduce, onMakeFree, onUndo }: FoodListProps) {
  const [open, setOpen] = useState(false)
  const listId = useId()
  const first = useSyncExternalStore(subscribePhone, isPhone, () => false) ? FIRST_PHONE : FIRST
  const sorted = useMemo(() => {
    const packed = items.filter((i) => i.wanted > 0).sort(rank)
    const nobody = items.filter((i) => i.wanted === 0).sort((a, b) => groupRank(a.component) - groupRank(b.component))
    return [...packed, ...nobody]
  }, [items])
  const scale = Math.max(1, ...items.map((i) => i.wanted))

  // Folded: the first few packed foods, plus any food that is free or was just changed here,
  // so a button never vanishes from under the person who pressed it.
  const shown = new Set<string>()
  sorted.filter((i) => i.wanted > 0).slice(0, first).forEach((i) => shown.add(i.item_id))
  sorted.forEach((i) => {
    if (isFree(i) || overrides[i.item_id]) shown.add(i.item_id)
  })
  const hidden = sorted.filter((i) => !shown.has(i.item_id))
  const visible = open ? sorted : sorted.filter((i) => shown.has(i.item_id))

  return (
    <div className="s-svc__foods">
      <p className="s-svc__caption" aria-hidden="true">
        {sc.listCaption}
      </p>
      <ul id={listId} className="s-svc__rows" aria-label={sc.listLabel}>
        {visible.map((item) => {
          const o = overrides[item.item_id]
          const free = isFree(item)
          const sending = !!o?.sending
          return (
            <ServiceRow
              key={item.item_id}
              item={item}
              scale={scale}
              isFree={free}
              sending={sending}
              since={free && !sending ? sinceOf(item.item_id) : null}
              reduce={reduce}
              onMakeFree={(el) => onMakeFree(item, el)}
              onUndo={() => onUndo(item)}
            />
          )
        })}
      </ul>
      {hidden.length > 0 && (
        <button
          type="button"
          className="s-svc__more"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((v) => !v)}
        >
          <svg className="s-svc__more-icon" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
            <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {open ? sc.showFewer : sc.showAll(hidden.length, hidden.filter((i) => i.wanted === 0).length)}
        </button>
      )}
    </div>
  )
}
