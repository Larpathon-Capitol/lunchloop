import { Dot, Icon, type IconProps } from './Icon'

const SPEAKER = 'M4 9.8h2.8l4.7-3.8v12L6.8 14.2H4z'

export function SoundOn(props: IconProps) {
  return (
    <Icon {...props}>
      <path d={SPEAKER} />
      <path d="M15 9.5a3.8 3.8 0 0 1 0 5" />
      <path d="M17.8 6.8a7.6 7.6 0 0 1 0 10.4" />
    </Icon>
  )
}

export function SoundOff(props: IconProps) {
  return (
    <Icon {...props}>
      <path d={SPEAKER} />
      <path d="M15.5 9.8l5 4.4" />
      <path d="M20.5 9.8l-5 4.4" />
    </Icon>
  )
}

export function Close(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </Icon>
  )
}

export function Back(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M14.5 5.5L8 12l6.5 6.5" />
    </Icon>
  )
}

export function Check(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 12.8l4.3 4.3L19 7" />
    </Icon>
  )
}

/* Skip: a dashed circle crossed by a slash ("pass on this group"). */
export function Skip(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.5" pathLength={24} strokeDasharray="1 2" />
      <path d="M8.2 15.8l7.6-7.6" />
    </Icon>
  )
}

export function Info(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5" />
      <Dot cx={12} cy={7.8} />
    </Icon>
  )
}

/* Allergen: a small shield with an exclamation mark. */
export function Allergen(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3l7.5 2.8v5.4c0 4.7-3.1 8.4-7.5 9.8-4.4-1.4-7.5-5.1-7.5-9.8V5.8z" />
      <path d="M12 8.5v4.2" />
      <Dot cx={12} cy={15.8} />
    </Icon>
  )
}

export function Lock(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
      <Dot cx={12} cy={15.5} r={1.250} />
    </Icon>
  )
}

export function Share(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 15V4" />
      <path d="M8 7.5l4-4 4 4" />
      <path d="M8 11H6a2 2 0 0 0-2 2v5.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V13a2 2 0 0 0-2-2h-2" />
    </Icon>
  )
}

/* Kitchen: a chef hat. */
export function Kitchen(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M7.5 14.5a4 4 0 0 1-1-7.6 3.5 3.5 0 0 1 5.5-2.4 3.5 3.5 0 0 1 5.5 2.4 4 4 0 0 1-1 7.6z" />
      <path d="M7.5 14.5V20a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1v-5.5" />
      <path d="M7.5 17.5h9" />
    </Icon>
  )
}

export function Menu(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4.5 6.5h15" />
      <path d="M4.5 12h15" />
      <path d="M4.5 17.5h10" />
    </Icon>
  )
}

/* Hand: an open hand, for petting the cat or dog mascot. */
export function Hand(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M7 14V9.5a1.4 1.4 0 0 1 2.8 0V5.5a1.4 1.4 0 0 1 2.8 0v1a1.4 1.4 0 0 1 2.8 0V9a1.4 1.4 0 0 1 2.8 0V15c0 3.6-2.5 6-6 6-2.3 0-4-.9-5.4-2.4L4.4 15a1.4 1.4 0 0 1 2.1-1.8L7 14" />
      <path d="M9.8 9.5V12.5" />
      <path d="M12.6 6.5V12.5" />
      <path d="M15.4 9V12" />
    </Icon>
  )
}
