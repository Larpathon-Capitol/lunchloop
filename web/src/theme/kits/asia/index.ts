// East and Southeast Asia: a konbini window at blossom dusk. Mascot Ume.
import type { ThemeKit } from '../../types'
import { Corner } from './Corner'
import { Curtain } from './Curtain'
import { HeaderBand } from './HeaderBand'
import { HeroBackdrop } from './HeroBackdrop'
import { Milestone } from './Milestone'
import { pattern, patternSize } from './pattern'
import { Seal } from './Seal'

export const kit: ThemeKit = {
  Corner,
  Milestone,
  Seal,
  HeaderBand,
  HeroBackdrop,
  Curtain,
  pattern,
  patternSize,
  particles: {
    kinds: ['petal', 'petal', 'blossom', 'leaf', 'fleck'],
    colors: ['--pink-3', '--pink-4', '--pink-5', '--pink-2', '--pink-4', '--leaf'],
  },
}
