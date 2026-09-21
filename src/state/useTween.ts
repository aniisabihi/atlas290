import { useLayoutEffect, useRef } from 'react'
import { easeInOut } from './useMorph'

/**
 * A clock that runs from 0 to 1 every time `key` changes, and does nothing else.
 *
 * `useMorph` is the clock behind the map↔bubbles journey: a `t` that travels between two ends
 * and can turn round. This is its simpler sibling for the bubbles' OTHER movements, which Plan 21
 * introduced: a change of year resizes every bubble in place, and a change of indicator moves
 * them to that indicator's own layout. Neither has a "back"; each is a departure from wherever
 * the bubbles happen to be drawn toward where they now belong, so a fresh run from 0 is the
 * right shape, and the caller snapshots the "from" state when it sees the key change.
 *
 * Like `useMorph` it pushes frames to a callback rather than holding progress in state, because
 * re-rendering 290 shapes sixty times a second is a different piece of work from moving them.
 *
 * **The first frame is written in a layout effect**, before the browser paints. React has by
 * then committed the RESTING markup — every shape already at its destination — and a `useEffect`
 * would leave that painted for one frame before the animation pulled the shapes back to their
 * start, which reads as a flash. Synchronous with the commit, no frame shows the destination
 * early.
 *
 * **Reduced motion never schedules a frame.** The callback gets 1 at once, so the bubbles simply
 * take their new sizes and places, as the setting asks.
 */
export const TWEEN_MS = 450

export function useTween(
  key: unknown,
  reducedMotion: boolean,
  onFrame: (progress: number) => void,
): void {
  const latest = useRef(onFrame)
  useLayoutEffect(() => {
    latest.current = onFrame
  })

  const frame = useRef<number | null>(null)
  const first = useRef(true)

  useLayoutEffect(() => {
    // Mounting is not a change: whatever is on screen is already where it belongs.
    if (first.current) {
      first.current = false
      latest.current(1)
      return
    }
    if (reducedMotion) {
      latest.current(1)
      return
    }

    const started = performance.now()
    latest.current(0)
    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / TWEEN_MS)
      latest.current(easeInOut(progress))
      frame.current = progress < 1 ? requestAnimationFrame(tick) : null
    }
    frame.current = requestAnimationFrame(tick)

    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current)
      frame.current = null
    }
    // `key` is not read inside the effect; it IS the effect's trigger, which is this hook's whole
    // contract — "run once each time the key changes" — so the lint rule's "extra dependency"
    // is the point rather than a mistake.
    // eslint-disable-next-line react/exhaustive-effect-dependencies
  }, [key, reducedMotion])
}
