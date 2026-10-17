// Words for the School panel: sign-in, what students want, and the sub-nav.
export const school = {
  navWants: 'What students want',
  navKitchen: 'Kitchen',
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
    emptyToday: 'Nobody has voted yet. Send students the link and votes show up here.',
    noVoteOpen: 'No vote is open today.',
    todayHeading: 'Today’s vote',
    todaySub: (slot: string, day: string) => `Students are choosing the ${slot} for ${day}.`,
    votes: (n: number) => (n === 1 ? '1 vote' : `${n} votes`),
    share: (pct: number) => `${pct}%`,
    copyLink: 'Copy student link',
    copied: 'Link copied',
    copyFailed: 'Couldn’t copy. Select this link instead:',
    linkLabel: 'Student link',

    peopleHeading: 'Participation',
    votedToday: 'Voted today',
    votedLast5: 'Voted in the last 5 school days',
    playersTotal: 'Players so far',
    ofPlayers: (n: string) => `of ${n} players`,
    ofStudents: (n: string) => `of ${n} students`,

    guessesHeading: 'Called it guesses',
    guessesSub: (day: string) => `Guesses for ${day}, most guessed first.`,
    guessesEmpty: 'No guesses yet today.',
    guesses: (n: number) => (n === 1 ? '1 guess' : `${n} guesses`),

    recentHeading: 'Recent vote days',
    recentRow: (open: string, target: string) => `Voted ${open} for ${target}`,
    recentVotes: (winner: number, total: number) => `${winner} of ${total} votes`,
    recentEmpty: 'No earlier vote days at this school yet.',

    pastHeading: 'Past winners',
    pastSub: 'Simulated history from the menu records, not votes cast in this app.',
    pastShare: (pct: number) => `${pct}% of the vote`,
    pastEmpty: 'No history to show.',
  },
}
