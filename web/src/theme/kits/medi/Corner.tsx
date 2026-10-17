// Corner art for the courtyard world: a pomegranate sprig with saz leaves, a cut half and a
// small star tile, drawn for a top-right corner. The caller can move it with className/style.
import type { ArtProps } from '../../types'
import { sazLeaf } from './geometry'
import { Pomegranate, PomegranateHalf, StarTile } from './motifs'
import './medi.css'

export function Corner({ className, style }: ArtProps) {
  return (
    <div className={`mk mk-corner${className ? ` ${className}` : ''}`} style={style} aria-hidden="true">
      <svg viewBox="0 0 128 128">
        {/* branch coming in from the corner */}
        <path d="M128 6C104 12 88 22 74 40C64 53 58 64 52 78" className="f-none s-leafd" strokeWidth="3.2" strokeLinecap="round" />
        <path d="M86 28C80 18 70 14 60 14" className="f-none s-leafd" strokeWidth="2.2" strokeLinecap="round" />
        <path d={sazLeaf(34)} transform="translate(98 16) rotate(-118)" className="f-leaf s-leafd" strokeWidth="1" strokeLinejoin="round" />
        <path d={sazLeaf(30)} transform="translate(76 38) rotate(-30)" className="f-leaf s-leafd" strokeWidth="1" strokeLinejoin="round" />
        <path d={sazLeaf(24)} transform="translate(66 50) rotate(-150)" className="f-leafd" />
        <Pomegranate x={50} y={90} r={17} />
        <PomegranateHalf x={58} y={20} r={12} />
        <StarTile x={112} y={40} R={10} a="f-tq" b="f-p3" c="f-au" line="s-au" />
        <circle cx={100} cy={58} r={2.2} className="f-p5" />
        <circle cx={108} cy={64} r={1.6} className="f-p4" />
      </svg>
    </div>
  )
}
