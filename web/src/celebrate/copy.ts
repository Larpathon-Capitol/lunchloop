// Strings for the reward kit. No guilt, no countdowns: every line only celebrates.

const NUMBER_WORDS: Record<number, string> = { 3: 'Three', 7: 'Seven', 10: 'Ten', 20: 'Twenty', 30: 'Thirty', 40: 'Forty', 50: 'Fifty' }

export const celebrateCopy = {
  packed: 'Packed',
  keepGoing: 'Keep going',
  streakLabel: 'day streak',
  xp: (amount: number) => `+${amount} XP`,
  xpSr: (amount: number) => `${amount} XP earned`,
  streakNow: (n: number) => `Streak is ${n}`,
  milestoneDialog: (n: number) => `${n} day streak`,
  dismissHint: 'Tap anywhere to continue',
  progressLabel: 'Progress',
  /** One short line for a milestone streak. */
  milestoneLine(streak: number): string {
    if (streak === 3) return 'Three days in a row. Nice start.'
    if (streak === 7) return 'A full week of packed trays.'
    const word = NUMBER_WORDS[streak]
    if (streak === 10) return 'Ten days. The kitchen can plan around you.'
    return word ? `${word} days of packed trays.` : `${streak} days of packed trays.`
  },
}
