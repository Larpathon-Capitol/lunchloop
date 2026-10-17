// Kitchen view wording. Owned by the kitchen lane.
export const kitchen = {
  title: (day: string) => `Prep list for ${day}`,
  attendance: (n: string) => `${n} students expected`,
  loading: 'Getting the prep list…',

  mealCheck: {
    heading: 'Meal check',
    allGood: 'All five components are covered.',
    problem: (parts: string[]) => `${parts.join(', ')}.`,
    missing: (name: string) => `${name} missing`,
    low: (name: string) => `${name} below its minimum`,
    statusOk: 'Covered',
    statusMissing: 'Missing',
    statusLow: 'Under minimum',
  },

  prep: {
    heading: 'What to make',
    servings: 'servings',
    noAllergens: 'No allergens listed',
    containsLabel: 'Contains',
    empty: 'There is no menu for this day yet.',
  },

  allergenSummary: {
    heading: 'Allergens on this menu',
    count: (n: number) => (n === 1 ? '1 item' : `${n} items`),
    note: 'Allergens are listed as provided. Check the package label before serving.',
  },

  savings: {
    heading: 'Waste and savings',
    headline: (weeks: number, from: string, to: string) =>
      `fewer leftovers in our simulated school if LunchLoop had planned the last ${weeks} weeks, compared with cooking the usual amount (${from} to ${to}).`,
    tableCaption: 'What LunchLoop would have left over, compared with cooking the usual amount, in the simulated school',
    colMetric: 'Over the whole period',
    colLunchloop: 'LunchLoop',
    colUsual: 'The usual amount',
    leftovers: 'Leftover servings',
    wasted: 'Money wasted',
    short: 'Servings short',
    shortNote: (ll: string, usual: string) =>
      `LunchLoop plans closer to what is eaten, so it runs short more often: ${ll} servings short, against ${usual} for the usual amount. Short counts only what students took, so on sold-out days real demand was higher.`,
    empty: 'No numbers to compare yet.',
  },

  chart: {
    heading: 'Eaten, and what each plan would have cooked, by school day',
    summary: (n: number, from: string, to: string) =>
      `Simulated school, ${from} to ${to} (${n} school days). Total servings per day across all menu items. The two plan lines show what each plan would have cooked, not what was really cooked.`,
    yLabel: 'Servings per day',
    xLabel: 'School day',
    taken: 'Eaten by students',
    lunchloop: 'LunchLoop plan',
    usual: 'Usual amount',
    ariaLabel: 'Line chart of servings per school day: what students ate, what LunchLoop would have cooked, and what the usual amount would have cooked. The same numbers are in the table below the chart.',
    tableCaption: 'Servings per school day',
    colDay: 'School day',
  },

  sim: {
    heading: 'Test the plan',
    attendance: 'Attendance',
    attendanceValue: (pct: number) => `${pct}% of usual`,
    attendanceLow: 'Fewer students',
    attendanceHigh: 'More students',
    price: 'Food prices',
    priceValue: (pct: number) => `${pct}% of usual`,
    priceLow: 'Cheaper',
    priceHigh: 'Pricier',
    ratio: 'Cost of running out',
    ratioValue: (n: number) =>
      n === 1 ? 'Same as a leftover' : `${n} times a leftover`,
    ratioLow: 'Same as a leftover',
    ratioHigh: 'Much more',
    totalsHeading: 'Totals for this day',
    prepServings: 'Servings to prep',
    leftovers: 'Expected leftovers',
    foodCost: 'Food cost',
    wasteCost: 'Expected waste cost',
    reset: 'Reset to usual',
    updating: 'Updating…',
    updateFailed: 'Could not update the numbers. Move a slider to try again.',
  },
}
