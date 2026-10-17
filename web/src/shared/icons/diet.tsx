import { Dot, Icon, type IconProps } from './Icon'

/* Diet marks for foods. Same 24px grid and stroke as the rest of the set. */

/* Vegetarian: one leaf with a midrib. */
export function Leaf(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 19c-.4-8.2 4.4-13.3 14-14 .5 9.4-4.6 14.3-14 14z" />
      <path d="M5 19l9-9" />
    </Icon>
  )
}

/* Vegan: a sprout with two leaves. */
export function Sprout(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 21v-8.5" />
      <path d="M12 12.5C7.8 12.7 5.4 10.3 5.4 6c4.2-.2 6.6 2.2 6.6 6.5z" />
      <path d="M12 10.5c0-3.8 2.3-6 6.6-6 0 3.9-2.4 6.1-6.6 6z" />
    </Icon>
  )
}

/* Spicy: a chili with a curled stem. */
export function Chili(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9 8.5c3.6-.6 7.6.6 8.8 3.3 1.5 3.6-1.9 8.5-11.8 9 3.7-2.5 3.8-5.6 3.1-8.2C8.8 11 8.5 9.6 9 8.5z" />
      <path d="M9 8.5c-.2-2 .9-3.6 2.8-4" />
      <path d="M9 8.5c1.6-.6 3.4-.4 4.6.6" />
    </Icon>
  )
}

/* Contains meat: a steak with marbling lines. */
export function Meat(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3.5 12.5C3.5 7.8 7.6 4.5 12.5 4.5s8 2.7 8 6.4c0 2.6-1.8 3.7-3.7 4.4-2 .8-2.6 2.1-4 3.3-2.5 2.2-9.3.8-9.3-6.1z" />
      <path d="M8 10.5c1.5-1.5 4-2 6.5-1.3" />
      <path d="M7.5 14.2c1.2.6 2.7.6 4-.2" />
    </Icon>
  )
}

/* Gluten-free: a wheat stalk with a slash. */
export function NoWheat(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 21.5V10" />
      <path d="M12 10c-1.5-1.3-1.5-4 0-5.8 1.5 1.8 1.5 4.5 0 5.8z" />
      <path d="M12 15c-2.7.3-4.4-1.3-4.7-4.1 2.7-.2 4.5 1.3 4.7 4.1z" />
      <path d="M12 15c2.7.3 4.4-1.3 4.7-4.1-2.7-.2-4.5 1.3-4.7 4.1z" />
      <path d="M4.5 4.5l15 15" />
    </Icon>
  )
}

/* Dairy-free: a milk drop with a slash. */
export function NoMilk(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 4c-3.3 4.2-5 6.8-5 9a5 5 0 0 0 10 0c0-2.2-1.7-4.8-5-9z" />
      <path d="M4.5 4.5l15 15" />
    </Icon>
  )
}

/* A heads-up: a rounded triangle with an exclamation mark. */
export function HeadsUp(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M10.3 4.6a2 2 0 0 1 3.4 0l7 12.2a2 2 0 0 1-1.7 3H5a2 2 0 0 1-1.7-3z" />
      <path d="M12 9.5v4" />
      <Dot cx={12} cy={16.6} />
    </Icon>
  )
}

/* My needs: a person outline with a small check, for the needs sheet button. */
export function Needs(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="10" cy="8" r="3.5" />
      <path d="M3.5 20c.4-3.8 3-6 6.5-6 1.3 0 2.5.3 3.4.9" />
      <path d="M14.5 18l2 2 4-4.5" />
    </Icon>
  )
}
