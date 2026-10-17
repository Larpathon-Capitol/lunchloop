// Decoration for the game header bar on the indigo field: a faint seigaiha tide on the right
// end, a stitched hem along the bottom and a little blossom sprig tucked into the far corner.
import { Blossom, Bud } from './art'
import { seigaihaTile } from './pattern'
import './asia.css'

const TIDE = seigaihaTile('#232A5C', '#3A4480', 1.3)

export function HeaderBand() {
  return (
    <div className="ka ka-band" aria-hidden="true">
      <div className="ka-band__tide" style={{ backgroundImage: TIDE }} />
      <div className="ka-band__hem" />
      <svg className="ka-band__sprig" viewBox="0 0 80 52" aria-hidden="true" focusable="false">
        <path d="M84 -4C70 6 58 10 44 12C36 13 28 18 24 24" fill="none" stroke="#5A3446" strokeWidth="3" strokeLinecap="round" />
        <path d="M58 9C56 18 52 24 46 30" fill="none" stroke="#5A3446" strokeWidth="2" strokeLinecap="round" />
        <g transform="translate(44 15) rotate(14)">
          <Blossom r={11} seed={3} />
        </g>
        <g transform="translate(66 6) rotate(-20)">
          <Blossom r={8} seed={5} />
        </g>
        <g transform="translate(46 31) rotate(200)">
          <Bud r={3.6} />
        </g>
        <g transform="translate(24 25) rotate(230)">
          <Bud r={3} />
        </g>
      </svg>
    </div>
  )
}
