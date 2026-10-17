// A random, anonymous ID for this browser. No names or emails, ever.
const KEY = 'lunchloop.device'

// Some browsers (iOS "Block All Cookies", in-app browsers, private modes) throw
// on any localStorage access. These helpers fall back to memory for the session.
const memory = new Map<string, string>()

export function storeGet(key: string): string | null {
  try {
    const value = localStorage.getItem(key)
    if (value !== null) return value
  } catch {
    // storage blocked: use memory below
  }
  return memory.get(key) ?? null
}

export function storeSet(key: string, value: string) {
  memory.set(key, value)
  try {
    localStorage.setItem(key, value)
  } catch {
    // storage blocked: the in-memory copy still works for this session
  }
}

const ID_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

function randomId(): string {
  // randomUUID only exists in secure contexts (https or localhost).
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  let id = ''
  for (let i = 0; i < 32; i++) id += ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)]
  return id
}

/** A server-signed id ("<id>.<signature>"); older browsers still hold a plain one until they upgrade. */
export const SIGNED_DEVICE = /^[A-Za-z0-9-]{8,64}\.[0-9a-f]{16}$/

export function deviceId(): string {
  let id = storeGet(KEY)
  if (!id || !(/^[A-Za-z0-9-]{8,64}$/.test(id) || SIGNED_DEVICE.test(id))) {
    id = randomId()
    storeSet(KEY, id)
  }
  return id
}

/** Swap in the signed id the server issued for this browser. */
export function saveDeviceId(id: string) {
  storeSet(KEY, id)
}
