// Seigaiha, the overlapping wave scales, as a seamless tile for CSS backgrounds.
// Data URIs cannot read CSS variables, so the hex values from themes.md are written in.

/** One scale: a filled disc that hides the rows behind it, then three rings at r 20, 14 and 8. */
function scale(cx: number, cy: number, ground: string, line: string, w: number): string {
  const rings = [19.2, 14, 8]
    .map((r) => `<circle cx='${cx}' cy='${cy}' r='${r}' fill='none' stroke='${line}' stroke-width='${w}'/>`)
    .join('')
  return `<circle cx='${cx}' cy='${cy}' r='20' fill='${ground}'/>${rings}`
}

/**
 * A 40 by 20 seigaiha tile. Rows overlap from the top down so every scale tucks under the
 * one below it, and the tile repeats without a seam.
 */
export function seigaihaTile(ground: string, line: string, width = 1.4): string {
  const body = [scale(20, 10, ground, line, width), scale(0, 20, ground, line, width), scale(40, 20, ground, line, width)].join('')
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='40' height='20' viewBox='0 0 40 20'>${body}</svg>`
  return `url("data:image/svg+xml,${svg.replace(/#/g, '%23').replace(/</g, '%3C').replace(/>/g, '%3E')}")`
}

/** The world's ground tile: pink-3 waves on pink-1, faint at the opacity base.css uses. */
export const pattern = seigaihaTile('#FFE5EC', '#FFB3C6', 1.3)
export const patternSize = '40px 20px'
