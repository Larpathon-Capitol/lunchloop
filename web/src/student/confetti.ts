import confetti from 'canvas-confetti'

const TOKENS = ['--accent', '--accent-mark', '--ink', '--slate', '--line']

/**
 * A short burst from an element, in the app's own colors. Skipped for reduced motion.
 * It draws on its own canvas, hidden from screen readers and removed when the burst ends.
 */
export function burstFrom(el: Element | null, reduce: boolean) {
  if (reduce || !el) return
  const styles = getComputedStyle(document.documentElement)
  const colors = TOKENS.map((t) => styles.getPropertyValue(t).trim()).filter(Boolean)
  const r = el.getBoundingClientRect()
  const origin = { x: (r.left + r.width / 2) / window.innerWidth, y: (r.top + r.height / 2) / window.innerHeight }

  const canvas = document.createElement('canvas')
  canvas.setAttribute('aria-hidden', 'true')
  canvas.className = 'confetti-canvas'
  Object.assign(canvas.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '60' })
  document.body.appendChild(canvas)
  const fire = confetti.create(canvas, { resize: true, disableForReducedMotion: true })

  const base = { origin, colors, scalar: 0.9, ticks: 160 }
  const bursts = [
    fire({ ...base, particleCount: 70, spread: 70, startVelocity: 38 }),
    fire({ ...base, particleCount: 40, spread: 120, startVelocity: 26, decay: 0.92 }),
  ]
  void Promise.all(bursts).finally(() => {
    fire.reset()
    canvas.remove()
  })
}
