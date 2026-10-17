// The Americas ground tile: a cut-paper diamond with dots and a four-point sparkle,
// in pink-3 so it sits faintly behind text on pink-1.
const C = '#FFB3C6'

const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='56' height='56' viewBox='0 0 56 56'>
<g fill='${C}'>
<path d='M14 6L19 14L14 22L9 14Z M14 10.5L16.4 14L14 17.5L11.6 14Z' fill-rule='evenodd'/>
<circle cx='14' cy='2.5' r='1.3'/><circle cx='14' cy='25.5' r='1.3'/><circle cx='5.5' cy='14' r='1.3'/><circle cx='22.5' cy='14' r='1.3'/>
<path d='M42 33C42.9 40.1 42.9 40.1 50 41C42.9 41.9 42.9 41.9 42 49C41.1 41.9 41.1 41.9 34 41C41.1 40.1 41.1 40.1 42 33Z'/>
</g>
</svg>`

export const pattern = `url("data:image/svg+xml,${svg.replace(/\n/g, '').replace(/#/g, '%23').replace(/</g, '%3C').replace(/>/g, '%3E').replace(/"/g, "'")}")`
export const patternSize = '56px 56px'
