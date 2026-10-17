// Student view wording. Owned by the student lane.
export const student = {
  tabs: {
    label: 'Student sections',
    today: 'Today',
    calledIt: 'Called it',
    badges: 'Badges',
  },

  stats: {
    streak: 'day streak',
    xp: 'XP',
  },

  spin: {
    heading: (slot: string, day: string) => `Pick the ${slot} for ${day}`,
    lead: 'Spin to see three choices, then vote for the one you want on the menu.',
    button: 'Spin',
    spinning: 'Spinning',
    landed: (names: string[]) => `Your choices: ${names.join(', ')}.`,
    pickFirst: 'Pick one to vote',
    choices: 'Your three choices',
    idle: 'Your three choices land here.',
    vote: (name: string) => `Vote for ${name}`,
    voting: 'Counting your vote',
    info: (name: string) => `About ${name}`,
    noVote: 'No vote today',
    noVoteBody: 'Voting opens on school days. Come back on the next one.',
  },

  voted: {
    heading: 'Vote counted',
    body: (name: string, slot: string, day: string) => `You picked ${name} as the ${slot} for ${day}.`,
    yours: 'Your vote',
    xp: (n: number) => `+${n} XP`,
    announce: (name: string, xp: number | null) => (xp ? `Vote counted. You picked ${name}. Plus ${xp} XP.` : `Vote counted. You picked ${name}.`),
    total: (n: number) => (n === 1 ? '1 vote so far today' : `${n} votes so far today`),
    votes: (n: number) => (n === 1 ? '1 vote' : `${n} votes`),
    next: 'Guess the next top entree',
    seeGuess: 'See your guess',
  },

  done: {
    heading: 'You voted today',
    body: (slot: string, day: string) =>
      `Your vote for the ${slot} on ${day} is in. A new vote opens tomorrow, so come back to keep your streak going.`,
    next: 'Guess the next top entree',
  },

  meter: {
    heading: 'Leftovers avoided in our simulated school',
    week: (day: string) => `Week of ${day}`,
    servings: 'fewer leftover servings than the usual amount',
    dollars: 'less food money wasted than the usual amount',
    unit: (n: number) => `Each tray is ${n} servings.`,
    figure: (servings: string, dollars: string, week: string) =>
      `Week of ${week}: ${servings} fewer leftover servings than the usual amount, and ${dollars} less food money wasted.`,
  },

  calledIt: {
    title: 'Called it',
    question: (day: string) => `Which entree will students pick most at lunch on ${day}?`,
    choices: 'Entrees on the menu',
    lead: 'A right guess earns 25 XP. One guess per day.',
    lock: 'Lock in my guess',
    locking: 'Locking in',
    pickFirst: 'Pick one to guess',
    lockedHeading: 'Guess locked in',
    lockedBody: (name: string, day: string) => `You picked ${name}. We score it after lunch on ${day}.`,
    already: 'This device already made today’s guess.',
    lastHeading: 'Your last guess',
    lastRight: (name: string, day: string) => `You called it. ${name} was the top entree on ${day}.`,
    lastWrong: (name: string, day: string) => `Not this time. ${name} wasn’t the top entree on ${day}.`,
    lastPending: (name: string, day: string) => `${name} for ${day}. Waiting for lunch to be served.`,
    rightXp: '+25 XP',
    noDay: 'No school day coming up to guess on. Check back soon.',
    empty: 'No entrees are on the menu for that day yet.',
  },

  badges: {
    title: 'Badges',
    earned: 'Earned',
    notYet: 'Not yet',
    streakNow: (n: number) => (n === 1 ? 'Your streak: 1 day' : `Your streak: ${n} days`),
    list: {
      streak_3: { name: '3-day streak', how: 'Vote three school days in a row.' },
      streak_7: { name: '7-day streak', how: 'Vote seven school days in a row.' },
      called_it_5: { name: 'Called it five times', how: 'Guess the top entree right five times.' },
    },
  },

  food: {
    group: 'Food group',
    allergens: 'Allergens',
    noAllergens: 'None listed',
    unknownGroup: 'Not listed',
    note: 'Confirm allergens with cafeteria staff.',
    close: 'Close',
  },

  errors: {
    alreadyVoted: 'This device already voted today.',
    notOption: 'That choice isn’t part of today’s vote. Spin again.',
    noVoting: 'There’s no vote today.',
    voteFailed: 'Your vote didn’t go through. Check your connection and try again.',
    guessFailed: 'Your guess didn’t go through. Check your connection and try again.',
  },

  loading: {
    today: 'Getting today’s spin ready…',
    calledIt: 'Loading the menu…',
    badges: 'Loading your badges…',
  },
}
