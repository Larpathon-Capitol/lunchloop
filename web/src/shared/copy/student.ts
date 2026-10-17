// Student game wording. Owned by the student lane.
export const student = {
  tabs: {
    label: 'Game sections',
    tray: 'Tray',
    vote: 'Vote',
    callIt: 'Call it',
    stamps: 'Stamps',
  },

  hud: {
    label: 'Your progress',
    streak: 'day streak',
    xp: 'XP',
    week: 'This week',
    dayActive: (day: string) => `${day}: played`,
    dayToday: (day: string) => `${day}: today, not played yet`,
    dayTodayDone: (day: string) => `${day}: today, played`,
    dayQuiet: (day: string) => `${day}`,
  },

  groups: {
    meat_alternate: 'Entree',
    grain: 'Grain',
    vegetable: 'Vegetable',
    fruit: 'Fruit',
    milk: 'Milk',
  } as Record<string, string>,

  tray: {
    heading: 'Pack tomorrow’s tray',
    headingPacked: 'Tray packed',
    forDay: (day: string) => `For ${day}`,
    chipsLabel: 'Food groups',
    choose: 'Choose',
    skipped: 'Skipped',
    chipLabel: (group: string, state: string) => `${group}: ${state}`,
    progress: 'Food groups decided',
    progressText: (done: number, total: number) => `${done} of ${total} decided`,
    left: (n: number) => (n === 1 ? 'Choose 1 more' : `Choose ${n} more`),
    needOne: 'Pick at least one food to pack',
    pack: 'Pack my tray',
    packing: 'Packing',
    packedAnnounce: (xp: number | null, streak: number) =>
      xp ? `Tray packed. Plus ${xp} XP. ${streak} day streak.` : `Tray packed. ${streak} day streak.`,
    picked: (name: string) => `${name} is on your tray.`,
    skippedAnnounce: (group: string) => `${group} skipped.`,
    noMenu: 'No lunch to pack tomorrow. Come back on the next school day.',
    loading: 'Setting out tomorrow’s tray',
    already: 'This device already packed a tray today. Here it is.',
    offline: 'Can’t reach the kitchen right now. Check your connection, then try again.',
    failed: 'Your tray didn’t go through. Try again in a moment.',
    packedSeal: 'Packed',
  },

  picker: {
    close: 'Close',
    items: (group: string) => `${group} choices`,
    contains: (list: string) => `Contains ${list}`,
    noAllergens: 'No listed allergens',
    info: (name: string) => `Allergen note for ${name}`,
    note: 'Confirm allergens with cafeteria staff.',
    current: 'On your tray',
    skip: 'Skip this one',
    skipLine: 'Honest skips help the kitchen cook less.',
  },

  reveal: {
    heading: 'What everyone packed',
    total: (n: number) => (n === 1 ? '1 tray packed so far today' : `${n} trays packed so far today`),
    you: 'You',
    skippedBy: (n: number) => (n === 1 ? 'Skipped by 1' : `Skipped by ${n}`),
    share: (name: string, pct: number) => `${name}, ${pct} percent`,
  },

  quests: {
    heading: 'Today’s quests',
    pack: 'Pack your tray',
    vote: 'Vote on a future entree',
    callIt: 'Call tomorrow’s top entree',
    done: 'Done',
    todo: 'Not yet',
  },

  spin: {
    heading: (slot: string, day: string) => `Pick the ${slot} for ${day}`,
    lead: 'Spin for three choices, then vote for the one you want on the menu.',
    button: 'Spin',
    spinning: 'Spinning',
    landed: (names: string[]) => `Your choices: ${names.join(', ')}.`,
    pickFirst: 'Pick one to vote',
    choices: 'Your three choices',
    idle: 'Three entrees land here.',
    vote: (name: string) => `Vote for ${name}`,
    voting: 'Counting your vote',
    info: (name: string) => `About ${name}`,
    noVote: 'No vote today',
    noVoteBody: 'Voting opens on school days. Come back on the next one.',
  },

  voted: {
    heading: 'Vote counted',
    body: (name: string, slot: string, day: string) => `You picked ${name} as the ${slot} for ${day}.`,
    yours: 'You',
    xp: (n: number) => `+${n} XP`,
    announce: (name: string, xp: number | null) => (xp ? `Vote counted. You picked ${name}. Plus ${xp} XP.` : `Vote counted. You picked ${name}.`),
    total: (n: number) => (n === 1 ? '1 vote so far today' : `${n} votes so far today`),
    votes: (n: number) => (n === 1 ? '1 vote' : `${n} votes`),
    next: 'Call tomorrow’s top entree',
    seeGuess: 'See your call',
  },

  done: {
    heading: 'You voted today',
    body: (slot: string, day: string) => `Your vote for the ${slot} on ${day} is in. A new vote opens on the next school day.`,
  },

  meter: {
    heading: 'Leftovers avoided in our simulated school',
    week: (day: string) => `Week of ${day}`,
    servings: 'fewer leftover servings than the usual amount',
    dollars: 'saved, even after counting the times it ran short',
    unit: (n: number) => `Each tray is ${n} servings.`,
    figure: (servings: string, dollars: string | null, week: string) =>
      dollars
        ? `Week of ${week}: ${servings} fewer leftover servings than the usual amount, and ${dollars} saved, even after counting the times it ran short.`
        : `Week of ${week}: ${servings} fewer leftover servings than the usual amount.`,
  },

  calledIt: {
    title: 'Call it',
    question: (day: string) => `Which entree will students pick most on ${day}?`,
    choices: 'Entrees on the menu',
    lead: 'A right call earns 25 XP. One call per day.',
    lock: 'Lock in my call',
    locking: 'Locking in',
    pickFirst: 'Pick one to call',
    lockedHeading: 'Call locked in',
    lockedBody: (name: string, day: string) => `You called ${name}. We score it after lunch on ${day}.`,
    already: 'This device already made today’s call.',
    lastHeading: 'Your last call',
    sealRight: 'Called it',
    sealWrong: 'Not this time',
    sealPending: 'Waiting for lunch',
    lastRight: (name: string, day: string) => `${name} was the top entree on ${day}.`,
    lastWrong: (name: string, day: string) => `${name} wasn’t the top pick on ${day}. Tomorrow is a fresh call.`,
    lastPending: (name: string, day: string) => `${name} for ${day}. We score it after lunch.`,
    rightXp: '+25 XP',
    noDay: 'No school day coming up to call. Check back soon.',
    empty: 'No entrees are on the menu for that day yet.',
  },

  stamps: {
    title: 'Stamps',
    earned: 'Earned',
    notYet: 'Not yet',
    totals: 'Your totals',
    xp: 'XP',
    streak: 'day streak',
    pets: (n: number) => (n === 1 ? 'pet for Ume' : 'pets for Ume'),
    list: {
      streak_3: { name: 'Three day streak', seal: '3 days', how: 'Keep a 3 day streak' },
      streak_7: { name: 'Seven day streak', seal: '7 days', how: 'Keep a 7 day streak' },
      called_it_5: { name: 'Called it five times', seal: 'Caller', how: 'Call the top entree 5 times' },
    },
    rule: 'A day counts when you pack a tray or vote.',
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
    guessFailed: 'Your call didn’t go through. Check your connection and try again.',
  },

  loading: {
    today: 'Getting today’s spin ready',
    calledIt: 'Loading the menu',
    badges: 'Loading your stamps',
  },
}
