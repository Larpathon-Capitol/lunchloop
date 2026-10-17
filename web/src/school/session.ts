// The school sign-in lives in sessionStorage, so closing the tab signs you out.
// Some browsers block storage; then it lives in memory for the page.
import type { AdminLogin } from '../shared/api'

const KEY = 'lunchloop.school'

// The server sends expires_at as unix seconds (a number); the typed client calls it a string.
// Accept either and read it with expiresMs().
export type SchoolSession = Omit<Pick<AdminLogin, 'token' | 'school' | 'expires_at'>, 'expires_at'> & {
  expires_at: string | number
}

/** Expiry as milliseconds since 1970, or NaN when it can't be read. */
function expiresMs(v: string | number): number {
  if (typeof v === 'number') return v < 1e12 ? v * 1000 : v
  return /^\d+$/.test(v) ? expiresMs(Number(v)) : Date.parse(v)
}

let memory: string | null = null

function isSession(v: unknown): v is SchoolSession {
  if (!v || typeof v !== 'object') return false
  const s = v as Partial<SchoolSession>
  return (
    typeof s.token === 'string' &&
    (typeof s.expires_at === 'string' || typeof s.expires_at === 'number') &&
    !!s.school &&
    typeof s.school.school_id === 'string' &&
    typeof s.school.name === 'string'
  )
}

export function loadSession(): SchoolSession | null {
  let raw: string | null = null
  try {
    raw = sessionStorage.getItem(KEY)
  } catch {
    // storage blocked: use memory below
  }
  raw ??= memory
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isSession(parsed)) throw new Error('bad shape')
    const exp = expiresMs(parsed.expires_at)
    if (!Number.isNaN(exp) && exp <= Date.now()) throw new Error('expired')
    return parsed
  } catch {
    clearSession()
    return null
  }
}

export function saveSession(session: SchoolSession) {
  const raw = JSON.stringify({ token: session.token, school: session.school, expires_at: session.expires_at })
  memory = raw
  try {
    sessionStorage.setItem(KEY, raw)
  } catch {
    // storage blocked: the in-memory copy still works for this page
  }
}

export function clearSession() {
  memory = null
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    // nothing to clear
  }
}
