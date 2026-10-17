import { Dot, Icon, type IconProps } from './Icon'

const PETAL = 'M12 12C9 10.6 8 6.8 9.5 4.4c.9-1.4 4.1-1.4 5 0C16 6.8 15 10.6 12 12z'

/* Blossom: five-petal plum blossom, used for streak days. */
export function Blossom(props: IconProps) {
  return (
    <Icon {...props}>
      {[0, 72, 144, 216, 288].map((deg) => (
        <path key={deg} d={PETAL} transform={`rotate(${deg} 12 12)`} />
      ))}
      <Dot cx={12} cy={12} r={1.4} />
    </Icon>
  )
}

/* Seal: a square hanko stamp face with an open loop and a short stroke. */
export function Seal(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="3.5" />
      <path d="M14.6 8.2A3.8 3.8 0 1 0 15.8 11.4" />
      <path d="M8.8 17h6.4" />
    </Icon>
  )
}

/* Coin: the XP token, an old coin with a square hole. */
export function Coin(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <rect x="9" y="9" width="6" height="6" rx="1.2" />
    </Icon>
  )
}

/* Tray: top view of a five-compartment tray. */
export function Tray(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="2.5" y="4.5" width="19" height="15" rx="3" />
      <path d="M2.5 12h19" />
      <path d="M9 4.5V12" />
      <path d="M15 4.5V12" />
      <path d="M12 12v7.5" />
    </Icon>
  )
}

/* Ballot: a ballot box with a marked slip dropping in. */
export function Ballot(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3.5 14.5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2V18.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />
      <path d="M8.5 12.5l-.6-6.8a1 1 0 0 1 .9-1.1l6.4-.6a1 1 0 0 1 1.1.9l.6 7.6" />
      <path d="M10.3 8.3l1.3 1.3 2.5-2.8" />
      <path d="M8.2 16.5h7.6" />
    </Icon>
  )
}

/* Crystal: a crystal ball with a spark, for "call it". */
export function Crystal(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="10.5" r="7.5" />
      <path d="M8.3 17.6L7.5 20.8h9l-.8-3.2" />
      <path d="M12 7c.3 1.9.9 2.5 2.8 2.8-1.9.3-2.5.9-2.8 2.8-.3-1.9-.9-2.5-2.8-2.8C11.1 9.5 11.7 8.9 12 7z" />
    </Icon>
  )
}

/* Calendar: a page with rings and one marked day. */
export function Calendar(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
      <path d="M3.5 10h17" />
      <path d="M8 3v3.5" />
      <path d="M16 3v3.5" />
      <Dot cx={12} cy={15} r={1.3} />
    </Icon>
  )
}

/* Lantern: a paper chochin, for milestones. */
export function Lantern(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 4V2.5" />
      <path d="M9.5 6.2V4h5v2.2" />
      <path d="M7 6.2c-2.8 2.8-2.8 8.8 0 11.6h10c2.8-2.8 2.8-8.8 0-11.6z" />
      <path d="M9.5 17.8V20h5v-2.2" />
      <path d="M5.7 12h12.6" />
    </Icon>
  )
}

/* Badge: a round medal on a ribbon. */
export function Badge(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="9" r="6.5" />
      <path d="M8.6 14.2L7 21l5-2.5" />
      <path d="M15.4 14.2L17 21l-5-2.5" />
      <Dot cx={12} cy={9} r={1.5} />
    </Icon>
  )
}
