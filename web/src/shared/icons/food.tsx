import type { CSSProperties } from 'react'
import { Icon, type IconProps } from './Icon'

/* Food groups, drawn as one family: the same 24px grid and 1.75px round stroke as every other
   icon, plus two extra layers so they read as objects instead of outlines.
   - Tint: the body is filled with --fg-tint (a soft wash of the line color by default).
   - Accent: one small detail per icon in --fg-accent (the line color by default).
   Screens set both variables per world, so the set picks up each world's colors. */

const TINT: CSSProperties = { fill: 'var(--fg-tint, color-mix(in srgb, currentColor 18%, transparent))' }
const ACCENT_FILL: CSSProperties = { fill: 'var(--fg-accent, currentColor)', stroke: 'none' }
const ACCENT_LINE: CSSProperties = { stroke: 'var(--fg-accent, currentColor)' }

/* Main dish: a covered serving dish on its tray. */
export function Entree(props: IconProps) {
  return (
    <Icon {...props}>
      <path style={TINT} d="M3.75 16.5C3.75 11.4 7.4 7.75 12 7.75s8.25 3.65 8.25 8.75z" />
      <path d="M2.5 16.5h19" />
      <path d="M5 19.75h14" />
      <path style={ACCENT_LINE} d="M7.3 13.6c.5-1.6 1.7-2.8 3.3-3.3" />
      <circle style={ACCENT_FILL} cx="12" cy="5.9" r="1.75" />
    </Icon>
  )
}

/* Grain: a slice of bread with a few seeds. */
export function Grain(props: IconProps) {
  return (
    <Icon {...props}>
      <path
        style={TINT}
        d="M6.5 11.2C4.6 10.9 3.5 9.6 3.5 8 3.5 5.3 7.3 3.5 12 3.5S20.5 5.3 20.5 8c0 1.6-1.1 2.9-3 3.2V19a1.5 1.5 0 0 1-1.5 1.5H8A1.5 1.5 0 0 1 6.5 19z"
      />
      <ellipse style={ACCENT_FILL} cx="10" cy="11.5" rx="0.9" ry="1.4" transform="rotate(-30 10 11.5)" />
      <ellipse style={ACCENT_FILL} cx="14.2" cy="13.2" rx="0.9" ry="1.4" transform="rotate(25 14.2 13.2)" />
      <ellipse style={ACCENT_FILL} cx="10.8" cy="16.4" rx="0.9" ry="1.4" transform="rotate(15 10.8 16.4)" />
    </Icon>
  )
}

/* Vegetable: a carrot with its leafy top. */
export function Vegetable(props: IconProps) {
  return (
    <Icon {...props}>
      <g transform="rotate(-32 12 12)">
        <path style={TINT} d="M7.9 8.6h8.2l-3.2 12.5a.95.95 0 0 1-1.8 0z" />
        <path style={ACCENT_LINE} d="M9.2 12.2h2.2M12.3 15.1h1.6M10.4 17.9h1.4" />
        <path d="M12 8.4V2.6M12 8l-3.1-4.3M12 8l3.1-4.3" />
      </g>
    </Icon>
  )
}

/* Fruit: an apple with a leaf and a shine. */
export function Fruit(props: IconProps) {
  return (
    <Icon {...props}>
      <path
        style={TINT}
        d="M12 8.2c-1.3-1.1-3.4-1.4-5-.4-2 1.3-2.7 4-2 6.6.9 3.4 3.3 6.1 5.3 6.1.8 0 1.1-.4 1.7-.4s.9.4 1.7.4c2 0 4.4-2.7 5.3-6.1.7-2.6 0-5.3-2-6.6-1.6-1-3.7-.7-5 .4z"
      />
      <path d="M12 8.2c0-1.8.5-3.3 1.4-4.5" />
      <path style={ACCENT_FILL} d="M13.6 5.6c.7-1.8 2.5-2.7 4.6-2.4-.5 2-2.3 3-4.6 2.4z" />
      <path d="M7.9 11.4c-.6.7-.9 1.6-.8 2.6" />
    </Icon>
  )
}

/* Milk: a gable-top carton with a drop on the front. */
export function Milk(props: IconProps) {
  return (
    <Icon {...props}>
      <path style={TINT} d="M6.5 9.5 9 5.2h6l2.5 4.3V19.5a1.5 1.5 0 0 1-1.5 1.5H8a1.5 1.5 0 0 1-1.5-1.5z" />
      <path d="M9 5.2V3h6v2.2" />
      <path d="M6.5 9.5h11" />
      <path style={ACCENT_FILL} d="M12 12.3c1.4 1.8 2.1 2.8 2.1 3.7a2.1 2.1 0 0 1-4.2 0c0-.9.7-1.9 2.1-3.7z" />
    </Icon>
  )
}
