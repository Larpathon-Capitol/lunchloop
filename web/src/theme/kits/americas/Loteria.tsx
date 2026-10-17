// Loteria-style cards lying on the counter in the hero: an ink frame, a star badge,
// a simple picture and a name ribbon.
import type { CSSProperties } from 'react'

function Sandia() {
  return (
    <g>
      <rect x="14" y="22" width="72" height="72" rx="3" className="amx-f-pink2" />
      {/* a watermelon slice: rind, white line, flesh and seeds */}
      <path d="M20 52a30 30 0 0 0 60 0Z" className="amx-f-leaf" />
      <path d="M24 52a26 26 0 0 0 52 0Z" className="amx-f-paper" />
      <path d="M27 52a23 23 0 0 0 46 0Z" className="amx-f-pink5" />
      <path d="M20 52h60" strokeWidth="2" className="amx-s-ink" strokeLinecap="round" />
      {[
        [38, 60],
        [50, 64],
        [62, 60],
        [44, 69],
        [56, 69],
      ].map(([x, y]) => (
        <ellipse key={`${x}-${y}`} cx={x} cy={y} rx="1.6" ry="2.6" className="amx-f-ink" />
      ))}
      <path d="M50 30v8M38 33l3 6M62 33l-3 6" strokeWidth="2.4" strokeLinecap="round" className="amx-s-yellow" />
    </g>
  )
}

function Pera() {
  return (
    <g>
      <rect x="14" y="22" width="72" height="72" rx="3" className="amx-f-yellow" />
      {/* a pear with a stem and one leaf */}
      <path
        d="M50 38c-6 0-8 6-8 11 0 5-9 9-9 21 0 11 8 17 17 17s17-6 17-17c0-12-9-16-9-21 0-5-2-11-8-11Z"
        className="amx-f-leaf"
      />
      <path d="M44 74c2 5 6 7 10 7" strokeWidth="2.4" strokeLinecap="round" fill="none" className="amx-s-yellow" opacity="0.7" />
      <path d="M50 39c0-4 1-7 3-9" strokeWidth="2.6" strokeLinecap="round" fill="none" className="amx-s-ink" />
      <path d="M53 33c4-5 11-5 14-3-3 4-9 6-14 3Z" className="amx-f-leafdeep" />
    </g>
  )
}

const CARDS = {
  sandia: { name: 'La sandía', Art: Sandia },
  pera: { name: 'La pera', Art: Pera },
}

export function LoteriaCard({ card, className, style }: { card: keyof typeof CARDS; className?: string; style?: CSSProperties }) {
  const { name, Art } = CARDS[card]
  return (
    <svg className={className} style={style} viewBox="0 0 100 140" aria-hidden="true">
      <rect x="2" y="2" width="96" height="136" rx="7" className="amx-f-paper amx-s-ink" strokeWidth="2.2" />
      <rect x="9" y="9" width="82" height="122" rx="4" fill="none" className="amx-s-ink" strokeWidth="1.2" />
      <Art />
      {/* the star badge */}
      <circle cx="21" cy="21" r="9" className="amx-f-cobalt" />
      <path d="M21 14.5l1.7 4.8 4.8 1.7-4.8 1.7-1.7 4.8-1.7-4.8-4.8-1.7 4.8-1.7Z" className="amx-f-white" />
      {/* the name ribbon */}
      <path d="M10 103h80l-5 7 5 7H10l5-7Z" className="amx-f-pink4" />
      <text x="50" y="114.5" textAnchor="middle" fontSize="13.5" className="amx-f-ink amx-seal-text">
        {name}
      </text>
      <path d="M30 125h40" strokeWidth="1.2" strokeLinecap="round" className="amx-s-ink" opacity="0.5" />
    </svg>
  )
}
