// The leftovers-avoided card at the end of the Tray tab. Numbers always come from the simulated
// school's engine, so the live school's card says plainly that they are the test school's.
export const waste = {
  heading: 'Leftovers avoided',
  week: (day: string) => `Week of ${day}`,
  /** Under the big number. */
  unit: (n: number) => (n === 1 ? 'fewer leftover serving than usual' : 'fewer leftover servings than usual'),
  /** Screen-reader version of the number and the line under it. */
  spoken: (n: string, unit: string) => `${n} ${unit}`,
  note: (live: boolean) =>
    live
      ? 'In our simulated test school, the kitchen cooked to match the trays students packed.'
      : 'Our simulated school cooked to match the trays students packed.',
  /** Shown only when the money still comes out ahead after counting shortages. */
  dollars: (amount: string) => `It saved ${amount}, even after counting the times it ran short.`,
  none: (live: boolean) =>
    live
      ? 'Our simulated test school didn’t avoid any leftovers that week.'
      : 'Our simulated school didn’t avoid any leftovers that week.',
}
