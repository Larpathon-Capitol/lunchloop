/** The plan sliders: attendance and price as multipliers of usual, and the cost of running out. */
export interface Controls {
  attendance: number
  price: number
  ratio: number
}
export const DEFAULT_CONTROLS: Controls = { attendance: 1, price: 1, ratio: 3 }
