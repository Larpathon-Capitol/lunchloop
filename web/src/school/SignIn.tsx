import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { api, ApiError } from '../shared/api'
import type { School } from '../shared/api'
import { copy } from '../shared/copy'
import { LIVE_SCHOOL } from '../shared/studentSchool'
import { useApi } from '../shared/useApi'
import { ErrorNotice, Loading } from '../shared/ui/Notice'
import type { SchoolSession } from './session'

const t = copy.school.signIn

interface SignInProps {
  onSignedIn: (s: SchoolSession) => void
  expired: boolean
  /** Set for the live demo page: that one school, no picker, no demo shortcut. */
  lockedSchool?: string
}

function Frame({ title, lead, expired, children }: { title: string; lead: string; expired: boolean; children: ReactNode }) {
  return (
    <div className="s-signin">
      <h1 className="s-signin__title">{title}</h1>
      <p className="s-signin__lead">{lead}</p>
      {expired && (
        <p className="s-signin__expired" role="status">
          {t.expired}
        </p>
      )}
      {children}
    </div>
  )
}

export function SignIn({ onSignedIn, expired, lockedSchool }: SignInProps) {
  if (lockedSchool) {
    const live = copy.school.live
    return (
      <Frame title={live.title} lead={live.lead} expired={expired}>
        <Form schools={[{ school_id: lockedSchool, name: live.name, demo_password: null }]} onSignedIn={onSignedIn} />
      </Frame>
    )
  }
  return <PickerSignIn onSignedIn={onSignedIn} expired={expired} />
}

function PickerSignIn({ onSignedIn, expired }: Omit<SignInProps, 'lockedSchool'>) {
  const [schools, reloadSchools] = useApi(() => api.schools(), [])
  return (
    <Frame title={t.title} lead={t.lead} expired={expired}>
      {schools.state === 'loading' && <Loading label={t.schoolsLoading} />}
      {schools.state === 'error' && <ErrorNotice error={schools.error} onRetry={reloadSchools} />}
      {/* The live demo has its own page, so it stays out of this picker. */}
      {schools.state === 'ready' && (
        <Form schools={schools.data.schools.filter((s) => s.school_id !== LIVE_SCHOOL)} onSignedIn={onSignedIn} />
      )}
    </Frame>
  )
}

function Form({ schools, onSignedIn }: { schools: School[]; onSignedIn: (s: SchoolSession) => void }) {
  const ids = { school: useId(), password: useId(), error: useId() }
  const [schoolId, setSchoolId] = useState(schools[0]?.school_id ?? '')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const school = schools.find((s) => s.school_id === schoolId) ?? schools[0]

  // On a laptop the password field is ready to type in. On a phone, don't pop the keyboard.
  useEffect(() => {
    if (window.matchMedia('(pointer: fine)').matches) passwordRef.current?.focus()
  }, [])

  async function signIn(pw: string) {
    if (!school || busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await api.adminLogin(school.school_id, pw)
      onSignedIn({ token: res.token, school: res.school, expires_at: res.expires_at })
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError(0, String(e)))
      setBusy(false)
      passwordRef.current?.focus()
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    void signIn(password)
  }

  const wrong = error?.status === 401
  const tooMany = error?.status === 429
  const fieldMessage = wrong ? t.wrongPassword : tooMany ? t.tooMany : null
  const otherError = error && !fieldMessage ? error : null

  if (!school) return <ErrorNotice error={new ApiError(500, 'no schools')} onRetry={() => location.reload()} />

  return (
    <form className="s-form" onSubmit={onSubmit} noValidate>
      {schools.length > 1 ? (
        <div className="s-field">
          <label htmlFor={ids.school} className="s-field__label">
            {t.schoolLabel}
          </label>
          <select
            id={ids.school}
            className="s-input"
            value={schoolId}
            onChange={(e) => {
              setSchoolId(e.target.value)
              setError(null)
            }}
          >
            {schools.map((s) => (
              <option key={s.school_id} value={s.school_id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className="s-field">
          <span className="s-field__label">{t.schoolLabel}</span>
          <p className="s-field__static">{school.name}</p>
        </div>
      )}

      <div className="s-field">
        <label htmlFor={ids.password} className="s-field__label">
          {t.passwordLabel}
        </label>
        <input
          ref={passwordRef}
          id={ids.password}
          className="s-input"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={fieldMessage ? true : undefined}
          aria-describedby={fieldMessage ? ids.error : undefined}
        />
        {/* Always in the DOM, so the message is announced when it appears. */}
        <p id={ids.error} className="s-field__error" role="alert">
          {fieldMessage}
        </p>
      </div>

      <button type="submit" className="btn btn--primary s-form__submit" disabled={busy}>
        {busy ? t.submitting : t.submit}
      </button>

      {school.demo_password && (
        <div className="s-demo">
          <button
            type="button"
            className="btn btn--quiet s-form__submit"
            disabled={busy}
            onClick={() => void signIn(school.demo_password ?? '')}
          >
            {t.demoButton}
          </button>
          <p className="s-demo__note">{t.demoNote(school.demo_password)}</p>
        </div>
      )}

      {otherError && <ErrorNotice error={otherError} />}
    </form>
  )
}
