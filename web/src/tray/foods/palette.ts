/*
 * Food colors, all in one place. Each family sits near its food-group glaze token from
 * shared/tokens.css (entree #b5523b, grain #93680f, vegetable #4f7f35, fruit #c94562,
 * milk #3f729e) so a filled tray reads as one painted set.
 */
export const FOOD = {
  // Baked goods (grain family, toasted)
  crust: '#d9a051',
  crustDeep: '#b0702c',
  crumb: '#f2d9a4',
  bunTop: '#c47a2e',
  bunSide: '#e5b26a',
  brioche: '#b4602a',
  rollTop: '#c98535',
  rollBase: '#f0d4a0',
  bread: '#f1dcaa',
  breadCrust: '#a8692a',
  sesame: '#f7ecd0',

  // Cheese
  cheese: '#f4c64e',
  cheeseDeep: '#e49a32',
  cheeseToast: '#c97a2a',

  // Fried and grilled (entree family, soy glaze)
  fry: '#dba046',
  fryLight: '#eec276',
  fryDeep: '#b26a2a',
  patty: '#6b3523',
  pattyLight: '#8a4a30',
  beef: '#7e3d28',
  glaze: '#c4462b',
  glazeDeep: '#9c3320',
  glazeLight: '#e0703f',
  meatball: '#a8472f',
  chip: '#e9b850',
  chipDeep: '#d29639',

  // Grains
  rice: '#c9a56e',
  riceLight: '#e0c695',
  riceDeep: '#a77f4b',
  riceBran: '#8f6439',

  // Vegetables (matcha family)
  broccoli: '#4f7f35',
  broccoliLight: '#79a24a',
  broccoliDeep: '#365d24',
  stalk: '#a9c46f',
  lettuce: '#82ad45',
  pickle: '#7f9c3c',
  bean: '#5d913a',
  beanLight: '#86b052',
  carrot: '#e5772b',
  carrotCore: '#f5ad5f',

  // Fruit (ume family plus bright accents)
  apple: '#c94562',
  appleBlush: '#e36a6f',
  leaf: '#4f7f35',
  stem: '#6b4a2b',
  peach: '#f2a541',
  pear: '#efe2a2',
  cherry: '#c23a52',
  grape: '#93b54a',
  pineapple: '#f6d35a',
  mandarin: '#f0862a',
  mandarinLight: '#f8b866',
  cup: '#eaf2f4',

  // Milk cartons (milk family)
  carton: '#f6f3ec',
  cartonShade: '#e4e1d8',
  milkPanel: '#3f729e',
  milkLight: '#6d9cc6',
  chocoPanel: '#74452b',
  chocoLight: '#f0dcc0',
  white: '#fbfaf6',
} as const
