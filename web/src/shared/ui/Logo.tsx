import { LogoMark } from './brand/LogoMark'
import './brand/brand.css'

export { LogoMark }

/**
 * The full logo: the mark plus the wordmark. The wordmark is set in the current world's display
 * face (staff pages swap that for the UI face), with "Loop" in the mark's second color.
 * It is real text, so a parent link reads "LunchLoop".
 * size: "hero" sits straight on the hero art, "bar" is for the game and staff headers.
 */
export function Logo({ size = 'bar' }: { size?: 'hero' | 'bar' }) {
  return (
    <span className={`ll-logo ll-logo--${size}`}>
      <LogoMark className="ll-logo__mark" size={size === 'hero' ? 44 : 32} />
      <span className="ll-logo__word">
        Lunch<span className="ll-logo__loop">Loop</span>
      </span>
    </span>
  )
}
