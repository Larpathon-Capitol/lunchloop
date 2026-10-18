// One food in the Lunch service list: name and food group, a small stacked bar of
// got it / ran out / not checked in (its length is how many wanted it, against the busiest food),
// and one compact button to make its leftovers free or undo that.
import { createElement } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { ServiceView } from '../../shared/api'
import { copy } from '../../shared/copy'
import { free as freeCopy } from '../../shared/copy/free'
import { service as sc } from '../../shared/copy/service'
import { foodGroupIcon } from '../../shared/icons'

export type ServiceItem = ServiceView['items'][number]

const t = freeCopy.service
const groupNames = copy.school.wants.tray.groups
const pop = { type: 'spring', stiffness: 380, damping: 22, mass: 0.8 } as const

interface Props {
  item: ServiceItem
  /** Most students who wanted any one food today, so bars share one scale. */
  scale: number
  isFree: boolean
  sending: boolean
  since: string | null
  reduce: boolean
  onMakeFree: (el: HTMLElement) => void
  onUndo: () => void
}

export function ServiceRow({ item, scale, isFree, sending, since, reduce, onMakeFree, onUndo }: Props) {
  const nobody = item.wanted === 0
  const part = (v: number) => `${(v / Math.max(1, item.wanted)) * 100}%`

  return (
    <li className="s-svc__row" data-group={item.component} data-free={isFree || undefined} data-nobody={nobody || undefined}>
      <div className="s-svc__who">
        {createElement(foodGroupIcon(item.component), {
          className: 's-svc__icon',
          width: 18,
          height: 18,
          'aria-hidden': true,
        })}
        <span className="s-svc__name">{item.name}</span>
        <span className="s-svc__group">{groupNames[item.component]}</span>
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
              {since ? (
                <>
                  <span className="s-svc__pill-long">{sc.freeSince(since)}</span>
                  <span className="s-svc__pill-short" aria-hidden="true">
                    {sc.free}
                  </span>
                </>
              ) : (
                sc.free
              )}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <div className="s-svc__data">
        {nobody ? (
          <span className="s-svc__nobody">{sc.nobody}</span>
        ) : (
          <>
            <span className="s-svc__track" aria-hidden="true">
              <span className="s-svc__fill" style={{ width: `${(item.wanted / Math.max(1, scale)) * 100}%` }}>
                {item.got > 0 && <span className="s-svc__seg" data-k="got" style={{ width: part(item.got) }} />}
                {item.missed > 0 && <span className="s-svc__seg" data-k="missed" style={{ width: part(item.missed) }} />}
                {item.waiting > 0 && <span className="s-svc__seg" data-k="waiting" style={{ width: part(item.waiting) }} />}
              </span>
            </span>
            {/* Direct label for the bar's length: how many wanted this food. */}
            <span className="s-svc__wanted">
              {item.wanted}
              <span className="visually-hidden"> wanted,</span>
            </span>
            <span className="s-svc__figs">
              {item.missed > 0 && (
                <span className="s-svc__fig" data-k="missed">
                  {t.ranOut(item.missed)}
                </span>
              )}
              {item.got > 0 && (
                <span className="s-svc__fig" data-k="got">
                  {t.got(item.got)}
                </span>
              )}
              {item.waiting > 0 && (
                <span className="s-svc__fig" data-k="waiting">
                  {t.waiting(item.waiting)}
                </span>
              )}
            </span>
          </>
        )}
      </div>

      <div className="s-svc__act">
        {/* One button that flips between the two jobs, so focus stays put after a press. */}
        <button
          type="button"
          className={isFree ? 's-svc__chip s-svc__chip--undo' : 's-svc__chip'}
          aria-label={isFree ? t.endFreeLabel(item.name) : t.makeFreeLabel(item.name)}
          aria-haspopup={!isFree && item.waiting > 0 ? 'dialog' : undefined}
          // aria-disabled instead of disabled, so the button keeps focus while it saves.
          aria-disabled={sending || undefined}
          aria-busy={sending || undefined}
          onClick={(e) => {
            if (sending) return
            if (isFree) onUndo()
            else onMakeFree(e.currentTarget)
          }}
        >
          {!isFree && !sending && (
            <svg className="s-svc__chip-icon" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <path
                d="M2.5 6.5h11v2h-11zM3.5 8.5h9v5.5h-9zM8 6.5v7.5M8 6.5C6.5 6.5 4.6 5.9 4.9 4.3 5.3 2.6 7.4 3.6 8 6.5zM8 6.5c1.5 0 3.4-.6 3.1-2.2C10.7 2.6 8.6 3.6 8 6.5z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
            </svg>
          )}
          {sending ? t.sending : isFree ? sc.undo : sc.makeFree}
        </button>
      </div>
    </li>
  )
}
