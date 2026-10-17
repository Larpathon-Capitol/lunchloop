// Presenter controls for the simulated school. Owned by the demo-ops lane.
export const demo = {
  label: 'Presenter controls',
  note: 'Only for the simulated school. The live game never sees these.',
  day: 'Simulated day',
  today: 'today',
  loadingDay: 'Loading the calendar…',
  prev: 'Previous school day',
  next: 'Next school day',
  backToToday: 'Back to today',
  add: (n: number) => `Add ${n} ${n === 1 ? 'student' : 'students'}`,
  addShort: (n: number) => `Add ${n}`,
  addLabel: 'Add simulated students',
  adding: 'Adding students…',
  added: (added: number, trays: number) =>
    `Added ${added} ${added === 1 ? 'student' : 'students'}: ${trays} ${trays === 1 ? 'tray' : 'trays'} packed so far.`,
  noVoting: 'No voting on this day. Step to another school day and try again.',
  failed: 'Couldn’t add students. Try again in a moment.',
  calendarFailed: 'Couldn’t load the school calendar.',
}
