// Hero to game cover: a painted roll-up shop shutter. It starts down, showing the same
// pink ground and sunburst as the hero, then rolls up once the game is ready.
import { useAnimate, useReducedMotion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import './americas.css'

export function Curtain({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const reduce = useReducedMotion()
  const [scope, animate] = useAnimate<HTMLDivElement>()
  const [gone, setGone] = useState(false)
  const done = useRef(onDone)
  useEffect(() => {
    done.current = onDone
  }, [onDone])

  useEffect(() => {
    if (!ready || !scope.current) return
    let live = true
    // A short hitch down, then a fast roll up that eases out, like a shutter on a spring.
    const run = reduce
      ? animate(scope.current, { opacity: 0 }, { duration: 0.2 })
      : animate(scope.current, { y: ['0%', '2.5%', '-104%'] }, { duration: 0.82, times: [0, 0.16, 1], ease: ['easeOut', [0.65, 0, 0.35, 1]] })
    void run.then(() => {
      if (!live) return
      setGone(true)
      done.current()
    })
    return () => {
      live = false
    }
  }, [ready, reduce, animate, scope])

  if (gone) return null
  return (
    <div className="amx amx-curtain" aria-hidden="true">
      <div ref={scope} className="amx-shutter">
        <div className="amx-burst-wrap">
          <div className="amx-burst is-static" />
        </div>
        <div className="amx-slats" />
        <div className="amx-rail">
          <div className="amx-handle" />
        </div>
      </div>
    </div>
  )
}
