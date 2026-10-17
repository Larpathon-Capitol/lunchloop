import { createElement, useEffect, useMemo, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { sound } from '../shared/sound'
import { burstPetals } from './burst'
import { CelebrationScene, type SceneState } from './CelebrationScene'

export type CelebrateStep = 'stamp' | 'petals' | 'xp' | 'streak' | 'milestone'

export interface CelebratePackedOptions {
  /** The element the seal lands on (usually the tray or the Pack button). Without it, the seal lands near the top third of the screen. */
  anchorEl?: HTMLElement | null
  /** The streak after today's pack. */
  streak: number
  xpGained: number
  /** True for streak milestones. Use isStreakMilestone(streak). */
  isMilestone?: boolean
  /** Seal size in px. Default 104. */
  stampSize?: number
  /** Called as each beat starts, so the app can tick its own counters in time. */
  onStep?: (step: CelebrateStep) => void
  signal?: AbortSignal
}

/** Big full-screen moments stay rare: 3, 7, then every 10th day. */
export function isStreakMilestone(streak: number): boolean {
  return streak === 3 || streak === 7 || (streak >= 10 && streak % 10 === 0)
}

const T = { petals: 200, xp: 450, streak: 700, milestone: 1400, hold: 2500, fade: 300 }

let active: AbortController | null = null

/**
 * The "packed" reward in order: seal (0ms), petals (200), XP token (450), streak roll (700),
 * then the milestone overlay (1400) when it is one. Resolves when everything is gone.
 * Starting another one cancels the first. Never rejects.
 */
export function celebratePacked(opts: CelebratePackedOptions): Promise<void> {
  if (typeof document === 'undefined') return Promise.resolve()
  active?.abort()
  const ctl = new AbortController()
  active = ctl
  const { signal } = ctl
  opts.signal?.addEventListener('abort', () => ctl.abort(), { once: true })
  if (opts.signal?.aborted) ctl.abort()

  const size = opts.stampSize ?? 104
  const vw = window.innerWidth
  const vh = window.innerHeight
  let x = vw / 2
  let y = vh * 0.34
  if (opts.anchorEl) {
    const r = opts.anchorEl.getBoundingClientRect()
    x = r.left + r.width / 2
    y = r.top + r.height / 2
  }
  x = Math.max(size / 2 + 8, Math.min(vw - size / 2 - 8, x))
  y = Math.max(size / 2 + 40, Math.min(vh - size / 2 - 44, y))

  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  const state: SceneState = { stamp: false, xp: null, streak: null, milestone: null }
  let resolveMilestone: () => void = () => {}
  const draw = () => root.render(createElement(CelebrationScene, { x, y, size, state, onMilestoneClose: () => resolveMilestone() }))

  // Reduced motion: no waiting on decorative beats. Every step lands at once (state and
  // announcements only, no petals or sounds); only a milestone still waits for its close.
  const calm = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const started = performance.now()
  const sleepUntil = (ms: number) =>
    new Promise<void>((resolve) => {
      const left = ms - (performance.now() - started)
      if (calm || left <= 0 || signal.aborted) return resolve()
      const id = window.setTimeout(resolve, left)
      signal.addEventListener('abort', () => (window.clearTimeout(id), resolve()), { once: true })
    })
  const step = (s: CelebrateStep) => opts.onStep?.(s)

  return (async () => {
    try {
      state.stamp = true
      draw()
      step('stamp')

      await sleepUntil(T.petals)
      if (signal.aborted) return
      if (!calm) burstPetals({ x, y }, { count: 32 })
      step('petals')

      await sleepUntil(T.xp)
      if (signal.aborted) return
      if (opts.xpGained > 0) {
        state.xp = opts.xpGained
        draw()
        if (!calm) sound.pluck(5)
      }
      step('xp')

      await sleepUntil(T.streak)
      if (signal.aborted) return
      if (opts.streak > 0) {
        state.streak = opts.streak
        draw()
        if (!calm) sound.pluck(7)
      }
      step('streak')

      if (opts.isMilestone) {
        await sleepUntil(T.milestone)
        if (signal.aborted) return
        const closed = new Promise<void>((resolve) => {
          resolveMilestone = resolve
          signal.addEventListener('abort', () => resolve(), { once: true })
        })
        state.milestone = opts.streak
        draw()
        step('milestone')
        await closed
      } else if (calm) {
        // The page keeps its own seal and counters; the overlay just goes.
        return
      } else {
        await sleepUntil(T.hold)
        if (signal.aborted) return
        state.stamp = false
        state.streak = null
        draw()
        await sleepUntil(T.hold + T.fade)
      }
    } finally {
      if (active === ctl) active = null
      // Unmount after the current render pass.
      window.setTimeout(() => {
        root.unmount()
        host.remove()
      }, 0)
    }
  })()
}

/** Stop whatever celebration is on screen. */
export function cancelCelebration() {
  active?.abort()
}

/** Hook form. Returns stable functions, and cancels a running celebration if the component unmounts. */
export function useCelebrate() {
  const mine = useRef<AbortController | null>(null)
  useEffect(() => () => mine.current?.abort(), [])
  return useMemo(
    () => ({
      packed: (opts: CelebratePackedOptions) => {
        mine.current?.abort()
        const ctl = new AbortController()
        mine.current = ctl
        return celebratePacked({ ...opts, signal: opts.signal ?? ctl.signal })
      },
      petals: burstPetals,
      isMilestone: isStreakMilestone,
    }),
    [],
  )
}
