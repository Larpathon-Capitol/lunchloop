import { Icon, type IconProps } from './Icon'

/* Food groups. Main dish: a rice bowl with chopsticks. */
export function Entree(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 12h18a9 9 0 0 1-18 0z" />
      <path d="M9.5 21h5" />
      <path d="M7.5 12c.3-2.7 2.2-4.2 4.5-4.2s4.2 1.5 4.5 4.2" />
      <path d="M13.5 7L19.5 3" />
      <path d="M16.5 8.5l4.2-3.2" />
    </Icon>
  )
}

/* Grain: a wheat stalk. */
export function Grain(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 21.5V9" />
      <path d="M12 9c-1.7-1.4-1.7-4.4 0-6.4C13.7 4.6 13.7 7.6 12 9z" />
      <path d="M12 14.7c-3 .3-4.9-1.5-5.2-4.6 3-.2 5 1.5 5.2 4.6z" />
      <path d="M12 14.7c3 .3 4.9-1.5 5.2-4.6-3-.2-5 1.5-5.2 4.6z" />
      <path d="M12 19.7c-3 .3-4.9-1.5-5.2-4.6 3-.2 5 1.5 5.2 4.6z" />
      <path d="M12 19.7c3 .3 4.9-1.5 5.2-4.6-3-.2-5 1.5-5.2 4.6z" />
    </Icon>
  )
}

/* Vegetable: a two-leaf sprout. */
export function Vegetable(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 21V12.5" />
      <path d="M12 14c-4.6.2-7.2-2.4-7.2-7 4.6-.2 7.2 2.4 7.2 7z" />
      <path d="M12 11.5c0-4.1 2.6-6.7 7.2-6.7 0 4.3-2.6 6.9-7.2 6.7z" />
      <path d="M7 21h10" />
    </Icon>
  )
}

/* Fruit: a plum with a cleft and a leaf. */
export function Fruit(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 9c-1.5-1.2-3.5-1.5-5.1-.7C4.8 9.3 3.9 11.7 4.4 14.2c.7 3.8 3.8 6.8 7.6 6.8s6.9-3 7.6-6.8c.5-2.5-.4-4.9-2.5-5.9C15.5 7.5 13.5 7.8 12 9z" />
      <path d="M12 9c.7 2.9.7 6.2-.2 9.5" />
      <path d="M12 9V6.8" />
      <path d="M12.5 6.6c0-2.1 1.8-3.4 4.2-3.4 0 2.2-1.8 3.6-4.2 3.4z" />
    </Icon>
  )
}

/* Milk: a gable carton with a drop. */
export function Milk(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 9.5L8.3 3.5h7.4L18 9.5v10.5a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1z" />
      <path d="M6 9.5h12" />
      <path d="M12 13c-1.5 1.9-2.2 2.9-2.2 3.8a2.2 2.2 0 0 0 4.4 0c0-.9-.7-1.9-2.2-3.8z" />
    </Icon>
  )
}
