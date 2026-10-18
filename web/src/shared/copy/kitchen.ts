// Kitchen view wording. Owned by the kitchen lane.
export const kitchen = {
  pageTitle: 'Kitchen',
  pageSub: (day: string, students: string) => `${day} · ${students} students expected`,
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

  plan: {
    heading: (day: string) => `Prep list for ${day}`,
  },

  prep: {
    heading: 'What to make',
    servings: 'servings',
    noAllergens: 'No allergens',
    containsLabel: 'Contains',
    empty: 'There is no menu for this day yet.',
    takeaway: (name: string, n: string) => `${name} is the biggest batch, at ${n} servings.`,
    groupTotal: (n: string) => `${n} servings`,
    groupCount: (n: number) => (n === 1 ? '1 item' : `${n} items`),
    legendEaten: 'Expected to be eaten',
    legendBuffer: 'Buffer',
    legendFloor: 'Minimum',
    floor: (n: string) => `minimum ${n}`,
    showReasons: 'Show reasons',
  },

  allergenSummary: {
    heading: 'Allergens on this menu',
    count: (n: number) => (n === 1 ? '1 item' : `${n} items`),
    note: 'Allergens are listed as provided. Check the package label before serving.',
    showItems: 'Which items',
  },

  savings: {
    heading: 'Waste and savings',
    eyebrow: (weeks: number, from: string, to: string) =>
      `Simulated school · last ${weeks} weeks · ${from} to ${to}`,
    cutUnit: 'fewer leftovers',
    cutSub: 'if LunchLoop had planned every lunch, compared with cooking the usual amount.',
    leftoversTitle: 'Leftover servings over the whole period',
    fewer: (n: string) => `${n} fewer`,
    colLunchloop: 'LunchLoop',
    colUsual: 'The usual amount',
    barUsual: 'Usual amount',
    tableCaption: 'What LunchLoop would have left over, compared with cooking the usual amount, in the simulated school',
    colMetric: 'Over the whole period',
    leftovers: 'Leftover servings',
    wasted: 'Money wasted',
    short: 'Servings short',
    shortCost: 'Food cost of servings short',
    wastedTake: (pct: number) => `${pct}% less money thrown away`,
    shortTake: 'LunchLoop runs short more often',
    shortCostTake: (ratio: number) => `Counted at ${ratio}× in the overall savings`,
    shortNote: (ll: string, usual: string) =>
      `LunchLoop plans closer to what is eaten, so it runs short more often: ${ll} servings short, against ${usual} for the usual amount. Short counts only what students took, so on sold-out days real demand was higher.`,
    empty: 'No numbers to compare yet.',
    net: {
      saved: 'saved overall',
      cost: 'more overall',
      even: 'Overall, LunchLoop and the usual amount would have cost the same',
      sub: 'in our simulated school, after counting what running short would have cost.',
      costSub: 'in our simulated school. Running short would have cost more than the leftovers saved.',
      bridgeTitle: 'How the savings add up',
      lessWaste: 'Less food thrown away',
      shortPenalty: (ratio: number) => `Running short, counted at ${ratio}× food cost`,
      netLabel: 'Saved overall',
      how: (ratio: number) =>
        `A serving short is counted as ${ratio} times its food cost, so this number already pays for running short.`,
      howToggle: 'How we count this',
    },
  },

  chart: {
    headingCloser: 'LunchLoop’s plan stays closer to what students ate',
    headingNeutral: 'Eaten, and what each plan would have cooked, by school day',
    summary: (n: number) =>
      `Servings per day, all items, ${n} school days. Plan lines show what each plan would have cooked.`,
    yLabel: 'Servings per day',
    xLabel: 'School day',
    taken: 'Eaten by students',
    lunchloop: 'LunchLoop plan',
    usual: 'Usual amount',
    ariaLabel: 'Line chart of servings per school day: what students ate, what LunchLoop would have cooked, and what the usual amount would have cooked. The same numbers are in a table for screen readers.',
    tableCaption: 'Servings per school day',
    colDay: 'School day',
  },

  totals: {
    heading: 'Totals for this day',
    prepServings: 'Servings to prep',
    leftovers: 'Expected leftovers',
    foodCost: 'Food cost',
    wasteCost: 'Expected waste cost',
    now: 'This plan',
    start: 'Starting plan (sliders at usual)',
    same: 'Same as start',
    delta: (sign: string, pct: number) => `${sign}${pct}% vs start`,
  },

  sim: {
    heading: 'Test the plan',
    sub: 'Move a slider. The totals and bars update.',
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
    summary: (att: number, price: number, ratio: number) =>
      `Attendance ${att}% · Prices ${price}% · Running out ${ratio}×`,
    open: 'Adjust',
    close: 'Done',
    readout: (servings: string, leftovers: string, waste: string) =>
      `${servings} servings · ${leftovers} left · ${waste} waste`,
    reset: 'Reset to usual',
    resetShort: 'Reset',
    updating: 'Updating…',
    updateFailed: 'Could not update the numbers. Move a slider to try again.',
  },
}
