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

/** Monday to Friday of the week `today` falls in. On a weekend, the school week just finished. */
export function schoolWeek(today: string) {
  const [y, m, d] = today.split('-').map(Number)
  const dow = new Date(y, m - 1, d).getDay() // 0 Sunday ... 6 Saturday
  const back = dow === 0 ? 6 : dow - 1
  const monday = addDays(today, -back)
  return [0, 1, 2, 3, 4].map((i) => addDays(monday, i))
}

/** The weekday before `iso`. */
export function previousSchoolDay(iso: string) {
  let day = addDays(iso, -1)
  while (isWeekend(day)) day = addDays(day, -1)
  return day
}
