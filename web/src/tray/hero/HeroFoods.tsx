import { useEffect, useState } from 'react'
import { api } from '../../shared/api'
import { deviceId } from '../../shared/device'
import { useTray } from '../store'
import { pickCast, type Buddy } from './foods3d/cast'
import { FoodsLayer } from './foods3d/FoodsLayer'

/*
 * Small 3D foods standing along the bottom of the hero, watching the pointer. Drawn inside the
 * tray canvas (see FoodsLayer). Only on the hero: when the student taps in, they hop off and the
 * layer unmounts, so the game pays nothing for them.
 */

/** They arrive once the words and the tray have settled. */
const ENTER_AFTER_MS = 900
/** The menu gets this long to arrive; after that the fixed mix stands in. */
const MENU_WAIT_MS = 1400
/** Long enough for the hop-off to finish. */
const LEAVE_MS = 520
const MAX_FOODS = 8

type Menu = Parameters<typeof pickCast>[0]
let menuOnce: Promise<Menu> | null = null
function loadMenu(): Promise<Menu> {
  menuOnce ??= api
    .getTray(deviceId())
    .then((t) => t.groups.map((g) => ({ component: g.component, itemIds: g.items.map((i) => i.item_id) })))
    .catch(() => null)
  return menuOnce
}

function useMedia(query: string) {
  const [on, setOn] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = () => setOn(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])
  return on
}

export function HeroFoods() {
  const phase = useTray((s) => s.phase)
  const landed = useTray((s) => s.landed)
  const reduced = useMedia('(prefers-reduced-motion: reduce)')
  const coarse = useMedia('(pointer: coarse)')
  const hero = phase === 'hero'
  const [cast, setCast] = useState<Buddy[] | null>(null)
  const [mounted, setMounted] = useState(false)

  // On the hero: wait for the page to settle and the menu (briefly), then bring them on.
  useEffect(() => {
    if (!hero) return
    let alive = true
    const timeout = new Promise<Menu>((r) => window.setTimeout(() => r(null), MENU_WAIT_MS))
    const settle = new Promise((r) => window.setTimeout(r, reduced ? 0 : ENTER_AFTER_MS))
    void Promise.all([Promise.race([loadMenu(), timeout]), settle]).then(([menu]) => {
      if (!alive) return
      setCast(pickCast(menu, MAX_FOODS))
      setMounted(true)
    })
    return () => {
      alive = false
    }
  }, [hero, reduced])

  // Off the hero: let them hop away, then unmount.
  useEffect(() => {
    if (hero || !mounted) return
    const t = window.setTimeout(() => setMounted(false), reduced ? 0 : LEAVE_MS)
    return () => window.clearTimeout(t)
  }, [hero, mounted, reduced])

  if (!mounted || !cast) return null
  // Re-measure once the tray lands, so the spots respect where it really is.
  return <FoodsLayer cast={cast} leaving={!hero} reduced={reduced} coarse={coarse} measureKey={landed ? 1 : 0} />
}
