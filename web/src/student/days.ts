// How far off a menu day is, for the "in 6 school days" hints on Vote and Call it.
import { addDays, isWeekend } from '../shared/format'

/** Weekdays after `from` up to and including `to`. 0 when `to` is not after `from`. */
export function schoolDaysBetween(from: string, to: string): number {
  if (to <= from) return 0
  let n = 0
  // Capped so a bad date can never spin forever.
  for (let day = addDays(from, 1), i = 0; day <= to && i < 400; day = addDays(day, 1), i++) {
    if (!isWeekend(day)) n++
  }
  return n
}

/** True when `to` is the calendar day right after `from`. */
export const isTomorrow = (from: string, to: string) => addDays(from, 1) === to
