/**
 * Die-cut food stickers for the home hero.
 *
 * Eight foods drawn as inline SVG in one shared style: a flat illustration,
 * a thick white vinyl border that follows the shape, and a soft contact
 * shadow under it. No SVG filters and no gradients, so they stay cheap on
 * phones. Colors are plain hex on purpose, so the stickers look the same in
 * every world theme. The hero lays them out and moves them; this file only draws.
 */
import { useId, type JSX, type ReactNode } from 'react'

export type StickerId =
  | 'apple'
  | 'milk'
  | 'taco'
  | 'rice'
  | 'broccoli'
  | 'orange'
  | 'sandwich'
  | 'carrot'

// oxlint-disable-next-line react/only-export-components
export const STICKER_IDS: readonly StickerId[] = [
  'apple',
  'milk',
  'taco',
  'rice',
  'broccoli',
  'orange',
  'sandwich',
  'carrot',
]

export interface StickerProps {
  /** Which food to draw. */
  id: StickerId
  /** Rendered width in CSS px. The drawing is square, so height matches. */
  size: number
  /** Optional class for the outer svg (position, animation, and so on). */
  className?: string
}

// Palette.
const INK = '#3A1626'
const PINK_1 = '#FFE5EC'
const PINK_2 = '#FFC2D1'
const PINK_4 = '#FF8FAB'
const PINK_5 = '#FB6F92'
const LEAF = '#5FB77A'
const LEAF_MID = '#3E9A5F'
const LEAF_DEEP = '#1F5A3A'
const YELLOW = '#FFC72C'
const TORTILLA = '#F2C77E'
const CRUST = '#D9954A'
const CARROT = '#FF8A3D'
const MILK = '#FFF8F0'
const RICE = '#FFFDF8'

const BORDER = 7
const SHADOW_DY = 2.5
const SHADOW_ALPHA = 0.18
const LINE = 2.2

/** One food: the silhouette (drives border and shadow), the art, and a tilt in degrees. */
interface Food {
  tilt: number
  silhouette: ReactNode
  art: (uid: string) => ReactNode
}

interface ShadedProps {
  uid: string
  name: string
  shapes: ReactNode
  base: string
  shade: string
  /** Offset of the lit layer. The part it does not cover keeps the shade color. */
  dx: number
  dy: number
}

/** Fills the shapes with a shade color, then lays a shifted base color on top, clipped to the shape. */
function Shaded({ uid, name, shapes, base, shade, dx, dy }: ShadedProps): JSX.Element {
  const clipId = `${uid}${name}`
  return (
    <>
      <g fill={shade}>{shapes}</g>
      <clipPath id={clipId}>{shapes}</clipPath>
      <g clipPath={`url(#${clipId})`}>
        <g fill={base} transform={`translate(${dx} ${dy})`}>
          {shapes}
        </g>
      </g>
    </>
  )
}

/** Plum outline on its own, drawn after the fills so shading never covers it. */
function Outline({ d, w = LINE }: { d: string; w?: number }): JSX.Element {
  return <path d={d} fill="none" stroke={INK} strokeWidth={w} />
}

// ---------------------------------------------------------------- apple
const APPLE_BODY =
  'M50 31 C44 24 23 25 20 51 C18 72 33 88 44 86 C48 85 52 85 56 86 C67 88 82 72 80 51 C77 25 56 24 50 31 Z'
const APPLE_STEM = 'M48 33 C48 26 50 21 54 15 L59 18 C56 22 55 27 55 33 Z'
const APPLE_LEAF = 'M58 25 C59 14 70 9 82 13 C81 25 69 31 58 25 Z'

const apple: Food = {
  tilt: -6,
  silhouette: (
    <>
      <path d={APPLE_STEM} />
      <path d={APPLE_BODY} />
      <path d={APPLE_LEAF} />
    </>
  ),
  art: (uid) => (
    <>
      <path d={APPLE_STEM} fill="#9A5A32" stroke={INK} strokeWidth={LINE} />
      <Shaded
        uid={uid}
        name="a"
        shapes={<path d={APPLE_BODY} />}
        base="#F0506E"
        shade="#CF3558"
        dx={-5}
        dy={-3}
      />
      <ellipse cx="33" cy="46" rx="3.6" ry="8.5" transform="rotate(16 33 46)" fill={PINK_1} />
      <circle cx="37" cy="62" r="1.8" fill={PINK_1} />
      <Outline d={APPLE_BODY} />
      <path d={APPLE_LEAF} fill={LEAF} stroke={INK} strokeWidth={LINE} />
      <path d="M61 24 C67 20 73 17 78 15" fill="none" stroke={LEAF_DEEP} strokeWidth="1.8" />
    </>
  ),
}

// ---------------------------------------------------------------- orange
const ORANGE_BODY = 'M50 27 A30 30 0 1 1 49.99 27 Z'
const ORANGE_LEAF_R = 'M52 30 C54 18 66 13 78 17 C76 28 64 34 52 30 Z'
const ORANGE_LEAF_L = 'M48 30 C46 21 38 17 30 19 C32 27 40 32 48 30 Z'

const orange: Food = {
  tilt: 0,
  silhouette: (
    <>
      <path d={ORANGE_BODY} />
      <path d={ORANGE_LEAF_R} />
      <path d={ORANGE_LEAF_L} />
    </>
  ),
  art: (uid) => (
    <>
      <path d={ORANGE_LEAF_L} fill={LEAF_MID} stroke={INK} strokeWidth={LINE} />
      <Shaded
        uid={uid}
        name="o"
        shapes={<path d={ORANGE_BODY} />}
        base="#FFA23A"
        shade="#EC8420"
        dx={-5}
        dy={-4}
      />
      <g fill="#EC8420">
        <circle cx="62" cy="44" r="1.3" />
        <circle cx="69" cy="58" r="1.3" />
        <circle cx="45" cy="66" r="1.3" />
        <circle cx="57" cy="76" r="1.3" />
        <circle cx="33" cy="64" r="1.3" />
        <circle cx="51" cy="54" r="1.3" />
        <circle cx="74" cy="70" r="1.3" />
        <circle cx="40" cy="78" r="1.3" />
      </g>
      <g fill="#FFD08A">
        <circle cx="31" cy="55" r="1.2" />
        <circle cx="48" cy="45" r="1.2" />
      </g>
      <ellipse cx="35" cy="44" rx="3.8" ry="8" transform="rotate(34 35 44)" fill={PINK_1} />
      <Outline d={ORANGE_BODY} />
      <circle cx="50" cy="29" r="3" fill={LEAF_DEEP} stroke={INK} strokeWidth="1.6" />
      <path d={ORANGE_LEAF_R} fill={LEAF} stroke={INK} strokeWidth={LINE} />
      <path d="M55 29 C62 25 69 22 75 20" fill="none" stroke={LEAF_DEEP} strokeWidth="1.8" />
    </>
  ),
}

// ---------------------------------------------------------------- milk
const MILK_BODY = 'M27 45 H73 V88 H27 Z'
const MILK_ROOF = 'M27 45 L37 27 H63 L73 45 Z'
const MILK_FIN = 'M38 27 V16 H62 V27 Z'

const milk: Food = {
  tilt: -7,
  silhouette: (
    <>
      <path d={MILK_BODY} />
      <path d={MILK_ROOF} />
      <path d={MILK_FIN} />
    </>
  ),
  art: () => (
    <>
      <path d={MILK_FIN} fill={MILK} />
      <path d="M52 16 H62 V27 H52 Z" fill="#F0DCCF" />
      <path d={MILK_ROOF} fill={MILK} />
      <path d="M54 27 H63 L73 45 H59 Z" fill="#F0DCCF" />
      <path d={MILK_BODY} fill={MILK} />
      <path d="M27 57 H73 V77 H27 Z" fill={PINK_5} />
      <path d="M60 45 H73 V88 H60 Z" fill="#F0DCCF" />
      <path d="M60 57 H73 V77 H60 Z" fill="#DB5278" />
      <path
        d="M43 60 C46 64 48.6 66.6 48.6 69.4 C48.6 72.4 46 74.6 43 74.6 C40 74.6 37.4 72.4 37.4 69.4 C37.4 66.6 40 64 43 60 Z"
        fill={MILK}
      />
      <path d="M32 49 V53 M32 81 V85" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" fill="none" />
      <Outline d={MILK_FIN} />
      <Outline d={MILK_ROOF} />
      <Outline d={MILK_BODY} />
      <path d="M27 57 H73 M27 77 H73" stroke={INK} strokeWidth="1.8" fill="none" />
    </>
  ),
}

// ---------------------------------------------------------------- taco
const TACO_BACK = 'M9 54 C9 40 27 36 50 36 C73 36 91 40 91 54 Z'
const TACO_FILLING =
  'M17 57 C11 47 15 38 23 40 C21 29 32 24 38 31 C42 21 57 21 61 31 C67 25 78 29 76 39 C85 37 89 48 83 57 Z'
const TACO_SHELL =
  'M5 48 C8 80 27 94 50 94 C73 94 92 80 95 48 C76 62 24 62 5 48 Z'

const taco: Food = {
  tilt: -14,
  silhouette: (
    <>
      <path d={TACO_BACK} />
      <path d={TACO_FILLING} />
      <path d={TACO_SHELL} />
    </>
  ),
  art: (uid) => (
    <>
      <path d={TACO_BACK} fill="#E2A85E" stroke={INK} strokeWidth={LINE} />
      <path d="M15 49 C17 44 24 41 32 40" fill="none" stroke="#F4D49A" strokeWidth="2.6" strokeLinecap="round" />
      <Shaded
        uid={uid}
        name="t"
        shapes={<path d={TACO_FILLING} />}
        base={LEAF}
        shade={LEAF_MID}
        dx={-3}
        dy={-3}
      />
      <Outline d={TACO_FILLING} />
      <rect x="29" y="42" width="12" height="10" rx="3" transform="rotate(-14 35 47)" fill="#F0506E" stroke={INK} strokeWidth="1.8" />
      <rect x="55" y="41" width="12" height="10" rx="3" transform="rotate(12 61 46)" fill="#F0506E" stroke={INK} strokeWidth="1.8" />
      <path
        d="M44 50 L50 45 M70 52 L76 47 M20 50 L25 46 M46 38 L51 34"
        stroke={YELLOW}
        strokeWidth="3.4"
        strokeLinecap="round"
        fill="none"
      />
      <Shaded
        uid={uid}
        name="s"
        shapes={<path d={TACO_SHELL} />}
        base={TORTILLA}
        shade={CRUST}
        dx={-4}
        dy={-5}
      />
      <path d="M14 60 C17 76 26 86 37 90" fill="none" stroke="#FFF0CC" strokeWidth="2.8" strokeLinecap="round" />
      <g fill={CRUST}>
        <circle cx="48" cy="78" r="1.4" />
        <circle cx="64" cy="74" r="1.4" />
        <circle cx="34" cy="74" r="1.4" />
      </g>
      <Outline d={TACO_SHELL} />
    </>
  ),
}

// ---------------------------------------------------------------- rice
const RICE_MOUND = 'M15 54 C15 30 31 17 50 17 C69 17 85 30 85 54 Z'
const RICE_RIM = 'M15.5 50 H84.5 A4.5 4.5 0 0 1 89 54.5 A4.5 4.5 0 0 1 84.5 59 H15.5 A4.5 4.5 0 0 1 11 54.5 A4.5 4.5 0 0 1 15.5 50 Z'
const RICE_BOWL = 'M15 59 H85 C85 75 72 85 50 85 C28 85 15 75 15 59 Z'
const RICE_FOOT = 'M36 83 H64 L62 90 H38 Z'

const rice: Food = {
  tilt: 0,
  silhouette: (
    <>
      <path d={RICE_MOUND} />
      <path d={RICE_RIM} />
      <path d={RICE_BOWL} />
      <path d={RICE_FOOT} />
    </>
  ),
  art: (uid) => (
    <>
      <path d={RICE_FOOT} fill={PINK_4} stroke={INK} strokeWidth={LINE} />
      <Shaded
        uid={uid}
        name="b"
        shapes={<path d={RICE_BOWL} />}
        base={PINK_2}
        shade={PINK_4}
        dx={-5}
        dy={-3}
      />
      <g fill={PINK_1}>
        <circle cx="34" cy="71" r="2.4" />
        <circle cx="50" cy="75" r="2.4" />
        <circle cx="66" cy="71" r="2.4" />
      </g>
      <path d="M22 63 C23 69 26 73 30 76" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" />
      <Outline d={RICE_BOWL} />
      <Shaded
        uid={uid}
        name="m"
        shapes={<path d={RICE_MOUND} />}
        base={RICE}
        shade="#E9DDC8"
        dx={-5}
        dy={-3}
      />
      <g fill="#E3D5BC">
        <ellipse cx="30" cy="42" rx="3" ry="1.5" transform="rotate(-30 30 42)" />
        <ellipse cx="44" cy="35" rx="3" ry="1.5" transform="rotate(25 44 35)" />
        <ellipse cx="62" cy="38" rx="3" ry="1.5" transform="rotate(-20 62 38)" />
        <ellipse cx="72" cy="47" rx="3" ry="1.5" transform="rotate(35 72 47)" />
        <ellipse cx="38" cy="47" rx="3" ry="1.5" transform="rotate(10 38 47)" />
        <ellipse cx="54" cy="46" rx="3" ry="1.5" transform="rotate(-35 54 46)" />
        <ellipse cx="24" cy="50" rx="3" ry="1.5" transform="rotate(15 24 50)" />
      </g>
      <Outline d={RICE_MOUND} />
      <circle cx="50" cy="26" r="5" fill={PINK_5} stroke={INK} strokeWidth="1.8" />
      <circle cx="48.4" cy="24.4" r="1.4" fill={PINK_1} />
      <path d={RICE_RIM} fill={PINK_5} stroke={INK} strokeWidth={LINE} />
      <path d="M17 53 H30" stroke={PINK_2} strokeWidth="2" strokeLinecap="round" />
    </>
  ),
}

// ---------------------------------------------------------------- broccoli
const BROC_CIRCLES: ReadonlyArray<readonly [number, number, number]> = [
  [27, 46, 15],
  [50, 33, 18],
  [73, 46, 15],
  [36, 58, 12],
  [64, 58, 12],
  [50, 52, 16],
]
const BROC_STEM = 'M41 58 H59 C60 70 62 79 68 88 H32 C38 79 40 70 41 58 Z'

function brocCircles(): ReactNode {
  return (
    <>
      {BROC_CIRCLES.map(([cx, cy, r]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} />
      ))}
    </>
  )
}

const broccoli: Food = {
  tilt: 5,
  silhouette: (
    <>
      {brocCircles()}
      <path d={BROC_STEM} />
    </>
  ),
  art: (uid) => (
    <>
      <Shaded
        uid={uid}
        name="s"
        shapes={<path d={BROC_STEM} />}
        base="#B2DE9B"
        shade="#8CC879"
        dx={-5}
        dy={0}
      />
      <Outline d={BROC_STEM} />
      <path d="M50 70 V82" stroke="#8CC879" strokeWidth="2" strokeLinecap="round" fill="none" />
      <g fill={INK} stroke={INK} strokeWidth={LINE * 2} strokeLinejoin="round">
        {brocCircles()}
      </g>
      <Shaded uid={uid} name="c" shapes={brocCircles()} base={LEAF} shade={LEAF_MID} dx={-4} dy={-4} />
      <g fill="none" stroke={LEAF_MID} strokeWidth="2" strokeLinecap="round">
        <path d="M24 52 Q28 56 33 52" />
        <path d="M44 40 Q50 45 56 40" />
        <path d="M62 54 Q67 58 72 53" />
        <path d="M45 58 Q50 62 55 58" />
      </g>
      <g fill="#A9E0B4">
        <circle cx="40" cy="25" r="2.4" />
        <circle cx="20" cy="40" r="2.2" />
        <circle cx="60" cy="30" r="1.8" />
      </g>
    </>
  ),
}

// ---------------------------------------------------------------- carrot
const CARROT_BODY =
  'M34 38 C34 30 40 26 50 26 C60 26 66 30 66 38 C66 56 56 78 50 94 C44 78 34 56 34 38 Z'
const CARROT_LEAF_C = 'M50 29 C43 19 45 9 50 4 C55 9 57 19 50 29 Z'
const CARROT_LEAF_L = 'M47 29 C38 26 28 18 25 10 C36 9 45 16 47 29 Z'
const CARROT_LEAF_R = 'M53 29 C62 26 72 18 75 10 C64 9 55 16 53 29 Z'

const carrot: Food = {
  tilt: 38,
  silhouette: (
    <>
      <path d={CARROT_BODY} />
      <path d={CARROT_LEAF_C} />
      <path d={CARROT_LEAF_L} />
      <path d={CARROT_LEAF_R} />
    </>
  ),
  art: (uid) => (
    <>
      <path d={CARROT_LEAF_L} fill={LEAF_MID} stroke={INK} strokeWidth={LINE} />
      <path d={CARROT_LEAF_R} fill={LEAF_MID} stroke={INK} strokeWidth={LINE} />
      <path d={CARROT_LEAF_C} fill={LEAF} stroke={INK} strokeWidth={LINE} />
      <path d="M50 26 V14" stroke={LEAF_DEEP} strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <Shaded
        uid={uid}
        name="c"
        shapes={<path d={CARROT_BODY} />}
        base={CARROT}
        shade="#E5671F"
        dx={-5}
        dy={0}
      />
      <g fill="none" stroke="#E5671F" strokeWidth="2.2" strokeLinecap="round">
        <path d="M38 46 L44 47" />
        <path d="M40 62 L46 63" />
        <path d="M45 76 L50 77" />
        <path d="M54 54 L59 53" />
      </g>
      <path d="M39 35 C38 40 38 44 39 50" fill="none" stroke="#FFC9A0" strokeWidth="2.6" strokeLinecap="round" />
      <Outline d={CARROT_BODY} />
    </>
  ),
}

// ---------------------------------------------------------------- sandwich
const SW_TOP = 'M12 54 H88 L50 16 Z'
const SW_CRUMB = 'M21.7 50 H78.3 L50 21.7 Z'
const SW_BREAD_TOP = 'M12 54 H88 V62 H12 Z'
const SW_LETTUCE =
  'M8 63 Q12.7 57.5 17.4 63 T26.8 63 T36.2 63 T45.6 63 T55 63 T64.4 63 T73.8 63 T83.2 63 T92 63 V70 H8 Z'
const SW_TOMATO = 'M13 70 H87 V76 H13 Z'
const SW_CHEESE = 'M10 76 H90 V80 H74 L68 86 L62 80 H10 Z'
const SW_BREAD_BOTTOM = 'M12 80 H88 V87 Q88 90 85 90 H15 Q12 90 12 87 Z'

const sandwich: Food = {
  tilt: -5,
  silhouette: (
    <>
      <path d={SW_TOP} />
      <path d={SW_LETTUCE} />
      <path d={SW_BREAD_TOP} />
      <path d={SW_BREAD_BOTTOM} />
      <path d={SW_CHEESE} />
    </>
  ),
  art: () => (
    <>
      <path d={SW_TOP} fill={CRUST} stroke={INK} strokeWidth={LINE} />
      <path d={SW_CRUMB} fill="#F9DFAE" />
      <path d="M50 21.7 L78.3 50 H50 Z" fill="#EDC47F" />
      <path d="M26 46 L40 32" stroke="#FFF6DE" strokeWidth="2.6" strokeLinecap="round" fill="none" />
      <path d={SW_CRUMB} fill="none" stroke={CRUST} strokeWidth="1.2" />
      <path d={SW_BREAD_BOTTOM} fill={TORTILLA} stroke={INK} strokeWidth={LINE} />
      <path d={SW_CHEESE} fill={YELLOW} stroke={INK} strokeWidth={LINE} />
      <path d={SW_TOMATO} fill="#F0506E" stroke={INK} strokeWidth={LINE} />
      <path d="M20 72.6 H32" stroke={PINK_2} strokeWidth="1.8" strokeLinecap="round" />
      <path d={SW_LETTUCE} fill={LEAF} stroke={INK} strokeWidth={LINE} />
      <path d={SW_BREAD_TOP} fill={TORTILLA} stroke={INK} strokeWidth={LINE} />
      <path d="M17 58 H28 M17 84.4 H26" stroke="#FFF0CC" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
}

const FOODS: Record<StickerId, Food> = {
  apple,
  milk,
  taco,
  rice,
  broccoli,
  orange,
  sandwich,
  carrot,
}

/**
 * One die-cut sticker as an svg. Decorative: it is hidden from screen readers,
 * so put any label on the element that wraps it.
 */
export function Sticker({ id, size, className }: StickerProps): JSX.Element {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const food = FOODS[id]
  const tilt = `rotate(${food.tilt} 50 50)`
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      focusable="false"
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      {/* Contact shadow: the white silhouette again, nudged down. Group opacity keeps overlaps from double-darkening. */}
      <g
        transform={`translate(0 ${SHADOW_DY})`}
        opacity={SHADOW_ALPHA}
        fill={INK}
        stroke={INK}
        strokeWidth={BORDER}
      >
        <g transform={tilt}>{food.silhouette}</g>
      </g>
      {/* Vinyl border. */}
      <g fill="#FFFFFF" stroke="#FFFFFF" strokeWidth={BORDER}>
        <g transform={tilt}>{food.silhouette}</g>
      </g>
      <g transform={tilt}>{food.art(uid)}</g>
    </svg>
  )
}
