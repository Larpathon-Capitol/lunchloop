import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import QRCode from 'qrcode'
import { copy } from '../shared/copy'
import { DemoBar } from '../shared/ui/DemoBar'
import './hub.css'

const t = copy.hub

/** Absolute link, so it still works when copied to a phone or a chat. */
function absolute(path: string) {
  return `${window.location.origin}${import.meta.env.BASE_URL}${path}`
}

/** The link without the protocol: what a person would read aloud or type. */
function short(url: string) {
  return url.replace(/^https?:\/\//, '')
}

interface Page {
  key: keyof typeof t.pages
  path: string
  password?: string
  passwordNote?: string
  /** Who the page is for, shown as a tag so student and staff views never blur together. */
  audience: 'student' | 'staff'
}

const SIMULATED: Page[] = [
  { key: 'student', path: 'student', audience: 'student' },
  { key: 'school', path: 'school', password: t.pages.school.password, audience: 'staff' },
  { key: 'kitchen', path: 'school/kitchen', passwordNote: t.pages.kitchen.passwordNote, audience: 'staff' },
  { key: 'backstage', path: 'behind-the-scenes/simulated', audience: 'staff' },
]

const LIVE: Page[] = [
  { key: 'live', path: 'live', audience: 'student' },
  { key: 'liveAdmin', path: 'live/admin', passwordNote: t.pages.liveAdmin.passwordNote, audience: 'staff' },
  { key: 'backstageLive', path: 'behind-the-scenes/live', audience: 'staff' },
]

/** The QR code drawn from its own modules, filled with token colors, so nothing is injected as markup. */
function Qr({ text, className }: { text: string; className?: string }) {
  const { size, d } = useMemo(() => {
    const { modules } = QRCode.create(text, { errorCorrectionLevel: 'M' })
    let path = ''
    for (let y = 0; y < modules.size; y++) {
      let x = 0
      while (x < modules.size) {
        if (!modules.data[y * modules.size + x]) {
          x++
          continue
        }
        const start = x
        while (x < modules.size && modules.data[y * modules.size + x]) x++
        path += `M${start} ${y}h${x - start}v1h-${x - start}z`
      }
    }
    return { size: modules.size, d: path }
  }, [text])
  const quiet = 4
  const box = size + quiet * 2
  return (
    <svg
      className={className}
      viewBox={`0 0 ${box} ${box}`}
      role="img"
      aria-label={t.qr.label}
      data-url={text}
      shapeRendering="crispEdges"
    >
      <rect width={box} height={box} fill="var(--shoji)" />
      <path d={d} transform={`translate(${quiet} ${quiet})`} fill="var(--sumi)" />
    </svg>
  )
}

function CopyButton({ url }: { url: string }) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])

  async function copyIt() {
    clearTimeout(timer.current)
    try {
      await navigator.clipboard.writeText(url)
      setStatus('copied')
    } catch {
      setStatus('failed')
    }
    timer.current = setTimeout(() => setStatus('idle'), 2400)
  }

  return (
    <>
      <button type="button" className="btn btn--quiet hub-row__btn" onClick={() => void copyIt()}>
        {status === 'copied' ? t.copied : status === 'failed' ? t.copyFailed : t.copy}
      </button>
      <span className="visually-hidden" role="status">
        {status === 'copied' ? t.copied : status === 'failed' ? t.copyFailed : ''}
      </span>
    </>
  )
}

/** The code, full screen, for a projector. A native modal dialog gives Escape, a focus trap and an inert page. */
function QrOverlay({ url, dialogRef }: { url: string; dialogRef: React.RefObject<HTMLDialogElement | null> }) {
  return (
    <dialog ref={dialogRef} className="hub-full" aria-label={t.qr.dialogLabel}>
      <button type="button" className="btn btn--quiet hub-full__close" onClick={() => dialogRef.current?.close()}>
        {t.qr.close}
      </button>
      <div className="hub-full__body">
        <Qr text={url} className="hub-full__qr" />
        <p className="hub-full__url" aria-label={t.qr.urlLabel}>
          {short(url)}
        </p>
      </div>
    </dialog>
  )
}

function PageRow({ p, onFullScreen }: { p: Page; onFullScreen: () => void }) {
  const page = t.pages[p.key]
  const url = absolute(p.path)
  return (
    <li className="hub-row">
      <div className="hub-row__text">
        <h3 className="hub-row__name">
          {page.name}
          <span className={`hub-row__for hub-row__for--${p.audience}`}>{t.audience[p.audience]}</span>
        </h3>
        <p className="hub-row__line">{page.line}</p>
        <p className="hub-row__url">{short(url)}</p>
        {p.password ? (
          <p className="hub-row__pw">
            {t.passwordLabel}: <span className="hub-row__pw-value">{p.password}</span>
          </p>
        ) : (
          p.passwordNote && <p className="hub-row__pw">{p.passwordNote}</p>
        )}
      </div>
      <div className="hub-row__actions">
        <Link to={`/${p.path}`} className="btn btn--quiet hub-row__btn">
          {t.open}
        </Link>
        <CopyButton url={url} />
      </div>
      {p.key === 'live' && (
        <div className="hub-qr">
          <Qr text={url} className="hub-qr__code" />
          <div className="hub-qr__side">
            <p className="hub-qr__heading">{t.qr.heading}</p>
            <p className="hub-qr__url">{short(url)}</p>
            <button type="button" className="btn btn--primary" onClick={onFullScreen}>
              {t.qr.fullScreen}
            </button>
          </div>
        </div>
      )}
    </li>
  )
}

/** The dashboard: the simulated school (with presenter controls) and the live one, as two separate groups. */
export function Hub() {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const liveUrl = absolute('live')
  const full = () => dialogRef.current?.showModal()

  return (
    <div className="hub">
      <header className="hub__head">
        <h1 className="hub__title">{t.title}</h1>
        <p className="hub__lead">{t.lead}</p>
      </header>

      <section className="hub-group hub-group--sim" aria-labelledby="hub-sim-h">
        <div className="hub-group__head">
          <h2 id="hub-sim-h" className="hub-group__title">
            {t.groups.simulated.heading}
          </h2>
          <p className="hub-group__line">{t.groups.simulated.line}</p>
        </div>
        <DemoBar />
        <ul className="hub__list" aria-label={t.groups.simulated.heading}>
          {SIMULATED.map((p) => (
            <PageRow key={p.key} p={p} onFullScreen={full} />
          ))}
        </ul>
      </section>

      <section className="hub-group hub-group--live" aria-labelledby="hub-live-h">
        <div className="hub-group__head">
          <h2 id="hub-live-h" className="hub-group__title">
            <span className="hub-group__pulse" aria-hidden="true" />
            {t.groups.live.heading}
          </h2>
          <p className="hub-group__line">{t.groups.live.line}</p>
        </div>
        <ul className="hub__list" aria-label={t.groups.live.heading}>
          {LIVE.map((p) => (
            <PageRow key={p.key} p={p} onFullScreen={full} />
          ))}
        </ul>
      </section>

      <QrOverlay url={liveUrl} dialogRef={dialogRef} />
    </div>
  )
}
