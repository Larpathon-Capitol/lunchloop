// The three worlds a student can pick. Every screen has the same layout in every world;
// a world only changes colors, type, decoration, the mascot, the celebration and the sounds.
import type { MotionValue } from 'framer-motion'
import type { ComponentType, CSSProperties } from 'react'

export const THEMES = ['americas', 'asia', 'medi'] as const
export type ThemeId = (typeof THEMES)[number]

export type MascotId = 'chispa' | 'ume' | 'lafa'

export interface ThemeInfo {
  id: ThemeId
  /** Short switcher label. */
  label: string
  /** The regions it stands for, for the switcher subtitle and screen readers. */
  region: string
  mascot: MascotId
  /** The mascot's name, shown in bubbles and the switcher. */
  mascotName: string
}

export interface ArtProps {
  className?: string
  style?: CSSProperties
}

/** The seal that lands on a packed tray, and the earned stamps in the stamp book. */
export interface SealProps {
  visible: boolean
  /** Rendered width in CSS pixels. */
  size?: number
  /** Short text on the seal. Defaults to the world's own word for "packed". */
  label?: string
  /** No sound when it lands. */
  silent?: boolean
  onDone?: () => void
  className?: string
}

export interface HeroBackdropProps {
  /** Pointer offset from the viewport center, -0.5 to 0.5, already sprung. 0 on touch screens. */
  px: MotionValue<number>
  py: MotionValue<number>
  className?: string
}

/** Shapes the particle canvas can draw. Each world picks a few. */
export type ParticleKind =
  | 'blossom' // five-petal flower seen from the front
  | 'petal' // single notched petal
  | 'fleck' // small diamond of gold
  | 'papel' // tissue-paper rectangle with a cut pattern, flutters
  | 'confetti' // plain paper strip
  | 'star' // four-point sparkle
  | 'leaf' // olive or herb leaf
  | 'seed' // round glossy seed (pomegranate)
  | 'marigold' // small layered orange flower

export interface ParticleStyle {
  kinds: readonly ParticleKind[]
  /** Fill colors as CSS custom property names (e.g. '--pink-4'), read when a burst starts. */
  colors: readonly string[]
}

/**
 * Everything a world draws. Every piece is optional to look at but required to exist,
 * so screens can always render kit.Seal, kit.Corner and so on without checking the theme.
 */
export interface ThemeKit {
  /** Small decoration tucked into a section corner (was the plum sprig). Purely decorative. */
  Corner: ComponentType<ArtProps>
  /** Large art for the streak milestone overlay. Draws itself in when grow is true (static under reduced motion). */
  Milestone: ComponentType<ArtProps & { grow?: boolean }>
  /** The packed-tray seal (was the hanko). */
  Seal: ComponentType<SealProps>
  /** Decoration layer inside the game header bar, absolutely positioned, pointer-events none (was the noren band). */
  HeaderBand: ComponentType
  /**
   * Full-bleed layered backdrop behind the hero tray, with parallax on the pointer. Decoration
   * gathers at the edges and the top; the middle stays calm for the tray, the headline and the button.
   */
  HeroBackdrop: ComponentType<HeroBackdropProps>
  /**
   * Covers the screen while the hero hands over to the game, then opens (was the noren curtain).
   * The host mounts it fresh for each run. It starts fully closed, looking like the hero's ground,
   * holds while `ready` is false (the game screen is still mounting), opens once `ready` turns true,
   * and calls onDone when it is fully off screen. Fixed, full viewport, pointer-events none.
   */
  Curtain: ComponentType<{ ready: boolean; onDone: () => void }>
  /** A seamless tile as a CSS background-image value (url("data:image/svg+xml,...")), drawn faintly on grounds. */
  pattern: string
  /** Size of one pattern tile, e.g. '48px 48px'. */
  patternSize: string
  particles: ParticleStyle
}
