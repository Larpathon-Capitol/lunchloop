import { useEffect, useRef, useState } from 'react'
import { copy } from '../../shared/copy'
import { DEMO_SCHOOL, LIVE_SCHOOL } from '../../shared/studentSchool'

const t = copy.school.wants

function studentLink(schoolId: string) {
  const base = `${window.location.origin}${import.meta.env.BASE_URL}`
  if (schoolId === LIVE_SCHOOL) return `${base}live`
  const query = schoolId === DEMO_SCHOOL ? '' : `?school=${encodeURIComponent(schoolId)}`
  return `${base}student${query}`
}

/** "Copy student link", with a select-it-yourself fallback when the clipboard is blocked. */
export function CopyLink({ schoolId, primary = false }: { schoolId: string; primary?: boolean }) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const link = studentLink(schoolId)
  useEffect(() => () => clearTimeout(timer.current), [])

  async function copyIt() {
    clearTimeout(timer.current)
    try {
      await navigator.clipboard.writeText(link)
      setStatus('copied')
      timer.current = setTimeout(() => setStatus('idle'), 2400)
    } catch {
      setStatus('failed')
    }
  }

  return (
    <div className="s-copy">
      <button
        type="button"
        className={primary ? 'btn btn--primary s-copy__btn' : 'btn btn--quiet s-copy__btn'}
        onClick={() => void copyIt()}
      >
        {status === 'copied' ? t.copied : t.copyLink}
      </button>
      <span className="visually-hidden" role="status">
        {status === 'copied' ? t.copied : ''}
      </span>
      {status === 'failed' && (
        <>
          <p className="s-copy__note">{t.copyFailed}</p>
          <input
            className="s-input s-copy__link"
            readOnly
            value={link}
            aria-label={t.linkLabel}
            onFocus={(e) => e.currentTarget.select()}
          />
        </>
      )}
    </div>
  )
}
