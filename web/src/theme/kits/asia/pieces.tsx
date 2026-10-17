// Scene props shared by the hero, the curtain and the milestone: the noren cloth and crest,
// konbini shelf goods, the moon and the mist bands.
import { useId } from 'react'
import { C } from './paint'
import { Blossom } from './art'

/** Plain-weave cloth texture over whatever fills the parent. Light threads, then dark. */
export function Weave({ light = C.surface, dark = C.ink, strength = 1 }: { light?: string; dark?: string; strength?: number }) {
  const id = 'kaw' + useId().replace(/[^a-zA-Z0-9]/g, '')
  return (
    <svg className="ka-fill" aria-hidden="true" focusable="false" preserveAspectRatio="none">
      <defs>
        <pattern id={id} width="6" height="6" patternUnits="userSpaceOnUse">
          <rect x="0" y="0" width="3" height="1.3" fill={light} opacity={0.22 * strength} />
          <rect x="3" y="3" width="3" height="1.3" fill={light} opacity={0.22 * strength} />
          <rect x="3" y="0" width="1.1" height="3" fill={dark} opacity={0.08 * strength} />
          <rect x="0" y="3" width="1.1" height="3" fill={dark} opacity={0.08 * strength} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  )
}

/** A round shop crest: an indigo disc with a sakura blossom cut out of it. */
export function Crest({ size, ring = C.indigo, cut = C.pink1 }: { size: number; ring?: string; cut?: string }) {
  return (
    <svg width={size} height={size} viewBox="-50 -50 100 100" aria-hidden="true" focusable="false">
      <circle r="48" fill={ring} />
      <circle r="41" fill="none" stroke={cut} strokeWidth="2.2" />
      <g transform="rotate(-18)">
        <Blossom r={33} seed={2} tint={cut} deep={cut} heart={ring} />
      </g>
    </svg>
  )
}

/**
 * A konbini onigiri in its film wrap: rice triangle, nori belt, a colored tag bar, a numbered
 * pull tab and the diagonal film edge catching the light.
 */
export function OnigiriPack({ tag = C.leaf, n = 1, className }: { tag?: string; n?: number; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 62" aria-hidden="true" focusable="false">
      {/* film, slightly bigger than the rice */}
      <path d="M32 3C35 3 37 4.6 38.6 7.4L60 50C62 54.6 59.4 59 54.6 59H9.4C4.6 59 2 54.6 4 50L25.4 7.4C27 4.6 29 3 32 3Z" fill={C.pink1} />
      <path d="M32 8C34 8 35.4 9 36.4 11L55.6 49.6C57 52.6 55.4 55 52.4 55H11.6C8.6 55 7 52.6 8.4 49.6L27.6 11C28.6 9 30 8 32 8Z" fill={C.surface} />
      {/* nori belt */}
      <path d="M22 55V38.6C22 36.6 23.4 35.4 25.2 35.4H38.8C40.6 35.4 42 36.6 42 38.6V55Z" fill={C.ink} />
      <path d="M25 37.6H39" stroke={C.surface} strokeOpacity="0.25" strokeWidth="1" />
      {/* colored tag bar and the pull tab */}
      <rect x="10" y="44" width="10" height="4" rx="1" fill={tag} />
      <path d="M32 3V58" stroke={tag} strokeWidth="2.6" strokeOpacity="0.9" />
      <rect x="27" y="0.5" width="10" height="9" rx="2" fill={tag} />
      <text x="32" y="7.6" textAnchor="middle" fontSize="7" fontWeight="800" fill={C.surface} style={{ fontFamily: 'var(--font-ui, sans-serif)' }}>
        {n}
      </text>
      {/* film glint */}
      <path d="M41 14L50.6 33" stroke="#fff" strokeOpacity="0.85" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M52.4 37L54.4 41" stroke="#fff" strokeOpacity="0.85" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}

/** A small milk bottle with a pink cap and a leaf band, for the shelf. */
export function MilkBottle({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 30 62" aria-hidden="true" focusable="false">
      <rect x="9" y="1" width="12" height="7" rx="2" fill={C.pink5} />
      <path d="M10 8H20V14C20 16 26 18 26 24V56C26 59 24 61 21 61H9C6 61 4 59 4 56V24C4 18 10 16 10 14Z" fill={C.surface} />
      <rect x="4" y="32" width="22" height="13" fill={C.leaf} />
      <circle cx="15" cy="38.5" r="4" fill={C.surface} />
      <path d="M8 22V54" stroke="#fff" strokeOpacity="0.9" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}

/** A stepped mist band (suyari-gasumi), the long flat cloud seen in old screen painting. */
export function MistBand({ className, fill = C.surface }: { className?: string; fill?: string }) {
  return (
    <svg className={className} viewBox="0 0 400 40" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path
        d="M14 20C14 13 19 10 26 10H120C124 10 126 4 132 4H262C268 4 270 10 276 10H378C385 10 388 14 388 20C388 26 385 30 378 30H300C294 30 292 36 286 36H150C144 36 142 30 136 30H26C19 30 14 27 14 20Z"
        fill={fill}
      />
    </svg>
  )
}
