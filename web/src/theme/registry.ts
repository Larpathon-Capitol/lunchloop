// The three worlds: their names and the art each one draws.
import { useThemeId } from './store'
import type { ThemeId, ThemeInfo, ThemeKit } from './types'
import { kit as americas } from './kits/americas'
import { kit as asia } from './kits/asia'
import { kit as medi } from './kits/medi'

export const THEME_INFO: Record<ThemeId, ThemeInfo> = {
  americas: {
    id: 'americas',
    label: 'Americas',
    region: 'North, Central and South America',
    mascot: 'chispa',
    mascotName: 'Chispa',
  },
  asia: {
    id: 'asia',
    label: 'East Asia',
    region: 'East and Southeast Asia',
    mascot: 'ume',
    mascotName: 'Ume',
  },
  medi: {
    id: 'medi',
    label: 'Mediterranean',
    region: 'South Asia, West Asia and the Mediterranean',
    mascot: 'lafa',
    mascotName: 'Lafa',
  },
}

export const KITS: Record<ThemeId, ThemeKit> = { americas, asia, medi }

export function useThemeInfo(): ThemeInfo {
  return THEME_INFO[useThemeId()]
}

export function useKit(): ThemeKit {
  return KITS[useThemeId()]
}
