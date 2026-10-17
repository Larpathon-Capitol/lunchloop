// Lunch service for staff: who checked in after eating today's packed tray, per food how many
// got it, ran out or are still waiting, and a button per food to make its leftovers free.
import { createElement, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { api, ApiError } from '../shared/api'
import type { AdminSummary, ServiceView } from '../shared/api'
import { BrushProgress } from '../celebrate'
import { copy } from '../shared/copy'
import { free as freeCopy } from '../shared/copy/free'
import { foodGroupIcon } from '../shared/icons'
import { useReducedMotion } from '../shared/motion'
import { TRAY_ORDER } from './trayTypes'
import './service.css'

const t = freeCopy.service
const groupNames = copy.school.wants.tray.groups
const pop = { type: 'spring', stiffness: 380, damping: 22, mass: 0.8 } as const
const tap = { type: 'spring', stiffness: 600, damping: 18, mass: 0.6 } as const
const timeFmt = { hour: 'numeric', minute: '2-digit' } as const

type Item = ServiceView['items'][number]

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

function Figures({ item }: { item: Item }) {
  if (item.wanted === 0) return <p className="s-svc__figs s-svc__figs--none">{t.nobody}</p>
  return (
    <p className="s-svc__figs">
      <span>{t.wanted(item.wanted)}</span>
      <span className="s-svc__fig" data-k="got">{t.got(item.got)}</span>
      {item.missed > 0 && (
        <span className="s-svc__fig" data-k="missed">{t.ranOut(item.missed)}</span>
      )}
      {item.waiting > 0 && (
        <span className="s-svc__fig" data-k="waiting">{t.waiting(item.waiting)}</span>
      )}
    </p>
  )
}

/** got / ran out / waiting as parts of everyone who wanted this food. The figures line is its text. */
function Bar({ item }: { item: Item }) {
  const total = Math.max(1, item.wanted)
  const part = (n: number) => `${(n / total) * 100}%`
  return (
    <span className="s-svc__bar" aria-hidden="true">
      <span className="s-svc__seg" data-k="got" style={{ width: part(item.got) }} />
      <span className="s-svc__seg" data-k="missed" style={{ width: part(item.missed) }} />
      <span className="s-svc__seg" data-k="waiting" style={{ width: part(item.waiting) }} />
    </span>
  )
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

  return (
    <section className="s-svc" aria-labelledby="s-svc-h">
      <div className="s-svc__head">
        <h2 id="s-svc-h" className="s-sec-title">
          {t.heading}
        </h2>
        <p className="s-sec-sub">{t.sub}</p>
      </div>

      {!service ? (
        <p className="s-hint s-hint--empty s-svc__none">{t.none}</p>
      ) : (
        <>
          <div className="s-svc__status">
            <p className="s-svc__line">
              <strong>{t.status(service.checked_in, service.packed)}</strong> {t.outcome(service.got, service.missed)}
            </p>
            <BrushProgress
              className="s-svc__brush"
              value={service.packed > 0 ? service.checked_in / service.packed : 0}
              height={18}
              label={t.checkLabel}
            />
            <p className="s-svc__left">
              {service.packed - service.checked_in > 0 ? t.waitingCount(service.packed - service.checked_in) : t.allIn}
            </p>
          </div>

          <div className="s-svc__groups">
            {TRAY_ORDER.map((c) => {
              const items = service.items.filter((i) => i.component === c)
              if (items.length === 0) return null
              const headId = `s-svc-${c}`
              return (
                <section key={c} className="s-tg s-svc__group" data-group={c} aria-labelledby={headId}>
                  <div className="s-tg__head">
                    {createElement(foodGroupIcon(c), { className: 's-tg__icon', width: 22, height: 22 })}
                    <h3 id={headId} className="s-tg__name">
                      {groupNames[c]}
                    </h3>
                  </div>
                  <ul className="s-svc__rows">
                    {items.map((item) => {
                      const o = overrides[item.item_id]
                      const isFree = o ? o.free : item.free
                      const sending = !!o?.sending
                      const since = isFree && !sending ? sinceOf(item.item_id) : null
                      return (
                        <li key={item.item_id} className="s-svc__row" data-free={isFree || undefined}>
                          <div className="s-svc__main">
                            <div className="s-svc__title">
                              <span className="s-svc__name">{item.name}</span>
                              <AnimatePresence initial={false}>
                                {isFree && (
                                  <motion.span
                                    key="free"
                                    className="s-svc__pill"
                                    initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
                                    transition={reduce ? { duration: 0.15 } : pop}
                                  >
                                    {t.freeNow}
                                  </motion.span>
                                )}
                              </AnimatePresence>
                            </div>
                            <Figures item={item} />
                            {item.wanted > 0 && <Bar item={item} />}
                            {since && <p className="s-svc__since">{t.freeSince(since)}</p>}
                          </div>
                          <div className="s-svc__act">
                            {isFree ? (
                              <motion.button
                                type="button"
                                className="s-svc__btn s-svc__btn--end"
                                aria-label={t.endFreeLabel(item.name)}
                                disabled={sending}
                                aria-busy={sending || undefined}
                                onClick={() => void setFree(item, false)}
                                whileTap={reduce ? undefined : { scale: 0.94, transition: tap }}
                              >
                                {sending ? t.sending : t.endFree}
                              </motion.button>
                            ) : (
                              <motion.button
                                type="button"
                                className="s-svc__btn"
                                aria-label={t.makeFreeLabel(item.name)}
                                aria-haspopup={item.waiting > 0 ? 'dialog' : undefined}
                                disabled={sending}
                                aria-busy={sending || undefined}
                                onClick={(e) => ask(item, e.currentTarget)}
                                whileTap={reduce ? undefined : { scale: 0.94, transition: tap }}
                              >
                                {sending ? t.sending : t.makeFree}
                              </motion.button>
                            )}
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              )
            })}
          </div>
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
