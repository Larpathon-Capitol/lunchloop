// Ume's colors, in one place. Most are design tokens; the three that are not
// (rice shade, nori, nori sheen) exist only inside the illustration.
export const P = {
  rice: 'var(--shoji)',
  riceShade: '#e4e7dc',
  grain: '#d6dacd',
  ink: 'var(--sumi)',
  nori: '#1d2a22',
  noriSheen: '#3e5847',
  blush: 'var(--ume)',
  petal: 'var(--ume)',
  petalTint: 'var(--sakura)',
  gold: 'var(--kin-light)',
  goldEdge: 'var(--kin)',
  white: '#ffffff',
} as const

/** One stroke weight for every line in the drawing, in viewBox units (120 = full width). */
export const LINE = 2.6
