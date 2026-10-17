import type { ComponentType } from 'react'
import { Entree, Fruit, Grain, Milk, Vegetable } from './food'
import type { IconProps } from './Icon'

export type FoodGroupComponent = 'meat_alternate' | 'grain' | 'vegetable' | 'fruit' | 'milk'

const BY_GROUP: Record<FoodGroupComponent, ComponentType<IconProps>> = {
  meat_alternate: Entree,
  grain: Grain,
  vegetable: Vegetable,
  fruit: Fruit,
  milk: Milk,
}

export function foodGroupIcon(component: FoodGroupComponent): ComponentType<IconProps> {
  return BY_GROUP[component]
}
