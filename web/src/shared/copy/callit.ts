// Words for the Call it tab: the choosing screen, the sealed call card and the scored result.
// The card and the mascot's lines change with the world: a loteria card for Chispa, an omikuji
// fortune slip for Ume, a sealed tile postcard for Lafa. Sentence case, no em dashes, no emoji.
import type { ThemeId } from '../../theme/types'

export interface CardWords {
  /** What the card is called, for screen readers ("loteria card"). */
  kind: string
  /** Small line at the top of the card. */
  top: string
  /** Shown on the blank card before a pick. */
  blank: string
  /** The world seal's word once the call is locked. */
  seal: string
  /** The line the mascot keeps beside a locked call. */
  guard: string[]
  /** Said once, the moment the call locks. */
  hype: string[]
  /** Beside a scored call. */
  right: string[]
  wrong: string[]
  waiting: string[]
}

export const callit = {
  title: 'Call it',
  /** Kicker above the question. */
  kicker: (day: string, tomorrow: boolean) => (tomorrow ? `Tomorrow, ${day}` : day),
  question: 'Which entree wins?',
  lead: 'Guess the entree most students pick. A right call earns 25 XP. One call per day.',
  lock: 'Lock in my call',
  /** The lock button once a pick is made: says which one, like the Vote button does. */
  lockName: (name: string) => `Lock in ${name}`,
  /** Phones: the lead, shorter. */
  leadShort: 'Guess the top pick. A right call earns 25 XP.',
  locking: 'Locking in',
  pickFirst: 'Pick one to call',
  already: 'This device already made today’s call.',
  /** Under the blank card on the choosing screen. */
  yourCall: 'Your call',

  lockedHeading: 'Call locked in',
  lockedBody: (name: string) => `You called ${name}.`,
  /** The countdown to scoring, in school days. */
  countNumber: (n: number) => String(n),
  countUnit: (n: number) => (n === 1 ? 'school day to go' : 'school days to go'),
  countToday: 'Scored today',
  scoredOn: (day: string) => `Scored after lunch on ${day}.`,
  /** Attribution under the mascot's line. */
  says: (name: string) => `${name}, keeping watch`,

  record: {
    heading: 'Your caller record',
    /** "2 of 5 right calls toward the Caller stamp". */
    toward: (n: number, of: number) => `${n} of ${of} right calls toward the Caller stamp`,
    earned: (n: number) => (n === 1 ? 'Caller stamp earned. 1 right call so far.' : `Caller stamp earned. ${n} right calls so far.`),
    earnedNoCount: 'Caller stamp earned.',
  },

  last: {
    heading: 'Your last call',
    right: (name: string, day: string) => `${name} was the top entree on ${day}.`,
    wrong: (name: string, day: string) => `${name} wasn’t the top pick on ${day}.`,
    pending: (name: string, day: string) => `${name} for ${day}. We score it after lunch.`,
    sealRight: 'Called it',
    sealWrong: 'Not this time',
    sealPending: 'Waiting for lunch',
    xp: '+25 XP',
  },

  noDay: 'No school day coming up to call. Check back soon.',
  empty: 'No entrees are on the menu for that day yet.',

  cards: {
    americas: {
      kind: 'Loteria card',
      top: 'La llamada',
      blank: 'Pick an entree',
      seal: 'Called',
      guard: [
        'Nobody touches this card. I’m on guard till lunch.',
        'Bold call. I’d bet my crispy skin on it.',
        'Locked and loaded. Now we wait for lunch.',
      ],
      hype: ['Locked in! Great call.', 'Ooh, bold. I like it.', 'That card is ours now.'],
      right: ['Called it! I knew you had it.', 'Winner! Victory spin for you.'],
      wrong: ['Close one. We get it back next time.', 'Not this round. Shake it off, call again.'],
      waiting: ['Still waiting on lunch. I’m watching it.'],
    },
    asia: {
      kind: 'Omikuji fortune slip',
      top: 'Omikuji',
      blank: 'Draw your fortune',
      seal: 'Called',
      guard: [
        'Your fortune is folded and safe. I’ll keep it till lunch.',
        'A good call. Now we wait, quietly.',
        'I tied it to the branch for luck. Not that you need it.',
      ],
      hype: ['Fortune drawn. Nice.', 'Sealed. Very calm of you.', 'Good call. I felt it too.'],
      right: ['You read the room. Well done.', 'Great luck, as promised.'],
      wrong: ['Not this time. Tomorrow is a new slip.', 'Small luck today. That’s still luck.'],
      waiting: ['Still waiting on lunch. Patience.'],
    },
    medi: {
      kind: 'Sealed tile postcard',
      top: 'Sealed call',
      blank: 'Choose your call',
      seal: 'Sealed',
      guard: [
        'Sealed with care. I’ll keep it warm until lunch.',
        'Ooh, I have a good feeling about this one.',
        'I won’t peek. Okay, I might peek a little.',
      ],
      hype: ['Sealed! Lovely call.', 'Ooh, good taste, my friend.', 'Into the envelope it goes.'],
      right: ['You were right! I’m so proud of you.', 'Look at you. A true caller.'],
      wrong: ['Ah, not this time. Come back tomorrow, okay?', 'Close! The next one is yours.'],
      waiting: ['Still waiting on lunch. I’m keeping it warm.'],
    },
  } satisfies Record<ThemeId, CardWords>,
}

/** A stable pick from a list for a given key (a date), so a line doesn't change on every render. */
export function stableLine(list: readonly string[], key: string): string {
  if (list.length === 0) return ''
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0
  return list[Math.abs(h) % list.length]
}
