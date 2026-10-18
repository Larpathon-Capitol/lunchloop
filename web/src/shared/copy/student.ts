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
    dayAhead: (day: string) => `${day}: still ahead`,
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
    needOne: 'Pick at least one food to pack',
    next: (group: string) => `Choose your ${group.toLowerCase()}`,
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
    /** Names the future day plainly: "Vote for lunch on Thursday, Oct 29". */
    heading: (day: string) => `Vote for lunch on ${day}`,
    /** How far off that day is, from today's date. */
    when: (schoolDays: number, tomorrow: boolean) =>
      tomorrow ? 'Tomorrow' : schoolDays <= 1 ? 'Next school day' : `In ${schoolDays} school days`,
    /** Under the ballot: "Your pick will be served Thu, Oct 29". */
    served: (day: string) => `Your pick will be served ${day}`,
    lead: 'Spin through every entree. Four land on the ballot, and at least one is always vegetarian.',
    button: 'Spin',
    spinning: 'Spinning',
    landed: (names: string[]) => `Your choices: ${names.join(', ')}.`,
    pickFirst: 'Pick one to vote',
    choices: 'Your four choices',
    idle: 'Four entrees land here.',
    vote: (name: string) => `Vote for ${name}`,
    voting: 'Counting your vote',
    info: (name: string) => `About ${name}`,
    noVote: 'No vote today',
    noVoteBody: 'Voting opens on school days. Come back on the next one.',
  },

  voted: {
    heading: 'Vote counted',
    body: (name: string, day: string) => `You voted for ${name} for ${day}.`,
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
    body: (day: string) => `Your vote for lunch on ${day} is in. A new vote opens on the next school day.`,
  },

  food: {
    group: 'Food group',
    allergens: 'Allergens',
    noAllergens: 'None listed',
    unknownGroup: 'Not listed',
    note: 'Confirm allergens with cafeteria staff.',
    close: 'Close',
  },

  diet: {
    vegetarian: 'Vegetarian',
    vegan: 'Vegan',
    spicy: 'Spicy',
    beef: 'Contains beef',
    pork: 'Contains pork',
    glutenFree: 'Gluten-free',
    dairyFree: 'Dairy-free',
    /** The allergen line on a food: "Has milk, wheat". */
    has: (list: string) => `Has ${list}`,
    /** The allergen line when the needs warning already named some: "Also has wheat". */
    alsoHas: (list: string) => `Also has ${list}`,
    noAllergens: 'No listed allergens',
    label: 'Diet',
    fits: 'Fits you',
    unknown: 'Diet info not listed',
    /** Why a food doesn't fit, joined into one line: "Not vegetarian, has milk". */
    miss: {
      vegetarian: 'Not vegetarian',
      vegan: 'Not vegan',
      no_pork: 'Has pork',
      no_beef: 'Has beef',
      gluten_free: 'Not gluten-free',
      dairy_free: 'Not dairy-free',
      not_spicy: 'Spicy',
    } as Record<string, string>,
    hasAllergy: (list: string) => `has ${list}`,
  },

  needs: {
    button: 'My needs',
    buttonCount: (n: number) => (n === 1 ? 'My needs, 1 set' : `My needs, ${n} set`),
    title: 'My needs',
    lead: 'Tell us what you eat and what you avoid. We flag foods that don’t fit, and you still decide.',
    dietHeading: 'What I eat',
    allergyHeading: 'Allergies',
    options: {
      vegetarian: 'Vegetarian',
      vegan: 'Vegan',
      no_pork: 'No pork',
      no_beef: 'No beef',
      gluten_free: 'Gluten-free',
      dairy_free: 'Dairy-free',
      not_spicy: 'Not spicy',
    } as Record<string, string>,
    saved: 'Saved on this device only.',
    note: 'We go by the school’s allergen list. Always check with cafeteria staff.',
    clear: 'Clear all',
    done: 'Done',
    mascot: 'Got it. I’ll flag anything that doesn’t fit you.',
    mascotCleared: 'All clear. Every food shows as usual.',
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
