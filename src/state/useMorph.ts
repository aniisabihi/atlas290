import { useEffect, useRef } from 'react'

/**
 * The clock behind the morph: a `t` that travels between 0 (the map) and 1 (the bubbles).
 *
 * It is deliberately NOT in the URL. A link to "40% of the way to the bubbles" is not a view
 * anybody wants to share, and the project's rule that everything rendered is a function of the
 * address bar is about what a visitor can *reach* — which is still exactly the two ends.
 */

/** How long the whole journey takes. Long enough to read as travel, short enough not to wait. */
export const MORPH_MS = 650

/**
 * Ease in and out, so the 290 shapes start and stop together rather than snapping into motion.
 * The standard cubic; written out because pulling in an easing library for six lines would be a
 * dependency to audit and license for nothing.
 */
export function easeInOut(t: number): number {
  if (t <= 0) return 0
  if (t >= 1) return 1
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

/**
 * Drives `t` toward `target`, easing, on a requestAnimationFrame loop.
 *
 * **With reduced motion it never schedules a frame at all.** Not a shorter morph, not a faster
 * one: the value is simply the target, derived rather than animated, and the views cross-fade in
 * CSS instead. The whole point of the setting is that large movement is unpleasant or harmful
 * for some people, and a 290-shape flight across the screen is the largest movement this site
 * has.
 *
 * **Reversing mid-flight does not jump.** Changing the target while `t` is 0.4 restarts the
 * clock from where it is rather than from the far end, so a visitor who changes their mind sees
 * the shapes turn round rather than teleport. The duration is scaled by the distance left, so a
 * short return trip is not given the full 650 ms.
 */
/**
 * Calls `onFrame(t)` for every frame of the journey, and once on arrival.
 *
 * **It deliberately does not hold `t` in React state.** The first version did, and re-rendering
 * 290 path components sixty times a second is a different piece of work from moving them: with
 * the throttle at 4x and 6x, 13 to 16 frames of every 67 were dropped, against an isolated
 * benchmark that said a morph costs 10 ms at 6x. The benchmark was measuring `setAttribute` on
 * 290 nodes; the component was measuring React reconciling 290 elements, recomputing every fill,
 * every accessible name and every observation lookup — none of which change while the shapes are
 * moving.
 *
 * So the caller writes the frame itself, straight to the nodes. React owns the resting states
 * and everything that is not moving; this owns `d`.
 *
 * `onFrame` is held in a ref rather than listed as a dependency, so a caller that passes an
 * inline arrow function does not restart the animation on every render.
 */
export function useMorph(
  target: 0 | 1,
  reducedMotion: boolean,
  onFrame: (t: number) => void,
): void {
  /**
   * Where the morph actually is, for the next animation to start from. Written only inside the
   * effect and its frame callback, never during render — a ref touched while rendering is a
   * value React is free to discard, and the lint rule that says so is right.
   */
  const position = useRef<number>(target)
  const frame = useRef<number | null>(null)
  const latest = useRef(onFrame)
  useEffect(() => {
    latest.current = onFrame
  })

  useEffect(() => {
    if (reducedMotion) {
      // Not a shorter morph or a faster one: none at all. Straight to the far end.
      position.current = target
      latest.current(target)
      return
    }

    const from = position.current
    if (from === target) {
      latest.current(target)
      return
    }

    const duration = MORPH_MS * Math.abs(target - from)
    const started = performance.now()

    const tick = (now: number) => {
      const progress = duration <= 0 ? 1 : Math.min(1, (now - started) / duration)
      // `easeInOut(1)` is exactly 1, so the final frame lands exactly on the target — which is
      // what `morphD` needs in order to draw the real geometry rather than a proxy at 0.9999.
      const value = from + (target - from) * easeInOut(progress)
      position.current = value
      latest.current(value)
      frame.current = progress < 1 ? requestAnimationFrame(tick) : null
    }
    frame.current = requestAnimationFrame(tick)

    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current)
      frame.current = null
    }
  }, [target, reducedMotion])
}
