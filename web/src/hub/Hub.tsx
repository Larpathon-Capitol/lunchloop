import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import QRCode from 'qrcode'
import { copy } from '../shared/copy'
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
}

const PAGES: Page[] = [
  { key: 'student', path: 'student' },
  { key: 'school', path: 'school', password: t.pages.school.password },
  { key: 'live', path: 'live' },
  { key: 'liveAdmin', path: 'live/admin', passwordNote: t.pages.liveAdmin.passwordNote },
  { key: 'backstage', path: 'behind-the-scenes' },
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
      <rect width={box} height={box} fill="var(--surface)" />
      <path d={d} transform={`translate(${quiet} ${quiet})`} fill="var(--ink)" />
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

export function Hub() {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const liveUrl = absolute('live')

  return (
    <div className="hub">
      <header className="hub__head">
        <h1 className="hub__title">{t.title}</h1>
        <p className="hub__lead">{t.lead}</p>
        <p className="hub__note">{t.noteSimulated}</p>
      </header>

      <ul className="hub__list" aria-label={t.listLabel}>
        {PAGES.map((p) => {
          const page = t.pages[p.key]
          const url = absolute(p.path)
          return (
            <li key={p.key} className="hub-row">
              <div className="hub-row__text">
                <h2 className="hub-row__name">{page.name}</h2>
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
                  <Qr text={liveUrl} className="hub-qr__code" />
                  <div className="hub-qr__side">
                    <p className="hub-qr__heading">{t.qr.heading}</p>
                    <p className="hub-qr__url">{short(liveUrl)}</p>
                    <button type="button" className="btn btn--primary" onClick={() => dialogRef.current?.showModal()}>
                      {t.qr.fullScreen}
                    </button>
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ul>
      <QrOverlay url={liveUrl} dialogRef={dialogRef} />
    </div>
  )
}
