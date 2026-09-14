import { useEffect, useState } from 'react'

/**
 * One polite live region for the whole page.
 *
 * Debounced, or it is worse than useless. Dragging the year across the century would otherwise
 * queue 59 announcements, and the range input already announces its own value while dragging; the
 * region waits for things to settle and then says one sentence about the map.
 *
 * Silent while the year is playing. A sentence per second is noise, and a visitor who pressed
 * play asked for motion, not narration — they can pause to hear where they are.
 */
export const SETTLE_MS = 500

export function LiveRegion({
  message,
  silent = false,
  settleMs = SETTLE_MS,
}: {
  message: string
  silent?: boolean
  settleMs?: number
}) {
  /**
   * The message the timer has actually settled on. Comparing it to the current message during
   * render — rather than clearing it from inside the effect — means a message that has changed
   * since the last settle simply reads as empty, with no second render to do it.
   */
  const [settled, setSettled] = useState<string | null>(null)

  useEffect(() => {
    if (silent) return
    const timer = setTimeout(() => setSettled(message), settleMs)
    return () => clearTimeout(timer)
  }, [message, silent, settleMs])

  const announced = !silent && settled === message ? message : ''

  return (
    <div aria-live="polite" aria-atomic="true" className="live-region" data-live-region="">
      {announced}
    </div>
  )
}
