// Words for the live day control (staff) and the "new lunch day" note (students in the live game).
export const liveDay = {
  bar: {
    label: 'Live day',
    note: 'Moves the day for everyone in the live game. Anyone with the game open gets a note to refresh.',
    noteShort: 'Moves the day for everyone in the live game.',
    day: 'Live day',
    today: 'today',
    loadingDay: 'Loading the calendar…',
    prev: 'Previous school day',
    next: 'Next school day',
    backToToday: 'Back to today',
    moving: 'Moving the live day…',
    moved: (day: string) => `Everyone in the live game is on ${day} now.`,
    reset: (day: string) => `Back to today. Everyone is on ${day} again.`,
    offline: 'Couldn’t reach the server. Check the connection and try again.',
    failed: 'Couldn’t move the day. Try again in a moment.',
    calendarFailed: 'Couldn’t load the school calendar.',
  },
  notice: {
    title: 'New lunch day!',
    body: (day: string | null) =>
      day
        ? `The kitchen flipped the calendar to ${day}. Refresh to pack the new tray.`
        : 'The kitchen flipped the calendar to a new day. Refresh to pack the new tray.',
    keep: 'Your picks stay put until you refresh.',
    refresh: 'Refresh',
    dismiss: 'Hide this note',
    pillTitle: 'A new lunch day started.',
    pillDay: (day: string) => `${day} is the new lunch day.`,
    flippedTitle: 'New lunch day!',
    flippedBody: (day: string) => `You’re on ${day} now. Fresh tray, fresh vote.`,
    mascotLine: 'Ooh, a new lunch day! Refresh when you’re ready.',
  },
}
