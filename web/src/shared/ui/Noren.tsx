import { motion } from 'framer-motion'
import { useEffect, useId, useState } from 'react'
import { trayStore } from '../../tray/store'
import { noren, useNoren } from './norenStore'

/**
 * Woven indigo cloth: a fine thread pattern plus a faint slub texture, drawn over --ai.
 * Fills its positioned parent. Purely decorative.
 */
export function Cloth() {
  const id = useId().replace(/:/g, '')
  return (
    <svg className="cloth" aria-hidden="true" focusable="false" preserveAspectRatio="none">
      <defs>
        <pattern id={`${id}w`} width="6" height="6" patternUnits="userSpaceOnUse">
          {/* weft over warp, then warp over weft: the basic plain weave */}
          <rect x="0" y="0" width="3" height="1.4" fill="var(--on-ai)" opacity="0.05" />
          <rect x="3" y="3" width="3" height="1.4" fill="var(--on-ai)" opacity="0.05" />
          <rect x="3" y="0" width="1.2" height="3" fill="var(--ai-deep)" opacity="0.35" />
          <rect x="0" y="3" width="1.2" height="3" fill="var(--ai-deep)" opacity="0.35" />
        </pattern>
        <filter id={`${id}s`} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.9" numOctaves="2" seed="4" />
          <feColorMatrix values="0 0 0 0 0.93  0 0 0 0 0.91  0 0 0 0 0.86  0 0 0 0.5 -0.18" />
        </filter>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id}w)`} />
      <rect width="100%" height="100%" filter={`url(#${id}s)`} opacity="0.22" />
    </svg>
  )
}

const part = { type: 'spring', stiffness: 150, damping: 23, mass: 1 } as const
/** The curtain never holds longer than this, even if the next screen is slow. */
const HOLD_MAX_MS = 1200
/** A beat after the new screen's tray slot appears, so its content has painted. */
const SETTLE_MS = 60

/**
 * Resolves once the screen behind the curtain has mounted its own <TraySlot>, or after
 * HOLD_MAX_MS. The home slot is still registered when the curtain starts, so the new slot only
 * counts after the old one has gone away.
 */
function useNextSlotReady() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let sawGap = !trayStore.get().slot
    let settle = 0
    const finish = () => {
      window.clearTimeout(settle)
      settle = window.setTimeout(() => setReady(true), SETTLE_MS)
    }
    const check = () => {
      const slot = trayStore.get().slot
      if (!slot) sawGap = true
      else if (sawGap) {
        off()
        finish()
      }
    }
    const off = trayStore.subscribe(check)
    const cap = window.setTimeout(() => setReady(true), HOLD_MAX_MS)
    return () => {
      off()
      window.clearTimeout(cap)
      window.clearTimeout(settle)
    }
  }, [])
  return ready
}

/**
 * The curtain between the hero and the game: two cloth panels that start closed (looking exactly
 * like the hero field), hold until the game screen has its tray slot in place, then slide apart
 * left and right, so the tray glides onto real content.
 */
export function NorenCurtain() {
  const run = useNoren()
  if (!run) return null
  return <Curtain key={run} />
}

function Curtain() {
  const ready = useNextSlotReady()
  return (
    <div className="noren" aria-hidden="true">
      <motion.div
        className="noren__panel noren__panel--left"
        initial={{ x: '0%' }}
        animate={{ x: ready ? '-104%' : '0%' }}
        transition={part}
      >
        <Cloth />
      </motion.div>
      <motion.div
        className="noren__panel noren__panel--right"
        initial={{ x: '0%' }}
        animate={{ x: ready ? '104%' : '0%' }}
        transition={part}
        onAnimationComplete={() => {
          if (ready) noren.done()
        }}
      >
        <Cloth />
      </motion.div>
    </div>
  )
}
