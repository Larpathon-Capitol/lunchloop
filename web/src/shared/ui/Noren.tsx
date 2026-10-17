// The curtain host between the hero and the game. Home starts a run with noren.part(); this
// mounts the current world's kit.Curtain fresh for that run, tells it when the game screen is
// ready behind it, and ends the run when the curtain says it is off screen.
import { useCallback, useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { useKit } from '../../theme/registry'
import { trayStore } from '../../tray/store'
import { noren, useNoren } from './norenStore'

/**
 * Woven cloth texture: a fine thread pattern plus a faint slub, drawn in the current ink over
 * whatever its parent paints. Fills its positioned parent. Purely decorative. Kept for the
 * screens that still draw the v1 header band.
 */
export function Cloth() {
  const id = useId().replace(/:/g, '')
  return (
    <svg className="cloth" aria-hidden="true" focusable="false" preserveAspectRatio="none">
      <defs>
        <pattern id={`${id}w`} width="6" height="6" patternUnits="userSpaceOnUse">
          {/* weft over warp, then warp over weft: the basic plain weave */}
          <rect x="0" y="0" width="3" height="1.4" fill="#fff" opacity="0.05" />
          <rect x="3" y="3" width="3" height="1.4" fill="#fff" opacity="0.05" />
          <rect x="3" y="0" width="1.2" height="3" fill="#000" opacity="0.12" />
          <rect x="0" y="3" width="1.2" height="3" fill="#000" opacity="0.12" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id}w)`} />
    </svg>
  )
}

/** The curtain never holds longer than this, even if the next screen is slow. */
const HOLD_MAX_MS = 1200
/** A beat after the new screen's tray slot appears, so its content has painted. */
const SETTLE_MS = 60
/** If a world's curtain never reports back (or draws nothing), the run ends anyway. */
const DONE_MAX_MS = 1800

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

// Sits at layer 3, under the raised tray stage (4), over the page. Inline so it does not depend
// on any stylesheet loading first.
const LAYER: CSSProperties = { position: 'fixed', inset: 0, zIndex: 3, pointerEvents: 'none', overflow: 'hidden' }

/**
 * Draws the hero to game curtain while a run is active. Mount once, in the shell.
 * The tray stage lifts itself above it while it is up, so the tray stays in view the whole way.
 */
export function NorenCurtain() {
  const run = useNoren()
  if (!run) return null
  return <CurtainRun key={run} />
}

function CurtainRun() {
  const kit = useKit()
  // The world is fixed for the length of a run, even if it changes underneath.
  const [Curtain] = useState(() => kit.Curtain)
  const ready = useNextSlotReady()
  const ended = useRef(false)
  const end = useCallback(() => {
    if (ended.current) return
    ended.current = true
    noren.done()
  }, [])
  useEffect(() => {
    if (!ready) return
    const t = window.setTimeout(end, DONE_MAX_MS)
    return () => window.clearTimeout(t)
  }, [ready, end])
  return (
    <div className="noren-host" style={LAYER} aria-hidden="true">
      <Curtain ready={ready} onDone={end} />
    </div>
  )
}
