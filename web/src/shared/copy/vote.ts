// Strings for the Vote tab that live outside student.ts: the reveal, and the shorter phone lines.
export const voteCopy = {
  /** The Spin button while the reel turns. Tapping it again jumps to the end. */
  skip: 'Spinning, tap to skip',
  /** Phones: the day line, short enough to sit on one line beside the "in 8 school days" chip. */
  heading: (day: string) => `Lunch on ${day}`,
  /** Phones: the lead, in one breath. Vegetarian options still show their own badge on the ballot. */
  lead: 'Spin to draw four entrees, then vote for one.',
}
