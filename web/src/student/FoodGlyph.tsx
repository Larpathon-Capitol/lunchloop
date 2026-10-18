// Small drawings of the cafeteria menu, one per item, in the same system as the food group
// icons: one stroke weight, the body washed with --fg-tint (a soft wash of the line color).
import type { CSSProperties, ReactNode } from 'react'

const TINT: CSSProperties = { fill: 'var(--fg-tint, color-mix(in srgb, currentColor 18%, transparent))' }

const G: Record<string, ReactNode> = {
  cheese_pizza: (
    <>
      <path style={TINT} d="M4 6.5C9 4 15 4 20 6.5L12 21z" />
      <path d="M5.3 9C9.5 7.2 14.5 7.2 18.7 9" />
      <circle cx="10" cy="11.5" r="1.1" />
      <circle cx="14" cy="12" r="1.1" />
      <circle cx="12" cy="15.5" r="1.1" />
    </>
  ),
  beef_nachos: (
    <>
      <path style={TINT} d="M2.4 11.2 7.6 2.8l4 8.9z" />
      <path style={TINT} d="M13.4 10 19 2.6l2.7 8.6z" />
      <path style={TINT} d="M2.8 21.2 10.6 12.6 21.2 20z" />
      <path style={TINT} d="M6.4 17.2 10.6 12.6l4.6 3.2c-.4 1.3-.8 2.6-2 2.4-.9-.1-.9 1.5-2 1.5-1.4 0-1-2-2.3-2-.9 0-1 1.6-2.1 1.2-1-.5-.4-1.7-.4-1.7z" />
    </>
  ),
  chicken_nuggets: (
    <>
      <path style={TINT} d="M4 11c.6-3 4.6-4 7-2.5 2.2 1.4 2.4 4.6.4 6.4-2.2 2-6.2 1.8-7.2-.6-.4-1-.4-2.2-.2-3.3z" />
      <path style={TINT} d="M13.5 15.5c.8-2.4 4-3.3 5.8-1.9 1.6 1.3 1.4 4-.4 5.2-1.9 1.3-4.7.8-5.4-1.1-.2-.7-.2-1.5 0-2.2z" />
      <path d="M7 11.5h.01M9.5 10.5h.01M16.5 16h.01" />
    </>
  ),
  cheeseburger: (
    <>
      <path style={TINT} d="M4 11c0-3.9 3.6-6 8-6s8 2.1 8 6z" />
      <path d="M9 8h.01M12 7h.01M15 8h.01" />
      <path d="M3.5 13.5h17" />
      <path d="M6 13.5l2.5 2.2 2.5-2.2" />
      <path d="M4.5 16.5h15v1.2a2.3 2.3 0 0 1-2.3 2.3H6.8a2.3 2.3 0 0 1-2.3-2.3z" />
    </>
  ),
  popcorn_chicken: (
    <>
      <path style={TINT} d="M5.5 10.5 7 20h10l1.5-9.5z" />
      <path d="M10 10.5 10.5 20M14 10.5 13.5 20" />
      <circle cx="8.3" cy="7.8" r="1.8" />
      <circle cx="12" cy="6.2" r="1.8" />
      <circle cx="15.7" cy="7.8" r="1.8" />
    </>
  ),
  spicy_chicken_sandwich: (
    <>
      <path style={TINT} d="M2.5 10.5c0-2 4.3-3.5 9.5-3.5s9.5 1.5 9.5 3.5z" />
      <path d="M2.5 13c1.5 1 3 1 4.5 0s3-1 4.5 0 3 1 4.5 0 3-1 4.5 0" />
      <path d="M3 15.5h18l-1 2.5H4z" />
      <path d="M17 4.5c1.2-.9 2.6-.7 3.2.3" />
    </>
  ),
  dinner_roll: (
    <>
      <path style={TINT} d="M4 15c0-4.5 3.6-8 8-8s8 3.5 8 8v1a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
      <path d="M9 9.8l1.3 2.7M13.3 9l.9 2.8" />
    </>
  ),
  brown_rice: (
    <>
      <path style={TINT} d="M3.5 12h17a8.5 8.5 0 0 1-17 0z" />
      <path d="M6.5 12c1-2.6 3.2-4 5.5-4s4.5 1.4 5.5 4" />
      <path d="M10 10h.01M13 9.5h.01M14.5 11h.01M11.5 11.2h.01" />
    </>
  ),
  steamed_carrots: (
    <>
      <path style={TINT} d="M14.8 9.2 4.6 19.4c-.3.3 0 .8.4.6l11.8-6a3.2 3.2 0 0 0-2-4.8z" />
      <path d="M16 8.2 18 4M17.2 9.6l3.8-1.4M15 7.5l-.6-3.5" />
      <path d="M9.5 15.5l1.2 1.2M12 13l1.2 1.2" />
    </>
  ),
  broccoli: (
    <>
      <path style={TINT} d="M8 12.5a3 3 0 0 1 .3-6 4 4 0 0 1 7.4 0 3 3 0 0 1 .3 6z" />
      <path d="M10.5 12.5V20h3v-7.5" />
    </>
  ),
  fruit_cup: (
    <>
      <path style={TINT} d="M5 10h14l-1.6 10H6.6z" />
      <path d="M7.5 10a2.2 2.2 0 0 1 4.4 0M12 10a2.7 2.7 0 0 1 5.4 0" />
      <path d="M8 14.5h8" />
    </>
  ),
  mandarin_oranges: (
    <>
      <circle style={TINT} cx="12" cy="13.5" r="7" />
      <path d="M12 6.5c0-2 1.5-3 3.5-3 0 2-1.5 3-3.5 3z" />
      <path d="M12 9.5v8M8.5 11.5l7 4M15.5 11.5l-7 4" />
    </>
  ),
  chocolate_milk: (
    <>
      <path style={TINT} d="M7 8.5 9 4h6l2 4.5V20H7z" />
      <path d="M7 8.5h10" />
      <path d="M12 11.5c1.4 1.9 2 2.9 2 3.9a2 2 0 0 1-4 0c0-1 .6-2 2-3.9z" />
    </>
  ),
  milk_1pct: (
    <>
      <path style={TINT} d="M7 8.5 9 4h6l2 4.5V20H7z" />
      <path d="M7 8.5h10" />
      <path d="M9.5 13h5M9.5 15.5h3" />
    </>
  ),
}

const BOWL = (
  <>
    <path style={TINT} d="M3 12h18a9 9 0 0 1-18 0z" />
    <path d="M9.5 21h5" />
    <path d="M7.5 12c.3-2.7 2.2-4.2 4.5-4.2s4.2 1.5 4.5 4.2" />
    <path d="M13.5 7 19.5 3M16.5 8.5l4.2-3.2" />
  </>
)
const WRAP = (
  <>
    <path style={TINT} d="M5.2 15.6 14.6 6.2a3.4 3.4 0 0 1 4.8 4.8L10 20.4a3.4 3.4 0 0 1-4.8-4.8z" />
    <path d="M14.6 6.2c1.3 1.3 1.3 3.5 0 4.8M17 13.4 12.6 9M11.2 16.8l-2-2" />
    <path d="M15.8 4.6l1-1.6M19.4 8.2l1.6-1" />
  </>
)
const CARTON_PLAIN = (
  <>
    <path style={TINT} d="M7 8.5 9 4h6l2 4.5V20H7z" />
    <path d="M7 8.5h10" />
    <path d="M9.5 13h5" />
  </>
)
const EXTRA: Record<string, ReactNode> = {
  orange_chicken: BOWL,
  teriyaki_tofu_bowl: BOWL,
  chickpea_curry_rice: BOWL,
  bean_cheese_burrito: WRAP,
  falafel_wrap: WRAP,
  chicken_shawarma_wrap: WRAP,
  milk_fat_free: CARTON_PLAIN,
  veggie_burger: G.cheeseburger,
  black_bean_quesadilla: (
    <>
      <path style={TINT} d="M3.5 16.5a8.5 8.5 0 0 1 17 0z" />
      <path d="M3.5 16.5h17" />
      <path d="M8 13.2h.01M12 11.5h.01M15.8 13.2h.01" />
      <path d="M6.5 19.5h11" />
    </>
  ),
  whole_wheat_tortilla: (
    <>
      <ellipse style={TINT} cx="12" cy="11" rx="8.5" ry="4.5" />
      <path d="M3.5 11v2.5c0 2.5 3.8 4.5 8.5 4.5s8.5-2 8.5-4.5V11" />
      <path d="M9 10h.01M13.5 9.5h.01M15 11.8h.01" />
    </>
  ),
  whole_wheat_pita: (
    <>
      <path style={TINT} d="M3.5 15.5a8.5 8.5 0 0 1 17 0v1a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5z" />
      <path d="M6.5 15.5a5.5 5.5 0 0 1 11 0" />
    </>
  ),
  side_salad: (
    <>
      <path style={TINT} d="M3 12h18a9 9 0 0 1-18 0z" />
      <path d="M6.5 12c-.5-2.6.8-4.6 3.3-5 .4 2.4-.8 4.2-3.3 5zM10.5 12c.2-3 2.3-5 5.2-5 0 2.9-2.1 4.8-5.2 5zM15.5 12c.9-1.9 2.7-2.8 4.6-2.4" />
      <path d="M9.5 21h5" />
    </>
  ),
  black_beans: (
    <>
      <path style={TINT} d="M3 12h18a9 9 0 0 1-18 0z" />
      <ellipse cx="8.5" cy="9.8" rx="1.6" ry="1.1" />
      <ellipse cx="12.2" cy="8.6" rx="1.6" ry="1.1" />
      <ellipse cx="15.7" cy="9.9" rx="1.6" ry="1.1" />
      <path d="M9.5 21h5" />
    </>
  ),
  seasoned_corn: (
    <g transform="rotate(35 12 12)">
      <path style={TINT} d="M12 2.5c2.4 0 3.7 3.2 3.7 7.8S14.4 19 12 19s-3.7-4.1-3.7-8.7S9.6 2.5 12 2.5z" />
      <path d="M8.5 8h7M8.4 11.5h7.2M9 15h6M12 3v15.5" />
      <path d="M12 21.5c-2.7-.3-4.6-2.6-4.8-6.4M12 21.5c2.7-.3 4.6-2.6 4.8-6.4" />
    </g>
  ),
  apple_slices: (
    <>
      <path style={TINT} d="M12 8.2c-1.3-1.1-3.4-1.4-5-.4-2 1.3-2.7 4-2 6.6.9 3.4 3.3 6.1 5.3 6.1.8 0 1.1-.4 1.7-.4s.9.4 1.7.4c2 0 4.4-2.7 5.3-6.1.7-2.6 0-5.3-2-6.6-1.6-1-3.7-.7-5 .4z" />
      <path d="M12 8.2c0-1.8.5-3.3 1.4-4.5" />
      <path d="M12 8.2v12.1" />
    </>
  ),
  banana: (
    <>
      <path style={TINT} d="M5 6.5c-.6 6.4 3.6 12 10.5 12.5 2.2.2 4.1-.5 5-1.6-6.3-.6-10.4-5-11.3-11.4z" />
      <path d="M5 6.5 4.6 4.2M5 6.5l3.6-.3" />
      <path d="M8 9.5c1 3.6 3.6 6.4 7 7.6" />
    </>
  ),
}

const PLATE = (
  <>
    <circle style={TINT} cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="5" />
  </>
)

/** Sized by CSS (.food-glyph, .food-glyph--lg). */
export function FoodGlyph({ id, large = false }: { id: string; large?: boolean }) {
  return (
    <svg
      className={large ? 'food-glyph food-glyph--lg' : 'food-glyph'}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {G[id] ?? EXTRA[id] ?? PLATE}
    </svg>
  )
}
