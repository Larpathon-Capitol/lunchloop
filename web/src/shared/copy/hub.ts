// Words for the Hub: the page Abyan opens during the presentation to jump around.
export const hub = {
  title: 'Dashboard',
  lead: 'Every page in one place. Open one here, or copy its link.',
  nav: 'Dashboard',
  open: 'Open',
  copy: 'Copy link',
  copied: 'Copied',
  copyFailed: 'Couldn’t copy',
  listLabel: 'Pages',
  groups: {
    simulated: {
      heading: 'Simulated school (for demos)',
      line: 'A made-up school with a full lunch history. Safe to click around and add fake students.',
    },
    live: {
      heading: 'Real time (live students)',
      line: 'Real people in the room. Every vote and tray here is a real tap.',
    },
  },
  passwordLabel: 'Password',
  noteSimulated:
    'Menu, history and kitchen numbers are simulated. Votes on the live page are real taps from people in the room.',

  pages: {
    student: {
      name: 'Student game',
      line: 'Pack a tray, vote and guess in the simulated school.',
    },
    school: {
      name: 'School dashboard',
      line: 'What students want, for the simulated school.',
      password: 'lunchloop',
    },
    kitchen: {
      name: 'Kitchen',
      line: 'Prep list, savings and the what-if simulator.',
      passwordNote: 'Same sign-in as the school dashboard',
    },
    live: {
      name: 'Live student game',
      line: 'The same game, but every vote here is real. Peers scan the code.',
    },
    liveAdmin: {
      name: 'Live school dashboard',
      line: 'Watch the live votes arrive, as people tap.',
      passwordNote: 'Sign in with the staff password you set',
    },
    backstage: {
      name: 'Behind the scenes',
      line: 'The server working on the simulated school, one request at a time.',
    },
    backstageLive: {
      name: 'Behind the scenes',
      line: 'The server handling real taps from the live game.',
    },
  },

  qr: {
    heading: 'Scan to vote',
    label: 'QR code for the live student game',
    fullScreen: 'Show QR full screen',
    close: 'Close',
    dialogLabel: 'Live student game QR code',
    urlLabel: 'Link for the live student game',
  },
}
