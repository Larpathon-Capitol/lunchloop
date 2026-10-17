// Which school the student game is playing in. It comes only from the URL, so two tabs or
// two visits can never mix schools: /student is the simulated school (or ?school=<id>),
// /live is the real live demo.
import { useLocation } from 'react-router-dom'
import { setStudentSchool } from './api'

export const DEMO_SCHOOL = 'demo'
export const LIVE_SCHOOL = 'live'
const VALID = /^[a-z0-9-]{1,40}$/

let active = DEMO_SCHOOL

/** The school for a /student URL: ?school= if valid, else the simulated school. */
export function schoolForStudentUrl(search: string): string {
  const param = new URLSearchParams(search).get('school')
  return param && VALID.test(param) ? param : DEMO_SCHOOL
}

/** Points every student request at this school. Safe to call on every render. */
export function applyStudentSchool(id: string) {
  active = id
  setStudentSchool(id)
}

export function activeStudentSchool() {
  return active
}

/** Where the game's own links point: /live for the live demo, /student otherwise (keeping ?school=). */
export function useGameBase() {
  const { pathname, search } = useLocation()
  if (pathname.split('/')[1] === 'live') return { base: '/live', search: '' }
  const school = schoolForStudentUrl(search)
  return { base: '/student', search: school === DEMO_SCHOOL ? '' : `?school=${school}` }
}
