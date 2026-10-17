import { useAnimate } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import type { EventKind, ServerEvent } from '../shared/api'
import { backstage as t } from '../shared/copy/backstage'
import { useReducedMotion } from '../shared/motion'
import { hopSpring } from './springs'

type NodeId = 'phone' | 'school' | 'api' | 'database' | 'engine'

// A flat diagram drawn in a 340 x 240 box. At phone width it renders close to 1:1,
// so the labels stay at real text size.
const NODES: Record<NodeId, { x: number; y: number; w: number; label: string }> = {
  phone: { x: 0, y: 16, w: 112, label: t.map.phone },
  school: { x: 0, y: 176, w: 112, label: t.map.school },
  api: { x: 130, y: 96, w: 52, label: t.map.api },
  database: { x: 200, y: 16, w: 140, label: t.map.database },
  engine: { x: 200, y: 176, w: 140, label: t.map.engine },
}
const NODE_H = 48
const center = (id: NodeId) => ({ x: NODES[id].x + NODES[id].w / 2, y: NODES[id].y + NODE_H / 2 })

const EDGES: [NodeId, NodeId][] = [
  ['phone', 'api'],
  ['school', 'api'],
  ['api', 'database'],
  ['api', 'engine'],
]
const edgeKey = (a: NodeId, b: NodeId) => [a, b].sort().join('-')

/** The path each kind of request takes through the system. */
const PATHS: Record<EventKind, NodeId[]> = {
  spin: ['phone', 'api', 'database'],
  vote: ['phone', 'api', 'database'],
  guess: ['phone', 'api', 'database'],
  rate_limited: ['phone', 'api'],
  staff_sign_in: ['school', 'api'],
  staff_sign_in_failed: ['school', 'api'],
  prep: ['api', 'engine'],
  savings: ['api', 'engine'],
  simulate: ['api', 'engine'],
  meter: ['api', 'engine'],
}

const HOLD_MS = 450
const REDUCED_HOLD_MS = 700
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

interface Lit {
  nodes: NodeId[]
  edges: string[]
}

/** Lights up the route of the newest request. Bursts play once, never as a backlog. */
export function RouteMap({ fresh }: { fresh: { seq: number; events: ServerEvent[] } }) {
  const reduce = useReducedMotion()
  const [scope, animate] = useAnimate<SVGSVGElement>()
  const dot = useRef<SVGCircleElement>(null)
  const [lit, setLit] = useState<Lit>({ nodes: [], edges: [] })
  const [caption, setCaption] = useState<string>(t.map.idle)
  const playing = useRef(false)
  const pending = useRef<EventKind | null>(null)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  useEffect(() => {
    const newest = fresh.events[fresh.events.length - 1]
    if (!newest) return

    async function play(kind: EventKind) {
      playing.current = true
      const path = PATHS[kind] ?? ['api']
      setCaption(t.map.last(t.kinds[kind] ?? kind, path.map((id) => NODES[id].label)))
      const el = dot.current
      if (reduce || !el) {
        setLit({ nodes: path, edges: path.slice(1).map((id, i) => edgeKey(path[i], id)) })
        await wait(REDUCED_HOLD_MS)
      } else {
        const start = center(path[0])
        setLit({ nodes: [path[0]], edges: [] })
        await animate(el, { x: start.x, y: start.y, opacity: 1 }, { duration: 0 })
        for (let i = 1; i < path.length; i++) {
          const to = center(path[i])
          const edge = edgeKey(path[i - 1], path[i])
          setLit((l) => ({ ...l, edges: [...l.edges, edge] }))
          await animate(el, { x: to.x, y: to.y }, hopSpring)
          setLit((l) => ({ ...l, nodes: [...l.nodes, path[i]] }))
        }
        await wait(HOLD_MS)
        animate(el, { opacity: 0 }, { duration: 0.12 })
      }
      if (!alive.current) return
      setLit({ nodes: [], edges: [] })
      playing.current = false
      const next = pending.current
      pending.current = null
      if (next) play(next)
    }

    if (playing.current) pending.current = newest.kind
    else play(newest.kind)
    // Only a new batch starts a pulse.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fresh.seq])

  const litNode = (id: NodeId) => lit.nodes.includes(id)
  const litEdge = (a: NodeId, b: NodeId) => lit.edges.includes(edgeKey(a, b))

  return (
    <figure className="b-map">
      <svg ref={scope} className="b-map__svg" viewBox="0 0 340 240" role="img" aria-label={t.map.label}>
        {EDGES.map(([a, b]) => {
          const p = center(a)
          const q = center(b)
          return (
            <g key={edgeKey(a, b)}>
              <line className="b-map__edge" x1={p.x} y1={p.y} x2={q.x} y2={q.y} />
              <line
                className="b-map__edge b-map__edge--lit"
                data-on={litEdge(a, b) || undefined}
                x1={p.x}
                y1={p.y}
                x2={q.x}
                y2={q.y}
              />
            </g>
          )
        })}
        <circle ref={dot} className="b-map__dot" r={5} cx={0} cy={0} opacity={0} />
        {(Object.keys(NODES) as NodeId[]).map((id) => {
          const n = NODES[id]
          return (
            <g key={id}>
              <rect className="b-map__node" x={n.x + 0.5} y={n.y + 0.5} width={n.w - 1} height={NODE_H - 1} rx={8} />
              <rect
                className="b-map__node b-map__node--lit"
                data-on={litNode(id) || undefined}
                x={n.x + 1}
                y={n.y + 1}
                width={n.w - 2}
                height={NODE_H - 2}
                rx={7}
              />
              <text className="b-map__label" x={n.x + n.w / 2} y={n.y + NODE_H / 2} dominantBaseline="central" textAnchor="middle">
                {n.label}
              </text>
            </g>
          )
        })}
      </svg>
      <figcaption className="b-map__caption">{caption}</figcaption>
    </figure>
  )
}
