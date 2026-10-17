// Words for free leftovers and the after-lunch check-in: the staff Lunch service section and
// the two student pieces (the free banner and the "how was lunch" card).

const plural = (n: number, one: string, many: string) => (n === 1 ? `1 ${one}` : `${n} ${many}`)

/** "A", "A and B", "A, B, and C". */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`
}

export const free = {
  service: {
    heading: 'Lunch service',
    sub: 'Who got what they packed for today, and what is left to give away.',
    none: 'No one packed a tray for today, so there is nothing to check yet.',
    status: (checkedIn: number, packed: number) =>
      `${checkedIn} of ${plural(packed, 'student', 'students')} who packed today’s tray checked in.`,
    outcome: (got: number, missed: number) => {
      if (got === 0 && missed === 0) return 'No answers yet.'
      const g = `${got} got their picks`
      if (missed === 0) return `${g}.`
      return `${g}, ${missed} said something ran out.`
    },
    checkLabel: 'Check-ins',
    allIn: 'Everyone who packed has checked in.',
    waitingCount: (n: number) => (n === 1 ? '1 student still to check in.' : `${n} students still to check in.`),
    wanted: (n: number) => `${n} wanted`,
    got: (n: number) => `${n} got it`,
    ranOut: (n: number) => `${n} ran out`,
    waiting: (n: number) => `${n} waiting`,
    nobody: 'Nobody packed this',
    barLabel: (name: string, wanted: number, got: number, ranOut: number, waiting: number) =>
      `${name}: ${wanted} wanted, ${got} got it, ${ranOut} ran out, ${waiting} still waiting.`,
    makeFree: 'Make leftovers free',
    makeFreeLabel: (name: string) => `Make ${name.toLowerCase()} leftovers free`,
    freeNow: 'Free now',
    freeSince: (time: string) => `Free since ${time}`,
    endFree: 'End free',
    endFreeLabel: (name: string) => `End free leftovers for ${name.toLowerCase()}`,
    sending: 'Saving…',
    confirmTitle: 'Some students haven’t checked in',
    confirmBody: (waiting: number, name: string) =>
      waiting === 1
        ? `1 student who picked ${name.toLowerCase()} hasn’t checked in yet. Make the leftovers free anyway?`
        : `${waiting} students who picked ${name.toLowerCase()} haven’t checked in yet. Make the leftovers free anyway?`,
    cancel: 'Cancel',
    confirm: 'Make it free',
    madeFree: (name: string) => `${name} leftovers are free now. Students will see it in the app.`,
    endedFree: (name: string) => `${name} is no longer free.`,
    failed: (name: string, why: string) => `Couldn’t update ${name.toLowerCase()}. ${why}`,
    offline: 'The server can’t be reached.',
  },

  banner: {
    word: 'Free',
    rest: (names: string[]) => ` leftovers: ${joinNames(names)}.`,
    hint: 'Ask at the counter while it lasts.',
    dismiss: 'Hide free leftovers',
  },

  checkIn: {
    heading: 'How was lunch?',
    packedLabel: 'You packed',
    got: 'I got my picks',
    missed: 'Something ran out',
    saving: 'Saving…',
    thanksGot: 'Thanks. Glad you got your picks.',
    thanksMissed: 'Thanks for telling us. The kitchen will see what ran out.',
    savedGot: 'You said you got your picks.',
    savedMissed: 'You said something ran out.',
    change: 'Change answer',
    keep: 'Keep my answer',
    noTray: 'We couldn’t find a tray for today, so there is nothing to check in.',
    offline: 'Couldn’t reach the server. Try again in a moment.',
    failed: 'That didn’t save. Try again.',
    groupLabel: 'Did you get what you packed?',
  },
}
