import type { ApiError } from '../api'
import { copy } from '../copy'

/** Loading and error states that say something useful instead of a blank box. */
export function Loading({ label = copy.loading }: { label?: string }) {
  return (
    <div className="notice" role="status" aria-live="polite">
      <p className="notice__text">{label}</p>
    </div>
  )
}

// A server message is only shown when it already reads like a sentence.
const PLAIN_SENTENCE = /^[A-Z][^<>{}[\]_]{2,139}[.!?]$/

function errorText(error: ApiError): string {
  if (error.status === 0) return copy.errors.unreachable
  if (error.status >= 500) return copy.errors.generic
  return PLAIN_SENTENCE.test(error.message) ? error.message : copy.errors.generic
}

export function ErrorNotice({ error, onRetry }: { error: ApiError; onRetry?: () => void }) {
  const text = errorText(error)
  return (
    <div className="notice" role="alert">
      <p>{text}</p>
      {onRetry && (
        <button className="btn btn--quiet" onClick={onRetry}>
          {copy.errors.retry}
        </button>
      )}
    </div>
  )
}
