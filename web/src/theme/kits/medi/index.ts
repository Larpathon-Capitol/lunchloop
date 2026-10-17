// South Asia, West Asia and the Mediterranean: a tiled courtyard at pink hour.
import type { ThemeKit } from '../../types'
import { Corner } from './Corner'
import { Curtain } from './Curtain'
import { groundTile } from './geometry'
import { HeaderBand } from './HeaderBand'
import { HeroBackdrop } from './HeroBackdrop'
import { Milestone } from './Milestone'
import { Seal } from './Seal'

const tile = groundTile()

export const kit: ThemeKit = {
  Corner,
  Milestone,
  Seal,
  HeaderBand,
  HeroBackdrop,
  Curtain,
  pattern: tile.image,
  patternSize: tile.size,
  particles: {
    kinds: ['petal', 'seed', 'leaf', 'confetti', 'marigold'],
    colors: ['--pink-3', '--pink-4', '--pink-5', '--accent-1', '--leaf'],
  },
}
