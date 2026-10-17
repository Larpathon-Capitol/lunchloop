// The display name for a mascot id, from the theme registry.
import { THEME_INFO } from '../theme/registry'
import type { MascotId } from '../theme/types'

/** Mascot name for an id ("Chispa", "Ume", "Lafa"). */
export const mascotName = (id: MascotId) => Object.values(THEME_INFO).find((t) => t.mascot === id)?.mascotName ?? 'Ume'
