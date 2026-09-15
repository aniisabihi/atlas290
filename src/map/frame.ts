import type { Bubbles } from '../../shared/pantry'
import { FRAME } from '../../shared/geometry'

/**
 * Putting the bubble layout inside the map's frame, so the two views share one coordinate
 * system and a shape can travel between them.
 *
 * The map is projected into a 1000x2000 frame (`shared/geometry.ts`). The bubble layout is
 * published in a unit square, and not even a square one in practice: the committed layout runs
 * x from 0.060 to 0.891 and y from 0.063 to 1.049, because a circle's radius may spill past the
 * edge its centre sits near.
 *
 * **The scale has to be uniform or a circle stops being a circle.** Multiplying x by the frame's
 * width and y by its height is the obvious thing and it is wrong twice over: the layout comes
 * out stretched to twice its height, and every radius would need two different values depending
 * on which way it was measured. The morph prototype did exactly this, and its stills show the
 * bubbles running off the bottom of the frame.
 *
 * So: one scale for both axes, chosen so the whole layout fits, and one offset that centres what
 * is left over.
 */

export type Placement = {
  /** Multiply a layout coordinate by this to get frame units. */
  scale: number
  /** Then add these. */
  offsetX: number
  offsetY: number
}

export type PlacedCircle = { code: string; x: number; y: number; r: number }

/** The layout's own extent, radii included, because a circle near the edge sticks out. */
export function boundsOf(circles: Bubbles['circles']): {
  minX: number
  minY: number
  maxX: number
  maxY: number
} {
  if (circles.length === 0) throw new Error('bubble layout has no circles to place')
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const c of circles) {
    minX = Math.min(minX, c.x - c.r)
    minY = Math.min(minY, c.y - c.r)
    maxX = Math.max(maxX, c.x + c.r)
    maxY = Math.max(maxY, c.y + c.r)
  }
  return { minX, minY, maxX, maxY }
}

/**
 * Where the layout sits inside `frame`, with `padding` in frame units left around it.
 *
 * The scale is the smaller of the two axes' ratios — "fit", not "fill" — so nothing is ever
 * clipped. Which axis wins depends on the layout and the frame, so it is computed rather than
 * assumed: the committed layout is wider than it is tall relative to the 1:2 frame, so today the
 * width decides, and a future layout may not.
 */
export function placementFor(
  circles: Bubbles['circles'],
  frame: readonly [number, number] = FRAME,
  padding = 20,
): Placement {
  const { minX, minY, maxX, maxY } = boundsOf(circles)
  const [width, height] = frame
  const usableWidth = width - padding * 2
  const usableHeight = height - padding * 2
  const spanX = maxX - minX
  const spanY = maxY - minY
  if (spanX <= 0 || spanY <= 0) {
    throw new Error(`bubble layout has no extent: ${spanX} by ${spanY}`)
  }
  const scale = Math.min(usableWidth / spanX, usableHeight / spanY)
  return {
    scale,
    offsetX: padding + (usableWidth - spanX * scale) / 2 - minX * scale,
    offsetY: padding + (usableHeight - spanY * scale) / 2 - minY * scale,
  }
}

export function place(circle: PlacedCircle, at: Placement): PlacedCircle {
  return {
    code: circle.code,
    x: circle.x * at.scale + at.offsetX,
    y: circle.y * at.scale + at.offsetY,
    // One scale, so the radius needs no direction. This is the whole point of `placementFor`.
    r: circle.r * at.scale,
  }
}

export function placeAll(
  circles: Bubbles['circles'],
  frame: readonly [number, number] = FRAME,
  padding = 20,
): PlacedCircle[] {
  const at = placementFor(circles, frame, padding)
  return circles.map((c) => place(c, at))
}
