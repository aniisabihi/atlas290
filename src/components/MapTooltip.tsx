/** How close to the top of the window the pointer has to be before the box flips under it. */
const FLIP_BELOW_PX = 120

/**
 * What a shape says when you point at it.
 *
 * **It is not in the accessibility tree.** Every path already carries its whole reading in its
 * `aria-label` — "Upplands Väsby, 50 495 invånare" — and the live region announces the same
 * thing as focus moves. A tooltip wired in as well would say it a second time, so this is
 * `aria-hidden` and purely visual: it gives a pointer the reading a keyboard and a screen reader
 * already had, which is the gap it exists to close.
 *
 * Positioned in viewport coordinates because it is `position: fixed`: the map scrolls, the
 * plate has its own padding, and a tooltip anchored inside the SVG would have to be translated
 * out of frame units on every pointer move.
 */
export function MapTooltip({
  name,
  reading,
  rank,
  x,
  y,
}: {
  name: string
  reading: string
  /** Absent where the municipality has no value this year, so there is nothing to rank. */
  rank: string | null
  x: number
  y: number
}) {
  return (
    <div
      className="map-tooltip"
      role="presentation"
      aria-hidden="true"
      data-testid="map-tooltip"
      // Above the pointer normally, below it near the top of the window. Kiruna sits at the top
      // of the frame, so the one municipality most likely to be pointed at first was also the
      // one whose reading would have been drawn off the screen.
      data-below={y < FLIP_BELOW_PX ? 'true' : undefined}
      style={{ left: `${Math.round(x)}px`, top: `${Math.round(y)}px` }}
    >
      <span className="map-tooltip-name">{name}</span>
      <span className="map-tooltip-value">{reading}</span>
      {rank !== null && <span className="map-tooltip-rank">{rank}</span>}
    </div>
  )
}
