// The school sign-in lives in sessionStorage, so closing the tab signs you out.
// Some browsers block storage; then it lives in memory for the page.
import type { AdminLogin } from '../shared/api'

// One sign-in per school, so the demo school and the live school never overwrite each other.
const PREFIX = 'lunchloop.school.'
const keyFor = (schoolId: string) => `${PREFIX}${schoolId}`

// The server sends expires_at as an ISO time (older builds sent unix seconds). Accept either
// and read it with expiresMs().
export type SchoolSession = Omit<Pick<AdminLogin, 'token' | 'school' | 'expires_at'>, 'expires_at'> & {
  expires_at: string | number
}

/** Expiry as milliseconds since 1970, or NaN when it can't be read. */
function expiresMs(v: string | number): number {
  if (typeof v === 'number') return v < 1e12 ? v * 1000 : v
  return /^\d+$/.test(v) ? expiresMs(Number(v)) : Date.parse(v)
}

const memory = new Map<string, string>()

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

export function loadSession(schoolId: string): SchoolSession | null {
  let raw: string | null = null
  try {
    raw = sessionStorage.getItem(keyFor(schoolId))
  } catch {
    // storage blocked: use memory below
  }
  raw ??= memory.get(schoolId) ?? null
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isSession(parsed)) throw new Error('bad shape')
    const exp = expiresMs(parsed.expires_at)
    if (!Number.isNaN(exp) && exp <= Date.now()) throw new Error('expired')
    return parsed
  } catch {
    clearSession(schoolId)
    return null
  }
}

export function saveSession(session: SchoolSession) {
  const raw = JSON.stringify({ token: session.token, school: session.school, expires_at: session.expires_at })
  const id = session.school.school_id
  memory.set(id, raw)
  try {
    sessionStorage.setItem(keyFor(id), raw)
  } catch {
    // storage blocked: the in-memory copy still works for this page
  }
}

export function clearSession(schoolId: string) {
  memory.delete(schoolId)
  try {
    sessionStorage.removeItem(keyFor(schoolId))
  } catch {
    // nothing to clear
  }
}

/** The first stored sign-in for any school except the ones listed (used by the school picker page). */
export function loadAnySession(except: string[] = []): SchoolSession | null {
  const ids = new Set(memory.keys())
  try {
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i)
      if (k?.startsWith(PREFIX)) ids.add(k.slice(PREFIX.length))
    }
  } catch {
    // storage blocked: memory only
  }
  for (const id of ids) {
    if (except.includes(id)) continue
    const s = loadSession(id)
    if (s) return s
  }
  return null
}
