/** Items with the highest count, in the order given. Empty when every count is 0. */
export function leaders<T>(items: T[], count: (t: T) => number): T[] {
  const top = Math.max(0, ...items.map(count))
  return top > 0 ? items.filter((i) => count(i) === top) : []
}

/** Most first; ties keep the server's order so rows only move when the standings do. */
export function byCount<T>(items: T[], count: (t: T) => number): T[] {
  return items
    .map((t, i) => ({ t, i }))
    .sort((a, b) => count(b.t) - count(a.t) || a.i - b.i)
    .map(({ t }) => t)
}

/** "A", "A and B", "A, B and C". */
export function joinNames(names: string[], and: (a: string, b: string) => string): string {
  if (names.length <= 1) return names[0] ?? ''
  return and(names.slice(0, -1).join(', '), names[names.length - 1])
}

/** Share as a whole percent, safe for 0 / 0. */
export const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0)
