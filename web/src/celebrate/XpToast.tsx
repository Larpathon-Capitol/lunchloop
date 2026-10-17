import { useEffect } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { sound } from '../shared/sound'
import { celebrateCopy } from './copy'
import './celebrate.css'

export interface XpToastProps {
  amount: number
  onDone?: () => void
  /** Play the soft pluck as the token pops. Default false: the orchestrator sequences sound. */
  sound?: boolean
  className?: string
}

/** A small gold "+10 XP" token. It pops, then floats up 24px while fading. Place it with CSS where you want it. */
export function XpToast({ amount, onDone, sound: withSound = false, className }: XpToastProps) {
  const reduce = useReducedMotion()

  useEffect(() => {
    if (withSound) sound.pluck(5)
  }, [withSound])

  return (
    <motion.span
      className={`xp-toast${className ? ` ${className}` : ''}`}
      role="status"
      aria-label={celebrateCopy.xpSr(amount)}
      initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.55, y: 4 }}
      animate={
        reduce
          ? { opacity: [0, 1, 1, 0] }
          : { opacity: [0, 1, 1, 0], scale: [0.55, 1.12, 1, 1], y: [4, 0, -4, -24] }
      }
      transition={
        reduce
          ? { duration: 1.1, times: [0, 0.1, 0.8, 1] }
          : { duration: 1.25, times: [0, 0.16, 0.5, 1], ease: ['easeOut', 'linear', [0.2, 0.72, 0.16, 1]] }
      }
      onAnimationComplete={onDone}
    >
      <span aria-hidden="true">{celebrateCopy.xp(amount)}</span>
    </motion.span>
  )
}
