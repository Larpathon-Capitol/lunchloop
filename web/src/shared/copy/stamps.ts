// Stamp book wording. Owned by the stamps screen.
export const stamps = {
  title: 'Stamps',
  /** The summary under the title: "5 of 12 stamps". */
  summary: (n: number, of: number) => `${n} of ${of} stamps`,
  summaryProgress: 'Stamps collected',
  earned: 'Earned',
  newlyEarned: 'New',
  groupCount: (n: number, of: number) => `${n} of ${of}`,
  rule: 'A day counts toward a streak when you pack a tray or vote.',

  groups: {
    streaks: 'Streaks',
    packing: 'Packing',
    voting: 'Voting',
    calling: 'Calling it',
  },

  /** Progress under an unearned stamp, by unit. */
  units: {
    days: (n: number, of: number) => `${n} of ${of} days`,
    trays: (n: number, of: number) => `${n} of ${of} ${of === 1 ? 'tray' : 'trays'}`,
    entrees: (n: number, of: number) => `${n} of ${of} entrees`,
    checkins: (n: number, of: number) => `${n} of ${of} check-in`,
    votes: (n: number, of: number) => `${n} of ${of} ${of === 1 ? 'vote' : 'votes'}`,
    calls: (n: number, of: number) => `${n} of ${of} ${of === 1 ? 'call' : 'calls'}`,
    rightCalls: (n: number, of: number) => `${n} of ${of} right ${of === 1 ? 'call' : 'calls'}`,
  },

  /** name: the line under the stamp. seal: the word on the stamp face. how: what earns it. */
  list: {
    streak_3: { name: 'Three day streak', seal: '3 days', how: 'Play three school days in a row.' },
    streak_7: { name: 'Seven day streak', seal: '7 days', how: 'Play seven school days in a row.' },
    streak_10: { name: 'Ten day streak', seal: '10 days', how: 'Play ten school days in a row.' },
    first_tray: { name: 'First tray', seal: 'Packed', how: 'Pack your first lunch tray.' },
    trays_5: { name: 'Regular', seal: '5 trays', how: 'Pack a tray on five days.' },
    explorer_4: { name: 'Explorer', seal: 'Explorer', how: 'Pack four different entrees.' },
    first_checkin: { name: 'Checked in', seal: 'Checked in', how: 'Answer "How was lunch?" once.' },
    first_vote: { name: 'First vote', seal: 'Voted', how: 'Vote on a future lunch.' },
    votes_5: { name: 'Voice of the line', seal: '5 votes', how: 'Vote on five days.' },
    first_call: { name: 'First call', seal: 'Called', how: 'Call which entree wins.' },
    called_it_1: { name: 'Right call', seal: 'Nailed it', how: 'Call the winning entree once.' },
    called_it_5: { name: 'Called it five times', seal: 'Caller', how: 'Call the winning entree five times.' },
  },
}
