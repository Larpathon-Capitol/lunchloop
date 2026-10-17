// Placeholder art so every screen compiles while a world's real kit is being drawn.
// Each world's folder replaces its index.ts with the real kit.
import type { ThemeKit } from '../types'

function Nothing() {
  return null
}

export function stubKit(): ThemeKit {
  return {
    Corner: Nothing,
    Milestone: Nothing,
    Seal: Nothing,
    HeaderBand: Nothing,
    HeroBackdrop: Nothing,
    Curtain: Nothing,
    pattern: 'none',
    patternSize: '48px 48px',
    particles: { kinds: ['petal', 'blossom', 'fleck'], colors: ['--pink-3', '--pink-4', '--pink-5'] },
  }
}
