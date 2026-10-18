// The leftovers-avoided card at the end of the Tray tab. Numbers come from the simulated school.
export const waste = {
  heading: 'Leftovers avoided',
  week: (day: string) => `Week of ${day}`,
  /** Under the big number. */
  unit: (n: number) => (n === 1 ? 'fewer leftover serving than usual' : 'fewer leftover servings than usual'),
  /** Screen-reader version of the number and the line under it. */
  spoken: (n: string, unit: string) => `${n} ${unit}`,
  note: 'Our simulated school cooked to match the trays students packed.',
  /** Shown only when the money still comes out ahead after counting shortages. */
  dollars: (amount: string) => `It saved ${amount}, even after counting the times it ran short.`,
  none: 'Our simulated school didn’t avoid any leftovers that week.',
}
