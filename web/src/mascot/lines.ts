// Ume's voice: warm, a little cheeky, never guilt-trippy. Short enough for a bubble.
// Sentence case, no em dashes, no emoji.
import type { FoodGroup } from './types'

export const lines = {
  greeting: {
    morning: [
      'Morning. Tomorrow’s tray is waiting.',
      'Good morning. Let’s pack something you’ll actually eat.',
      'Up early? Same. Rice never really sleeps.',
      'Morning. What sounds good for tomorrow?',
    ],
    afternoon: [
      'Afternoon. How was lunch today?',
      'Hey. Tomorrow’s menu just came in.',
      'Back again. I saved you a spot on the tray.',
      'Afternoon. Let’s plan a lunch worth showing up for.',
    ],
    evening: [
      'Evening. Quick tray before you forget?',
      'Hey. Packing tomorrow’s lunch takes a minute.',
      'Evening. The kitchen reads the picks tonight.',
      'Long day? Let’s keep this one easy.',
    ],
    late: [
      'Up late? Me too. Quick tray, then sleep.',
      'Still awake? Pack it fast and go rest.',
      'Late night tray packing. Respect.',
      'The kitchen’s asleep. Your picks will be there by morning.',
    ],
  },
  encourage: {
    entree: [
      'Main event. What are you actually in the mood for?',
      'Pick the entree you’d trade a snack for.',
      'Which one would you really eat? Be honest.',
      'The entree sets the vibe. Choose wisely.',
    ],
    grain: [
      'Rice, bread or noodles? I might be biased.',
      'Grains next. I have opinions.',
      'Every good tray needs a base. Pick one.',
      'Pick a grain. No pressure. Okay, a little.',
    ],
    vegetable: [
      'Pick the veggie you won’t push around the tray.',
      'Which vegetable has a real chance with you?',
      'Something green? Or orange. I’m flexible.',
      'Honest picks help here. Skipping is fine too.',
    ],
    fruit: [
      'Fruit round. Easy one.',
      'Pick the fruit you’d actually grab.',
      'Sweet stuff next. The good kind.',
      'Which fruit would you really finish?',
    ],
    milk: [
      'Last slot. Milk, or pass?',
      'Pick a milk, or skip it. Both are honest.',
      'Chocolate, plain or none? No judgment.',
      'Final pick. Then you’re packed.',
    ],
  } satisfies Record<FoodGroup, string[]>,
  pick: [
    'Good choice. Noted for the kitchen.',
    'Ooh, solid pick.',
    'On the tray.',
    'Locked in.',
    'Great taste. Obviously.',
  ],
  skip: [
    'Fair. The kitchen will cook less of that.',
    'Skipped. Less waste, zero guilt.',
    'No problem. Honest skips help too.',
    'Got it. Not your thing.',
    'Passing is a valid move.',
  ],
  trayPacked: [
    'Tray packed. See you at lunch.',
    'All set. Tomorrow you says thanks.',
    'Packed and stamped. Nice work.',
    'That’s a tray I’d eat. If I could eat.',
    'Done. The kitchen knows what you want.',
  ],
  streakKept: [
    'Streak kept. Look at you.',
    'Another day on the streak.',
    'Still going. I’m proud of us.',
    'Streak’s alive. Nicely done.',
    'Day after day. Very consistent of you.',
  ],
  milestone: [
    'A milestone. I’m doing a little spin.',
    'Big number. You earned it.',
    'Look how far you’ve come.',
    'That’s a real milestone. Nice.',
    'Okay, that’s impressive.',
  ],
  petted: [
    'Hehe. That tickles.',
    'Mm. Do that again.',
    'You found my favorite spot.',
    'Gently. I’m mostly rice.',
    'Okay, I like you.',
    'Purr. Rice balls can purr, right?',
  ],
  /** One-time lines for the 10th and 50th pet. */
  petMilestone: {
    10: 'Ten pets. We’re close now.',
    50: 'Fifty pets. Best friends, officially.',
  } as Record<number, string>,
  idle: [
    'Tomorrow’s tray still has room.',
    'Psst. Lunch won’t pack itself.',
    'The vote’s still open, by the way.',
    'Think you can call tomorrow’s favorite?',
    'Just sitting here. Being a rice ball.',
    'Your picks shape what gets cooked.',
  ],
  firstVisit: [
    'Hi, I’m Ume. Nice to meet you.',
    'I’m Ume. I help you pack tomorrow’s lunch.',
    'Pick what you’d eat, skip what you wouldn’t. That’s it.',
    'Your picks tell the kitchen what to cook. Less waste.',
    'You can pet me, by the way. I don’t mind.',
  ],
}

export type LineSet = keyof typeof lines

let lastLine = ''

/** A random line from a list, never the same line twice in a row. */
export function pickLine(list: readonly string[]): string {
  if (list.length === 0) return ''
  if (list.length === 1) return list[0]
  let line = list[Math.floor(Math.random() * list.length)]
  if (line === lastLine) line = list[(list.indexOf(line) + 1) % list.length]
  lastLine = line
  return line
}

export type TimeOfDay = keyof typeof lines.greeting

export function timeOfDay(date = new Date()): TimeOfDay {
  const h = date.getHours()
  if (h >= 5 && h < 12) return 'morning'
  if (h >= 12 && h < 17) return 'afternoon'
  if (h >= 17 && h < 22) return 'evening'
  return 'late'
}

export const greetingLine = (date = new Date()) => pickLine(lines.greeting[timeOfDay(date)])
export const encourageLine = (group: FoodGroup) => pickLine(lines.encourage[group])
