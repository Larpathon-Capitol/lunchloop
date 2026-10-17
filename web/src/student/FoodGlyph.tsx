// Small line drawings of the cafeteria menu, one per item, drawn in one stroke weight.
import type { ReactNode } from 'react'

const G: Record<string, ReactNode> = {
  cheese_pizza: (
    <>
      <path d="M4 6.5C9 4 15 4 20 6.5L12 21z" />
      <path d="M5.3 9C9.5 7.2 14.5 7.2 18.7 9" />
      <circle cx="10" cy="11.5" r="1.1" />
      <circle cx="14" cy="12" r="1.1" />
      <circle cx="12" cy="15.5" r="1.1" />
    </>
  ),
  beef_nachos: (
    <>
      <path d="M3.5 18 8 8.5l4 9.5" />
      <path d="M10 18l5-10.5L20.5 18" />
      <path d="M6 14.5c1.2.8 2.3.8 3.5 0M13 13.5c1.3.9 2.7.9 4 0" />
      <path d="M2.5 20.5h19" />
    </>
  ),
  chicken_nuggets: (
    <>
      <path d="M4 11c.6-3 4.6-4 7-2.5 2.2 1.4 2.4 4.6.4 6.4-2.2 2-6.2 1.8-7.2-.6-.4-1-.4-2.2-.2-3.3z" />
      <path d="M13.5 15.5c.8-2.4 4-3.3 5.8-1.9 1.6 1.3 1.4 4-.4 5.2-1.9 1.3-4.7.8-5.4-1.1-.2-.7-.2-1.5 0-2.2z" />
      <path d="M7 11.5h.01M9.5 10.5h.01M16.5 16h.01" />
    </>
  ),
  cheeseburger: (
    <>
      <path d="M4 11c0-3.9 3.6-6 8-6s8 2.1 8 6z" />
      <path d="M9 8h.01M12 7h.01M15 8h.01" />
      <path d="M3.5 13.5h17" />
      <path d="M6 13.5l2.5 2.2 2.5-2.2" />
      <path d="M4.5 16.5h15v1.2a2.3 2.3 0 0 1-2.3 2.3H6.8a2.3 2.3 0 0 1-2.3-2.3z" />
    </>
  ),
  popcorn_chicken: (
    <>
      <path d="M5.5 10.5 7 20h10l1.5-9.5z" />
      <path d="M10 10.5 10.5 20M14 10.5 13.5 20" />
      <circle cx="8.3" cy="7.8" r="1.8" />
      <circle cx="12" cy="6.2" r="1.8" />
      <circle cx="15.7" cy="7.8" r="1.8" />
    </>
  ),
  spicy_chicken_sandwich: (
    <>
      <path d="M2.5 10.5c0-2 4.3-3.5 9.5-3.5s9.5 1.5 9.5 3.5z" />
      <path d="M2.5 13c1.5 1 3 1 4.5 0s3-1 4.5 0 3 1 4.5 0 3-1 4.5 0" />
      <path d="M3 15.5h18l-1 2.5H4z" />
      <path d="M17 4.5c1.2-.9 2.6-.7 3.2.3" />
    </>
  ),
  dinner_roll: (
    <>
      <path d="M4 15c0-4.5 3.6-8 8-8s8 3.5 8 8v1a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
      <path d="M9 9.8l1.3 2.7M13.3 9l.9 2.8" />
    </>
  ),
  brown_rice: (
    <>
      <path d="M3.5 12h17a8.5 8.5 0 0 1-17 0z" />
      <path d="M6.5 12c1-2.6 3.2-4 5.5-4s4.5 1.4 5.5 4" />
      <path d="M10 10h.01M13 9.5h.01M14.5 11h.01M11.5 11.2h.01" />
    </>
  ),
  steamed_carrots: (
    <>
      <path d="M14.8 9.2 4.6 19.4c-.3.3 0 .8.4.6l11.8-6a3.2 3.2 0 0 0-2-4.8z" />
      <path d="M16 8.2 18 4M17.2 9.6l3.8-1.4M15 7.5l-.6-3.5" />
      <path d="M9.5 15.5l1.2 1.2M12 13l1.2 1.2" />
    </>
  ),
  broccoli: (
    <>
      <path d="M8 12.5a3 3 0 0 1 .3-6 4 4 0 0 1 7.4 0 3 3 0 0 1 .3 6z" />
      <path d="M10.5 12.5V20h3v-7.5" />
    </>
  ),
  fruit_cup: (
    <>
      <path d="M5 10h14l-1.6 10H6.6z" />
      <path d="M7.5 10a2.2 2.2 0 0 1 4.4 0M12 10a2.7 2.7 0 0 1 5.4 0" />
      <path d="M8 14.5h8" />
    </>
  ),
  mandarin_oranges: (
    <>
      <circle cx="12" cy="13.5" r="7" />
      <path d="M12 6.5c0-2 1.5-3 3.5-3 0 2-1.5 3-3.5 3z" />
      <path d="M12 9.5v8M8.5 11.5l7 4M15.5 11.5l-7 4" />
    </>
  ),
  chocolate_milk: (
    <>
      <path d="M7 8.5 9 4h6l2 4.5V20H7z" />
      <path d="M7 8.5h10" />
      <path d="M12 11.5c1.4 1.9 2 2.9 2 3.9a2 2 0 0 1-4 0c0-1 .6-2 2-3.9z" />
    </>
  ),
  milk_1pct: (
    <>
      <path d="M7 8.5 9 4h6l2 4.5V20H7z" />
      <path d="M7 8.5h10" />
      <path d="M9.5 13h5M9.5 15.5h3" />
    </>
  ),
}

const PLATE = (
  <>
    <circle cx="12" cy="12" r="8.5" />
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
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {G[id] ?? PLATE}
    </svg>
  )
}
