// One 3D model per world's mascot, loaded only when that world is picked.
import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import type { MascotId } from '../../../theme/types'
import type { MascotModelProps } from '../contract'

export const MODELS: Record<MascotId, LazyExoticComponent<ComponentType<MascotModelProps>>> = {
  chispa: lazy(() => import('./chispa')),
  ume: lazy(() => import('./ume')),
  lafa: lazy(() => import('./lafa')),
}
