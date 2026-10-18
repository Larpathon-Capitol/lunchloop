import { COMPARTMENTS, compartmentSize, TRAY } from '../geometry'
import type { Component } from './items'

/*
 * How big food should be, in model units. TrayStage scales each item by
 * `size = min(well width, well depth) * FIT`, so at size 1 the short side of a well is 1 / FIT.
 * Builders read FOOT to fill their home compartment: entrees spread across a wide footprint,
 * sides fill theirs, and the milk carton fits the round well.
 */

/** Must match the factor TrayStage.tsx uses when it sizes food for a compartment. */
const FIT = { rect: 0.8, circle: 0.86 } as const
/** Share of the usable floor (each way) that a full portion covers. */
const FILL = 0.88
/** The wall bevel narrows each opening a little at the floor. */
const LIP = TRAY.bevel * 2 + 0.03

export interface Well {
  /** Floor width and depth in model units (size 1). */
  w: number
  d: number
  round: boolean
}

function wells() {
  const out = {} as Record<Component, Well>
  for (const c of COMPARTMENTS) {
    const [w, d] = compartmentSize(c)
    const unit = Math.min(w, d) * (c.kind === 'circle' ? FIT.circle : FIT.rect)
    out[c.id] = { w: (w - LIP) / unit, d: (d - LIP) / unit, round: c.kind === 'circle' }
  }
  return out
}

/** The usable floor of each compartment, in model units. */
export const WELL: Record<Component, Well> = wells()

/** Target footprint [width, depth] of a full portion for each compartment, in model units. */
export const FOOT: Record<Component, readonly [number, number]> = Object.fromEntries(
  Object.entries(WELL).map(([id, w]) => [id, [w.w * FILL, w.d * FILL] as const]),
) as Record<Component, readonly [number, number]>
