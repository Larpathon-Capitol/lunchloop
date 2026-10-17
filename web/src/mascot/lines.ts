// What the mascot says, one book per world: Chispa is a hype-man but kind, Ume is calm and warm,
// Lafa is warm and chatty. `lines` always reads the current world's book, so screens keep using
// lines.pick, lines.encourage.fruit and so on. Short enough for a bubble. Sentence case, no em
// dashes, no emoji.
import { themeStore } from '../theme/store'
import type { ThemeId } from '../theme/types'
import type { FoodGroup } from './types'

type Greeting = { morning: string[]; afternoon: string[]; evening: string[]; late: string[] }

export interface LineBook {
  greeting: Greeting
  encourage: Record<FoodGroup, string[]>
  pick: string[]
  skip: string[]
  trayPacked: string[]
  streakKept: string[]
  milestone: string[]
  petted: string[]
  /** One-time lines for the 10th and 50th pet. */
  petMilestone: Record<number, string>
  idle: string[]
  firstVisit: string[]
}

const ume: LineBook = {
  greeting: {
    morning: [
      'Morning. Tomorrow’s tray is waiting.',
      'Good morning. Let’s pack something you’ll actually eat.',
      'Up early? Same. Rice never really sleeps.',
      'Morning. What sounds good for tomorrow?',
    ],
    afternoon: [
      'Welcome back. Tomorrow’s tray is waiting.',
      'Hey. Tomorrow’s menu just came in.',
      'Back again. I saved you a spot on the tray.',
      'Afternoon. How was lunch today?',
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
      'The entree sets the mood. Take your time.',
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
  },
  pick: ['Nice pick. That’s a good one.', 'Noted for the kitchen.', 'On the tray.', 'Good choice.', 'Mm. Solid.'],
  skip: [
    'Fair. The kitchen will cook less of that.',
    'Skipped. Less waste, zero guilt.',
    'No problem. Honest skips help too.',
    'Got it. Not your thing.',
  ],
  trayPacked: [
    'All packed. See you tomorrow.',
    'All set. Future you says thanks.',
    'Packed and stamped. Nice work.',
    'That’s a tray I’d eat. If I could eat.',
  ],
  streakKept: [
    'Streak kept. Quietly impressive.',
    'Another day on the streak.',
    'Still going. I’m proud of us.',
    'Day after day. Very steady of you.',
  ],
  milestone: ['A milestone. I’m doing a little spin.', 'Big number. You earned it.', 'Look how far you’ve come.', 'That’s a real milestone. Nice.'],
  petted: [
    'Hehe. That tickles.',
    'Mm. Do that again.',
    'You found my favorite spot.',
    'Gently. I’m mostly rice.',
    'Okay, I like you.',
  ],
  petMilestone: { 10: 'Ten pets. We’re close now.', 50: 'Fifty pets. Best friends, officially.' },
  idle: [
    'Tomorrow’s tray still has room.',
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

const chispa: LineBook = {
  greeting: {
    morning: [
      'Hey, you made it. Let’s pack tomorrow’s tray.',
      'Morning! Big lunch energy today.',
      'Good morning. Tomorrow’s menu looks good.',
      'Up and at it. Let’s lock in a tray.',
    ],
    afternoon: [
      'Hey, you made it. Let’s pack tomorrow’s tray.',
      'There you are. The menu’s in.',
      'Afternoon! Ready to call some shots?',
      'Back for more. I like that.',
    ],
    evening: [
      'Evening! One quick tray and you’re done.',
      'Hey. Let’s get tomorrow sorted.',
      'Evening crew. The kitchen reads picks tonight.',
      'Long day? This part’s the easy win.',
    ],
    late: [
      'Night owl! Quick tray, then get some sleep.',
      'Still up? Lock it in fast.',
      'Late night tray run. Love it.',
      'Pack it now and wake up ahead.',
    ],
  },
  encourage: {
    entree: [
      'Main event. What are you hyped for?',
      'Pick the entree you’d race to the line for.',
      'Which one are you actually eating? Go.',
      'The entree runs the show. Choose your star.',
    ],
    grain: [
      'Grains up. Rice, bread, tortilla?',
      'Every good plate needs a base.',
      'Pick a grain. Easy points.',
      'Base layer time. What’s it gonna be?',
    ],
    vegetable: [
      'Veggie time. Pick one you’ll really eat.',
      'Which vegetable makes the team?',
      'Green, orange, crunchy. Your call.',
      'Skipping is fine. Honest beats wasted.',
    ],
    fruit: [
      'Fruit round. Quick one.',
      'Pick the fruit you’d actually grab.',
      'Something sweet. Let’s go.',
      'Which fruit gets the spot?',
    ],
    milk: [
      'Last slot. Milk, or pass?',
      'Chocolate, plain or none? All good.',
      'Final pick. Then we celebrate.',
      'One more and you’re packed.',
    ],
  },
  pick: ['Good call. That one goes fast.', 'Ooh, great pick.', 'On the tray!', 'Locked in.', 'That’s the one.'],
  skip: [
    'Fair. Less of that gets cooked.',
    'Skipped. Honest picks win.',
    'No stress. Skips help the kitchen too.',
    'Got it. Not your thing.',
  ],
  trayPacked: [
    'Tray locked in. The kitchen’s got your back.',
    'Packed! That’s a winning tray.',
    'Done and done. See you at lunch.',
    'That tray? Championship stuff.',
  ],
  streakKept: [
    'Streak’s alive! Keep it rolling.',
    'Another day. You’re on a run.',
    'Still going. That’s how it’s done.',
    'Streak kept. I knew you would.',
  ],
  milestone: ['A milestone! Victory spin!', 'Big number. You earned that.', 'Look at you go.', 'That’s a real milestone. Huge.'],
  petted: [
    'Ha! That tickles.',
    'Okay, okay, one more.',
    'Best fan ever.',
    'Careful, I’m extra crispy.',
    'You get it.',
  ],
  petMilestone: { 10: 'Ten pets. We’re a team now.', 50: 'Fifty pets. Best friends, no question.' },
  idle: [
    'Tomorrow’s tray still has room.',
    'The vote’s still open. Get your say in.',
    'Think you can call tomorrow’s favorite?',
    'Just here. Warming up.',
    'Your picks shape what gets cooked.',
  ],
  firstVisit: [
    'Hey! I’m Chispa. Glad you’re here.',
    'I’m Chispa. I help you pack tomorrow’s lunch.',
    'Pick what you’d eat, skip what you wouldn’t. Easy.',
    'Your picks tell the kitchen what to cook. Less waste.',
    'You can pet me. I’m into it.',
  ],
}

const lafa: LineBook = {
  greeting: {
    morning: [
      'Welcome in. Let’s set tomorrow’s tray.',
      'Good morning! Have you eaten? Okay, plan first.',
      'Morning. Come, let’s see the menu together.',
      'Morning. What sounds good for tomorrow?',
    ],
    afternoon: [
      'Welcome in. Let’s set tomorrow’s tray.',
      'Hello again! The menu’s ready for you.',
      'There you are. I saved you a seat.',
      'Afternoon. Tell me, how was lunch?',
    ],
    evening: [
      'Evening! Sit, let’s plan tomorrow.',
      'Hey you. One quick tray, then rest.',
      'Evening. The kitchen reads the picks tonight.',
      'Long day? Let me make this one easy.',
    ],
    late: [
      'So late! Quick tray, then sleep.',
      'Still awake? Pack it, then go rest.',
      'Late night tray planning. I respect it.',
      'The kitchen’s closed. Your picks will wait for them.',
    ],
  },
  encourage: {
    entree: [
      'The main dish. What are you craving?',
      'Pick the entree you’d happily finish.',
      'Which one would you really eat? Be honest with me.',
      'Start with the main. The rest follows.',
    ],
    grain: [
      'Bread, rice, noodles? All good friends of mine.',
      'Every good plate starts with a base.',
      'Pick a grain. I’m a wrap, I approve of all of them.',
      'A little something filling. Which one?',
    ],
    vegetable: [
      'Pick the veggie you won’t leave behind.',
      'Something fresh. Which one speaks to you?',
      'Green things! I’m full of them.',
      'Honest picks help. Skipping is fine too.',
    ],
    fruit: [
      'Fruit next. The sweet part.',
      'Pick the fruit you’d really grab.',
      'Something sweet to finish. Nice.',
      'Which fruit would you really finish?',
    ],
    milk: [
      'Last slot. Milk, or pass?',
      'Pick a milk, or skip it. Both are honest.',
      'Chocolate, plain or none? No judgment here.',
      'Final pick, then you’re all wrapped up.',
    ],
  },
  pick: ['Ooh, yes. That’s a good one.', 'Lovely pick.', 'On the tray.', 'Good taste, my friend.', 'Yes, that one.'],
  skip: [
    'That’s fine. Less of it gets cooked.',
    'Skipped. Less waste, no guilt.',
    'No problem. Honest skips help too.',
    'Okay, not your thing. Noted.',
  ],
  trayPacked: [
    'Wrapped and ready. Thanks for helping the kitchen.',
    'All packed. What a nice tray.',
    'Done! Tomorrow’s lunch is set.',
    'Packed and stamped. Well done.',
  ],
  streakKept: [
    'Streak kept. I’m so proud of you.',
    'Another day together. I love this.',
    'Still going. Look at you.',
    'Day after day. You’re a regular now.',
  ],
  milestone: ['A milestone! Let me spin for you.', 'Such a big number. You earned it.', 'Look how far you’ve come.', 'That’s a real milestone. Wonderful.'],
  petted: [
    'Aw, thank you.',
    'Mm, that’s nice.',
    'Careful, my filling.',
    'You’re sweet, you know that?',
    'Okay, one hug back.',
  ],
  petMilestone: { 10: 'Ten pets. You’re family now.', 50: 'Fifty pets. Best friends forever.' },
  idle: [
    'Tomorrow’s tray still has room.',
    'The vote’s still open, by the way.',
    'Think you can call tomorrow’s favorite?',
    'Just here, keeping warm.',
    'Your picks shape what gets cooked.',
  ],
  firstVisit: [
    'Hello! I’m Lafa. So nice to meet you.',
    'I’m Lafa. I help you pack tomorrow’s lunch.',
    'Pick what you’d eat, skip what you wouldn’t. Simple.',
    'Your picks tell the kitchen what to cook. Less waste.',
    'You can pet me. I don’t mind at all.',
  ],
}

/** Every world's line book. */
export const LINE_BOOKS: Record<ThemeId, LineBook> = { americas: chispa, asia: ume, medi: lafa }

const book = () => LINE_BOOKS[themeStore.get()]

/** The current world's lines. Read at call time, so a world switch changes what comes next. */
export const lines: LineBook = {
  get greeting() {
    return book().greeting
  },
  get encourage() {
    return book().encourage
  },
  get pick() {
    return book().pick
  },
  get skip() {
    return book().skip
  },
  get trayPacked() {
    return book().trayPacked
  },
  get streakKept() {
    return book().streakKept
  },
  get milestone() {
    return book().milestone
  },
  get petted() {
    return book().petted
  },
  get petMilestone() {
    return book().petMilestone
  },
  get idle() {
    return book().idle
  },
  get firstVisit() {
    return book().firstVisit
  },
}

export type LineSet = keyof LineBook

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

export type TimeOfDay = keyof Greeting

export function timeOfDay(date = new Date()): TimeOfDay {
  const h = date.getHours()
  if (h >= 5 && h < 12) return 'morning'
  if (h >= 12 && h < 17) return 'afternoon'
  if (h >= 17 && h < 22) return 'evening'
  return 'late'
}

export const greetingLine = (date = new Date()) => pickLine(lines.greeting[timeOfDay(date)])
export const encourageLine = (group: FoodGroup) => pickLine(lines.encourage[group])
