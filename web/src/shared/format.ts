const ALLERGEN_NAMES: Record<string, string> = {
  milk: 'Milk',
  egg: 'Egg',
  fish: 'Fish',
  shellfish: 'Shellfish',
  tree_nuts: 'Tree nuts',
  peanuts: 'Peanuts',
  wheat: 'Wheat',
  soybeans: 'Soy',
  sesame: 'Sesame',
}

const COMPONENT_NAMES: Record<string, string> = {
  meat_alternate: 'Protein',
  grain: 'Grain',
  vegetable: 'Vegetable',
  fruit: 'Fruit',
  milk: 'Milk',
}

export const allergenName = (a: string) => ALLERGEN_NAMES[a] ?? a
export const componentName = (c: string) => COMPONENT_NAMES[c] ?? c

const whole = new Intl.NumberFormat('en-US')
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

export const fmtInt = (n: number) => whole.format(Math.round(n))
export const fmtMoney = (n: number) => money.format(n)
export const fmtPct = (n: number) => `${Math.round(n)}%`

/** "2026-10-19" to "Monday, Oct 19". Parsed as a local date so it never shifts a day. */
export function fmtDay(iso: string, opts: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'short', day: 'numeric' }) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', opts)
}
