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

/** "2026-10-20" to "Tuesday, October 20". */
export const fmtLongDay = (iso: string) => fmtDay(iso, { weekday: 'long', month: 'long', day: 'numeric' })

/** "2026-10-19" plus n days, as a local date so it never shifts. */
export function addDays(iso: string, n: number) {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d + n)
  const pad = (v: number) => String(v).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** True for Saturday and Sunday. */
export function isWeekend(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  const day = new Date(y, m - 1, d).getDay()
  return day === 0 || day === 6
}

/** The last `count` weekdays ending on `today` (or before it, when today is a weekend), oldest first. */
export function lastSchoolDays(today: string, count: number) {
  const out: string[] = []
  for (let i = 0; out.length < count && i < count * 3; i++) {
    const day = addDays(today, -i)
    if (!isWeekend(day)) out.unshift(day)
  }
  return out
}

/** The weekday before `iso`. */
export function previousSchoolDay(iso: string) {
  let day = addDays(iso, -1)
  while (isWeekend(day)) day = addDays(day, -1)
  return day
}
