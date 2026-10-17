// All user-facing words live here (and in the files it pulls in), so wording stays consistent.
import { hub } from './copy/hub'
import { kitchen } from './copy/kitchen'
import { school } from './copy/school'
import { student } from './copy/student'

export const copy = {
  app: {
    name: 'LunchLoop',
    simulated: 'Simulated data',
    simulatedHelp: 'Every number here comes from a made-up school, not a real cafeteria.',
    simulatedLive: 'Simulated menu',
    simulatedLiveHelp: 'The menu and history are simulated. Votes are real taps from people in the room.',
    navSchool: 'School',
    navStudent: 'Student',
    navBackstage: 'Behind the scenes',
    liveLabel: 'Live demo',
    navLabel: 'Main sections',
    skipToMain: 'Skip to main content',
    sound: 'Sound',
    soundTurnOff: 'Turn sound off',
    soundTurnOn: 'Turn sound on',
    titleHome: 'LunchLoop',
    titleSchool: 'School | LunchLoop',
    titleStudent: 'Student | LunchLoop',
    titleLive: 'Live demo | LunchLoop',
    titleLiveAdmin: 'Live demo panel | LunchLoop',
    titleHub: 'Hub | LunchLoop',
    titleBackstage: 'Behind the scenes | LunchLoop',
  },
  home: {
    titleLines: ['Vote on lunch.', 'The kitchen cooks it.'],
    lead: 'Spin for three options and vote for one. The kitchen plans how much to cook from the numbers.',
    studentCta: 'Play as a student',
    schoolCta: 'Open the school view',
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
  hub,
  kitchen,
  student,
  school,
}
