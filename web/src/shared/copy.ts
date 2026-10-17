// All user-facing words live here (and in the files it pulls in), so wording stays consistent.
import { kitchen } from './copy/kitchen'
import { student } from './copy/student'

export const copy = {
  app: {
    name: 'LunchLoop',
    simulated: 'Simulated data',
    simulatedHelp: 'Every number here comes from a made-up school, not a real cafeteria.',
    navKitchen: 'Kitchen',
    navStudent: 'Student',
    navLabel: 'Main sections',
    skipToMain: 'Skip to main content',
    sound: 'Sound',
    soundTurnOff: 'Turn sound off',
    soundTurnOn: 'Turn sound on',
    titleHome: 'LunchLoop',
    titleKitchen: 'Kitchen | LunchLoop',
    titleStudent: 'Student | LunchLoop',
  },
  home: {
    titleLines: ['Vote on lunch.', 'The kitchen cooks it.'],
    lead: 'Spin for three options and vote for one. The kitchen plans how much to cook from the numbers.',
    studentCta: 'Spin and vote on lunch',
    kitchenCta: 'Open the kitchen view',
    trayLabel: 'A lunch tray with a plate, a bowl, fruit and a milk carton',
    meterSuffix: 'fewer leftover servings than the usual amount in our simulated school',
    meterWeek: (day: string) => `week of ${day}`,
    meterLoading: 'Loading the numbers…',
    meterError: 'The numbers aren’t loading right now.',
  },
  errors: {
    unreachable: 'Can’t reach the LunchLoop server. Check your connection, then try again.',
    generic: 'Something went wrong on our end. Try again in a moment.',
    retry: 'Try again',
  },
  loading: 'Loading…',
  kitchen,
  student,
}
