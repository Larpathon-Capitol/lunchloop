// Words on the home hero. Sentence case, plain, no em dashes.
export const heroCopy = {
  /** The headline, read as one sentence: "Lunch you'll actually eat." The last word rotates. */
  titleStart: ['Lunch', 'you’ll', 'actually'],
  /** Rotating last word, with its period. The first one is the resting word under reduced motion. */
  titleWords: ['eat.', 'want.', 'finish.', 'crave.'],
  titleLabel: 'Lunch you’ll actually eat.',
  lead: 'Tell the kitchen what you want for lunch tomorrow. They plan from everyone’s picks, so less food gets thrown away.',
  cta: 'Pack tomorrow’s tray',
  staff: 'Staff and demo dashboard',
  simulated: 'Demo with a simulated school',
  hoverLabel: 'Tap the tray',
  locksIn: 'Tray locks in',
  locksLabel: (h: number, m: number) => `Tomorrow’s tray locks in ${h} hours and ${m} minutes`,
} as const
