// The stamp book's catalog: every stamp, the group it sits in, its shape, and how far a player
// has got toward it. Earned comes from the server's badge list; progress comes from the newer
// `stamp_counts` block on /api/me when the server sends it, else from fields /api/me already had.
import type { Me, StampCounts } from '../../shared/api'
import { stamps as t } from '../../shared/copy/stamps'
import type { ShapeId } from './shapes'

export type { StampCounts }

export type StampId = keyof typeof t.list
export type GroupId = keyof typeof t.groups
type Unit = keyof typeof t.units

interface StampDef {
  id: StampId
  group: GroupId
  shape: ShapeId
  /** Which of the world's three stamp colors it is inked in. */
  tone: 0 | 1 | 2
  goal: number
  unit: Unit
  /** How far along the player is right now, or null when this server can't say. */
  count: (me: Me, counts: StampCounts | null) => number | null
}

const once = (earned: boolean) => (earned ? 1 : 0)

export const STAMPS: readonly StampDef[] = [
  { id: 'streak_3', group: 'streaks', shape: 'circle', tone: 0, goal: 3, unit: 'days', count: (me) => me.streak },
  { id: 'streak_7', group: 'streaks', shape: 'rosette', tone: 1, goal: 7, unit: 'days', count: (me) => me.streak },
  { id: 'streak_10', group: 'streaks', shape: 'burst', tone: 2, goal: 10, unit: 'days', count: (me) => me.streak },
  { id: 'first_tray', group: 'packing', shape: 'postage', tone: 1, goal: 1, unit: 'trays', count: (me, c) => c?.trays ?? once(me.packed_today) },
  { id: 'trays_5', group: 'packing', shape: 'hexagon', tone: 0, goal: 5, unit: 'trays', count: (_, c) => c?.trays ?? null },
  { id: 'explorer_4', group: 'packing', shape: 'ticket', tone: 2, goal: 4, unit: 'entrees', count: (_, c) => c?.entrees ?? null },
  { id: 'first_checkin', group: 'packing', shape: 'square', tone: 0, goal: 1, unit: 'checkins', count: (me, c) => c?.checkins ?? once(me.badges.includes('first_checkin')) },
  { id: 'first_vote', group: 'voting', shape: 'shield', tone: 2, goal: 1, unit: 'votes', count: (me, c) => c?.votes ?? once(me.voted_today) },
  { id: 'votes_5', group: 'voting', shape: 'arch', tone: 1, goal: 5, unit: 'votes', count: (_, c) => c?.votes ?? null },
  { id: 'first_call', group: 'calling', shape: 'octagon', tone: 0, goal: 1, unit: 'calls', count: (me, c) => c?.calls ?? once(!!me.last_guess) },
  { id: 'called_it_1', group: 'calling', shape: 'diamond', tone: 1, goal: 1, unit: 'rightCalls', count: (me, c) => c?.correct_calls ?? me.correct_calls ?? null },
  { id: 'called_it_5', group: 'calling', shape: 'star', tone: 2, goal: 5, unit: 'rightCalls', count: (me, c) => c?.correct_calls ?? me.correct_calls ?? null },
]

export const GROUPS: readonly GroupId[] = ['streaks', 'packing', 'voting', 'calling']

export interface StampView extends StampDef {
  earned: boolean
  /** Progress clamped to the goal; 0 when unknown. */
  have: number
}

function countsOf(me: Me): StampCounts | null {
  return me.stamp_counts ?? null
}

/**
 * The stamps this player can see. A stamp is earned when the server lists it, or when /api/me
 * already shows the goal was reached (so the book is right on a server without the newer badges).
 * Stamps whose progress this server can't report are left out rather than shown as 0.
 */
export function stampsFor(me: Me): StampView[] {
  const counts = countsOf(me)
  const out: StampView[] = []
  for (const def of STAMPS) {
    const n = def.count(me, counts)
    const earned = me.badges.includes(def.id) || (n !== null && n >= def.goal)
    if (n === null && !earned) continue
    out.push({ ...def, earned, have: earned ? def.goal : Math.max(0, Math.min(n ?? 0, def.goal)) })
  }
  return out
}
