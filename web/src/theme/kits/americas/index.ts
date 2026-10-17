// The Americas & Latin America world: block party at dusk on a pink painted street.
import type { ThemeKit } from '../../types'
import { Curtain } from './Curtain'
import { HeroBackdrop } from './HeroBackdrop'
import { Milestone } from './Milestone'
import { pattern, patternSize } from './pattern'
import { Seal } from './Seal'
import { Corner, HeaderBand } from './Small'

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
    kinds: ['papel', 'confetti', 'star'],
    colors: ['--pink-3', '--pink-4', '--pink-5', '--leaf', '--accent-1'],
  },
}
