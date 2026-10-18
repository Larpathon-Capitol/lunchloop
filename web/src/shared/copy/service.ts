// Words for the compact staff Lunch service panel. Older strings stay in copy/free.ts.

const n = (count: number, one: string, many: string) => (count === 1 ? `1 ${one}` : `${count} ${many}`)

export const service = {
  sub: 'Today’s check-ins and what is left to give away.',

  /** The one-line takeaway above the check-in bar. */
  takeaway: (packed: number, checkedIn: number, missed: number) => {
    if (checkedIn === 0) return 'No one has checked in yet'
    if (missed > 0) return `${n(missed, 'student', 'students')} said something ran out`
    if (checkedIn === packed) return 'Everyone got what they packed'
    return 'Everyone so far got what they packed'
  },
  kpiOf: (packed: number) => `of ${packed}`,
  kpiLabel: 'checked in',
  legendGot: (count: number) => `${count} got their picks`,
  legendMissed: (count: number) => `${count} ran out`,
  legendWaiting: (count: number) => `${count} not checked in`,
  barAlt: (packed: number, checkedIn: number, got: number, missed: number) =>
    `${checkedIn} of ${n(packed, 'student', 'students')} checked in: ${got} got their picks, ${missed} said something ran out, ${packed - checkedIn} not checked in yet.`,

  listLabel: 'Foods most likely to have leftovers',
  listCaption: 'Likely leftovers: did not run out, most still waiting first. Numbers show how many packed each.',
  listEmpty: 'Every food ran out for someone today, so there is little left to give away.',
  ranOutLabel: 'Ran out:',
  ranOutCount: (n: number) => (n === 1 ? '(1 student missed it)' : `(${n} students missed it)`),
  nobody: 'Nobody packed this',

  makeFree: 'Make free',
  undo: 'Undo',
  free: 'Free',
  freeSince: (time: string) => `Free since ${time}`,

  showAll: (hidden: number, nobody: number) => {
    if (nobody === hidden) return `Show ${n(hidden, 'more food', 'more foods')} nobody packed`
    if (nobody === 0) return `Show ${n(hidden, 'more food', 'more foods')}`
    return `Show ${n(hidden, 'more food', 'more foods')} (${nobody} nobody packed)`
  },
  showFewer: 'Show fewer',
}
