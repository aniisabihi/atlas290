import { useEffect, useRef, useState } from 'react'

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
export function useMorph(target: 0 | 1, reducedMotion: boolean): number {
  const [animated, setAnimated] = useState<number>(target)
  /**
   * Where the morph actually is, for the next animation to start from.
   *
   * Written only inside the effect and its frame callback, never during render — a ref touched
   * while rendering is a value React is free to discard, and the lint rule that says so is
   * right.
   */
  const position = useRef<number>(target)
  const frame = useRef<number | null>(null)

  useEffect(() => {
    if (reducedMotion) {
      // No frames, and no setState from an effect: the returned value is derived below. The ref
      // is still kept honest so that turning the setting off mid-session resumes from the right
      // place rather than from wherever the last animation stopped.
      position.current = target
      return
    }

    const from = position.current
    if (from === target) return

    const distance = Math.abs(target - from)
    const duration = MORPH_MS * distance
    const started = performance.now()

    const tick = (now: number) => {
      const progress = duration <= 0 ? 1 : Math.min(1, (now - started) / duration)
      // `easeInOut(1)` is exactly 1, so the final frame lands exactly on the target — which is
      // what `morphD` needs in order to draw the real geometry rather than a proxy at 0.9999.
      const value = from + (target - from) * easeInOut(progress)
      position.current = value
      setAnimated(value)
      frame.current = progress < 1 ? requestAnimationFrame(tick) : null
    }
    frame.current = requestAnimationFrame(tick)

    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current)
      frame.current = null
    }
  }, [target, reducedMotion])

  /**
   * Derived rather than stored for the reduced-motion case.
   *
   * One consequence, small and deliberate: if the visitor turns the system setting off while a
   * view change is on screen, the single render between that and the effect running shows the
   * last animated value. The next frame is correct. Writing state during render to close a
   * one-frame gap in a setting nobody toggles mid-session would be the worse trade.
   */
  return reducedMotion ? target : animated
}
