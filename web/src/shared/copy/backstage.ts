// Behind the scenes wording. Owned by the backstage lane.
import type { EventKind } from '../api'

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)

export const backstage = {
  title: 'Behind the scenes',
  lead: 'Watch the server work while people play. Every number on this page comes straight from the API.',
  simulatedNote: 'The menu and lunch history are a simulated school. Votes from the live demo are real taps.',
  docTitle: 'Behind the scenes | LunchLoop',

  log: {
    heading: 'Live server log',
    watching: 'Watching the server',
    paused: 'Paused while this tab is hidden',
    reconnecting: 'Can’t reach the server. Trying again.',
    loading: 'Connecting to the server…',
    empty: 'Nothing has happened yet. Open the student view on a phone and spin, and it shows up here.',
    footnote:
      'This is the server’s own memory of its newest 300 events. It is cleared when the server restarts. Players get anonymous tags, never device ids or IP addresses.',
    listLabel: 'Newest server events first',
    player: (tag: string) => `Player ${tag}`,
    ms: (ms: string) => `${ms} ms`,
    schoolLive: 'Live demo',
    schoolSimulated: 'Simulated school',
    announceOne: (summary: string) => summary,
    announceMany: (n: number, summary: string) => `${n} new events. Latest: ${summary}`,
  },

  kinds: {
    spin: 'Spin',
    vote: 'Vote',
    guess: 'Guess',
    staff_sign_in: 'Staff sign-in',
    staff_sign_in_failed: 'Sign-in failed',
    prep: 'Prep list',
    savings: 'Savings',
    simulate: 'Simulator',
    meter: 'Waste meter',
    rate_limited: 'Slowed down',
  } satisfies Record<EventKind, string>,

  counts: {
    heading: 'Since you opened this page',
    votes: (n: number) => plural(n, 'vote', 'votes'),
    guesses: (n: number) => plural(n, 'guess', 'guesses'),
    signIns: (n: number) => plural(n, 'staff sign-in', 'staff sign-ins'),
    forecasts: (n: number) => plural(n, 'forecast run', 'forecasts run'),
  },

  map: {
    heading: 'Where a request goes',
    label:
      'Diagram: a phone and the school panel both talk to the API. The API saves to the database and asks the forecast engine for numbers.',
    phone: 'Phone',
    school: 'School panel',
    api: 'API',
    database: 'Database',
    engine: 'Forecast engine',
    idle: 'Each request lights up the path it took.',
    last: (kind: string, path: string[]) => `${kind}: ${path.join(' to ')}`,
  },

  forecast: {
    heading: 'How a forecast is made',
    lead: (day: string) => `Pick a dish to see each step behind its number for ${day}.`,
    pick: 'Dish',
    loading: 'Working through the forecast…',
    prepLoading: 'Getting today’s menu…',
    empty: 'There is no menu for this day yet.',
    servings: 'servings',

    step1: (weekday: string) => `Look back at the last ${weekday}s`,
    step1Note: 'Students who took it, out of students who ate lunch that day.',
    step1Date: 'Day',
    step1Took: 'Took it',
    step1Present: 'At lunch',
    step1Rate: 'Rate',
    meanRate: 'Average rate',

    step2: 'Multiply by how many students should come',
    step2Note: (n: number, weekday: string) =>
      `Expected attendance is the average of the last ${n} ${weekday}s: `,
    predicted: 'predicted servings',
    attendanceLabel: 'students expected',

    step3: 'Check how wrong that average has been',
    step3Note: 'Each number is how far a past day landed from the plain average, in servings. Plus means more students took it than expected.',
    spread: 'Spread',
    spreadFallback: (pred: string) =>
      `Fewer than 5 past days to check, so the spread falls back to 10% of predicted (${pred}).`,

    step4: 'Decide how careful to be',
    step4Note: (ratio: string) =>
      `Running out is treated as ${ratio} times worse than one leftover serving, so the kitchen should have enough this often:`,
    serviceLevel: 'Enough this often',
    z: 'Safety factor z',
    zNote: 'How many spreads above average that is, from the normal curve.',
    buffer: 'Buffer',
    ratioLabel: 'times worse to run out',
    ratioPlusOne: 'that, plus one',
    zLabel: 'z',
    bufferLabel: (raw: string) => `buffer, ${raw} rounded up`,

    step5: 'Make this many',
    raisedToFloor: (n: string) => `That is under the ${n}-serving minimum, so the minimum wins.`,
    aboveFloor: (n: string) => `That is above the ${n}-serving minimum, so it stands.`,
    prep: 'servings to make',
    reason: 'The engine’s own explanation',
    matches: 'Same number as the kitchen prep list.',
    differs: (n: string) => `The kitchen prep list shows ${n}. Something is out of sync.`,
  },
}
