// Words for the School panel: sign-in, what students want, and the sub-nav.
export const school = {
  navWants: 'What students want',
  navKitchen: 'Kitchen',
  navService: 'Lunch service',
  subNavLabel: 'School sections',
  signOut: 'Sign out',

  signIn: {
    title: 'School sign-in',
    lead: 'See what your students want for lunch.',
    schoolLabel: 'School',
    passwordLabel: 'Password',
    submit: 'Sign in',
    submitting: 'Signing in…',
    demoButton: 'Open the demo school',
    demoNote: (password: string) => `Judges: the demo school’s password is ${password}.`,
    expired: 'Your sign-in ran out. Sign in again.',
    wrongPassword: 'That password doesn’t match this school.',
    tooMany: 'Too many tries. Wait a few minutes, then try again.',
    schoolsLoading: 'Loading schools…',
  },

  live: {
    name: 'LunchLoop live demo',
    title: 'Live demo sign-in',
    lead: 'See what the people in the room are voting for, as they vote.',
    note: 'Real votes from real people.',
  },

  wants: {
    title: 'What students want',
    loading: 'Loading what students want…',
    live: 'Updates on its own while this tab is open.',
    stale: 'Can’t refresh right now. Showing the last numbers.',
    noVoteOpen: 'No vote is open today.',
    todayHeading: 'Today’s vote',
    todaySub: (slot: string, day: string) => `Students are choosing the ${slot} for ${day}.`,
    votes: (n: number) => (n === 1 ? '1 vote' : `${n} votes`),
    share: (pct: number) => `${pct}%`,
    copyLink: 'Copy student link',
    copied: 'Link copied',
    copyFailed: 'Couldn’t copy. Select this link instead:',
    linkLabel: 'Student link',

    tray: {
      heading: 'Tomorrow’s trays',
      sub: (day: string) => `What students packed for ${day}.`,
      empty: 'No trays packed yet today. Share the student link to get the first ones.',
      groups: {
        meat_alternate: 'Main dish',
        grain: 'Grain',
        vegetable: 'Vegetable',
        fruit: 'Fruit',
        milk: 'Milk',
      },
    },

    peopleHeading: 'Participation',
    ofPlayers: (n: string) => `of ${n} players`,

    guessesHeading: 'Called it guesses',
    guessesSub: (day: string) => `Guesses for ${day}, most guessed first.`,
    guessesEmpty: 'No guesses yet today.',

    recentHeading: 'Recent vote days',
    recentRow: (open: string, target: string) => `Voted ${open} for ${target}`,
    recentEmpty: 'No earlier vote days at this school yet.',

    pastHeading: 'Past winners',
    pastSub: 'Simulated history from the menu records, not votes cast in this app.',
    pastEmpty: 'No history to show.',

    // Summary tiles at the top of the page
    kpiLabel: 'At a glance',
    kpi: {
      trays: 'Trays for tomorrow',
      traysNone: 'None packed yet',
      votes: 'Votes today',
      votesSpark: (days: number) => `Votes on the last ${days} vote days, then today`,
      votesFoot: (days: number) =>
        days > 1 ? `vs the last ${days} vote days` : days === 1 ? 'vs the last vote day' : 'First vote day here',
      active: 'Active this week',
      activeFoot: (n: string, players: string) => `${n} of ${players} players voted`,
      leader: 'Leading entree',
      leaderFoot: (pct: number) => `${pct}% of today’s votes`,
      leaderNone: 'No votes yet',
      leaderNoneFoot: 'Waiting for the first vote',
      leaderTied: (pct: number) => `Tied at ${pct}%`,
    },

    // Chart titles that say the takeaway
    voteTitle: {
      none: 'No vote is open today',
      empty: 'No votes yet',
      lead: (name: string, day: string) => `${name} is winning the vote for ${day}`,
      tie: (names: string, day: string) => `${names} are tied for ${day}`,
    },
    voteEmpty: 'Share the student link. The bars fill in here as students vote.',
    leading: 'Leading',
    and: (a: string, b: string) => `${a} and ${b}`,

    peopleTitle: (pct: number) => `${pct}% of players voted in the last 5 school days`,
    peopleTitleNone: 'No players have joined yet',
    joined: 'Joined LunchLoop',
    last5Short: 'Last 5 school days',
    todayShort: 'Today',
    ofBase: (n: string, base: string) => `${n} of ${base}`,
    studentsWord: 'students',
    playersWord: 'players',

    trayTitle: (n: number, day: string) => `${n} ${n === 1 ? 'tray' : 'trays'} packed for ${day}`,
    trayEmptyTitle: 'No trays packed yet',
    trayTop: (name: string) => `Most picked: ${name}`,
    skippedRow: 'Skipped',

    guessesTitle: (name: string, n: number, total: number) => `${n} of ${total} guesses say ${name} wins`,

    historyHeading: 'History',
    historyTabs: 'History views',
    recentTab: 'Recent vote days',
    pastTab: 'Past winners',
    recentTitle: (n: number) => (n === 1 ? 'Winner of the last vote day' : `Winners of the last ${n} vote days`),
    recentWinner: (winner: number, total: number) => `${winner} of ${total}`,
    recentAlt: (name: string, open: string, target: string, winner: number, total: number) =>
      `${name} won the vote on ${open} for ${target}, with ${winner} of ${total} votes.`,
    pastTitle: (n: number, pct: number) => `Past ${n} winners took ${pct}% of the vote on average`,
    showAll: (n: number) => `Show all ${n}`,
    showFewer: 'Show fewer',
  },
}
