import type { CSSProperties } from 'react'
import type { GroupColors, GroupId } from './groups'

export type TrayMode = 'hero' | 'pick'

export interface TraySceneProps {
  /** "hero": floating tray that follows the pointer. "pick": centered top-down view with clickable compartments. */
  mode: TrayMode
  /** Called when the tray is clicked or tapped in hero mode. */
  onEnter?: () => void
  /** Called when a compartment is clicked or tapped in pick mode. */
  onSelectGroup?: (group: GroupId) => void
  /** Which compartments show their placeholder food. */
  filled?: Partial<Record<GroupId, boolean>>
  /** Swap any group color. Missing groups fall back to DEFAULT_GROUP_COLORS. */
  colors?: Partial<GroupColors>
  /** Force reduced motion on or off. Defaults to the user's prefers-reduced-motion setting. */
  reducedMotion?: boolean
  className?: string
  style?: CSSProperties
}
