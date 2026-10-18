// The backdrop tiles: one per world and tab. Each tile mixes the tab's objects (cutlery, ballots,
// stars, stamps) with the world's own ornaments, in pale tints of the world's colors. Data URIs
// can't read CSS variables, so the tints are written in here. Every tint keeps --ink-soft text
// above 4.5:1 even at full strength.
import type { ThemeId } from '../types'
import {
  arch,
  asanoha,
  at,
  ballot,
  ballotBox,
  confetti,
  crystal,
  dot,
  fork,
  comet,
  gingham,
  knife,
  moon,
  olive,
  picado,
  plate,
  postage,
  postmark,
  sakura,
  seigaiha,
  sparkle,
  spoon,
  star5,
  talavera,
  tick,
  visa,
  zellige,
  type Palette,
} from './motifs'

export type GameTab = 'tray' | 'vote' | 'call' | 'stamps'

/** Tile edge in CSS pixels. Motifs stay 34 px inside it so nothing is cut at the seam. */
export const TILE = 300

/*
 * Pale tints only, every one at relative luminance 0.73 or higher, and paper-white fills that
 * are lighter than the page. At the layer's strongest (75%, at the far edges) the page behind
 * text stays at 0.75 luminance or more, so even the 5:1 accent texts (xp-ink, vermilion) keep
 * 4.5:1 and --ink-soft keeps 5.9:1.
 */
const PAPER = { line: '#FFD4DF', fill: '#FFFFFF', ground: '#FFF6F9', leaf: '#C9E7D2' }
const PALETTES: Record<ThemeId, Palette> = {
  americas: { ...PAPER, a: '#D8DFF9', b: '#FFDC7A' },
  asia: { ...PAPER, a: '#DDDEEF', b: '#FBD7D1' },
  medi: { ...PAPER, a: '#C3E6E3', b: '#F0DAE5', leaf: '#D4E4C6' },
}

/** The world's three ornaments, in order of size. */
function ornaments(world: ThemeId, p: Palette): [string, string, string] {
  switch (world) {
    case 'asia':
      return [asanoha(p), seigaiha(p), sakura(p)]
    case 'medi':
      return [zellige(p), arch(p), olive(p)]
    default:
      return [talavera(p), picado(p, p.a), picado(p, p.b)]
  }
}

function compose(world: ThemeId, tab: GameTab): string {
  const p = PALETTES[world]
  const [o1, o2, o3] = ornaments(world, p)
  switch (tab) {
    case 'vote':
      return [
        at(72, 84, ballot(p, p.a), -10),
        at(160, 58, confetti(p)),
        at(236, 104, o1, 6, 0.85),
        at(112, 204, ballotBox(p, p.fill), 4),
        at(226, 236, tick(p.b), -6, 1.3),
        at(250, 178, confetti(p), 90, 0.8),
        at(40, 262, sparkle(p.b, 7)),
        at(186, 150, o3, -10, 0.7),
      ].join('')
    case 'call':
      return [
        at(78, 96, crystal(p, p.a)),
        at(172, 56, star5(p.b, 15), 8),
        at(206, 120, sparkle(p.a, 9)),
        at(246, 206, moon(p, p.b), -14),
        at(72, 228, o2, -6, 0.8),
        at(164, 214, comet(p, p.b), -8),
        at(258, 54, star5(p.a, 8), -12),
        at(36, 168, sparkle(p.b, 6)),
      ].join('')
    case 'stamps':
      return [
        at(76, 86, postage(p, p.fill, o1), -6),
        at(150, 100, postmark(p), -8),
        at(232, 196, visa(p, p.a), -8),
        at(92, 226, postage(p, p.fill, o3), 8),
        at(250, 56, o2, 10, 0.6),
        at(170, 260, sparkle(p.b, 7)),
        at(36, 160, dot(p.a, 3)),
      ].join('')
    default:
      return [
        at(72, 78, plate(p, o1)),
        at(152, 70, fork(p), 14),
        at(180, 76, knife(p), 14),
        at(238, 150, o2, -8, 0.85),
        at(84, 214, gingham(p, p.a), 14),
        at(178, 226, spoon(p), -24),
        at(252, 262, sparkle(p.b, 7)),
        at(250, 42, dot(p.a, 3)),
        at(34, 150, sparkle(p.a, 6)),
      ].join('')
  }
}

const cache = new Map<string, string>()

/** The CSS background-image value for a world and tab. */
export function tileFor(world: ThemeId, tab: GameTab): string {
  const key = `${world}:${tab}`
  let url = cache.get(key)
  if (!url) {
    // Half-drop repeat: the right half is the same drawing dropped by half a tile (drawn twice
    // so it wraps), which breaks up the grid the eye would otherwise catch.
    const art = compose(world, tab)
    const h = TILE / 2
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${TILE * 2}' height='${TILE}' viewBox='0 0 ${TILE * 2} ${TILE}'>${art}<g transform='translate(${TILE} ${h})'>${art}</g><g transform='translate(${TILE} ${-h})'>${art}</g></svg>`
    url = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
    cache.set(key, url)
  }
  return url
}
