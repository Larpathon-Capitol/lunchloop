// A sakura sprig for a section corner. Sits in the top right by default; callers move it
// with className or style.
import { useReducedMotion } from 'framer-motion'
import type { ArtProps } from '../../types'
import { Branch } from './art'
import { CORNER_BRANCH } from './branches'
import { useDocHidden } from './useDocHidden'
import './asia.css'

export function Corner({ className, style }: ArtProps) {
  const reduce = useReducedMotion()
  const hidden = useDocHidden()
  return (
    <div className={`ka ka-corner${className ? ` ${className}` : ''}`} style={style} data-paused={hidden || undefined} aria-hidden="true">
      <div className={reduce ? 'ka-corner__sway' : 'ka-corner__sway ka-loop'}>
        <Branch art={CORNER_BRANCH} />
      </div>
    </div>
  )
}
