import { lazy } from 'react'

export { DEFAULT_GROUP_COLORS, GROUP_IDS, GROUP_LABELS, GROUPS, resolveColors } from './groups'
export type { FoodGroup, GroupColors, GroupId } from './groups'
export type { TrayMode, TraySceneProps } from './types'

/** Code-split tray scene. Wrap in <Suspense>. three.js only downloads when this first renders. */
export const LazyTrayScene = lazy(() => import('./TrayScene'))
