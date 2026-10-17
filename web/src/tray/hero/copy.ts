// Words on the home hero. Sentence case, plain, no em dashes.
export const heroCopy = {
  /** The headline, read as one sentence: "Lunch you'll actually eat." The last word rotates. */
  titleStart: ['Lunch', 'you’ll', 'actually'],
  /** Rotating last word, with its period. The first one is the resting word under reduced motion. */
  titleWords: ['eat.', 'want.', 'finish.', 'crave.'],
  titleLabel: 'Lunch you’ll actually eat.',
  lead: 'Pick tomorrow’s lunch in a minute. The kitchen cooks to match, so less gets tossed.',
  cta: 'Pack tomorrow’s tray',
  staff: 'Staff and demo dashboard',
  simulated: 'Demo with a simulated school',
  hoverLabel: 'Tap the tray',
  locksIn: 'Tray locks in',
  locksLabel: (h: number, m: number) => `Tomorrow’s tray locks in ${h} hours and ${m} minutes`,
  streak: (n: number) => (n === 1 ? '1 day streak' : `${n} day streak`),
  menuLabel: 'On tomorrow’s menu',
} as const
