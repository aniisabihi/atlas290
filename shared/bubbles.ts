/**
 * How a value becomes a bubble.
 *
 * Shared by the kitchen, which lays the bubbles out, and the site, which draws them — because
 * the two make one promise between them: the kitchen reserves each municipality a slot as large
 * as the biggest bubble it ever takes, and the site draws a bubble inside it. If the two computed
 * radii differently, a year would come along in which a bubble was larger than its slot and lay
 * over its neighbour. So there is exactly one `radiusFor`, and both call it.
 *
 * **Size is relative to the year on screen.** The largest bubble is that year's highest value and
 * the smallest its lowest, whatever the measure. That is the question a bubble map is looked at
 * to answer — which one is biggest right now — and it is deliberately NOT the rule colour follows.
 * Colour keeps fixed class breaks across every year so a municipality that darkens has genuinely
 * changed (`IndicatorFields.scale`). A first version normalised size the same way and, for any
 * measure that trends the same direction everywhere, every bubble in the latest year came out the
 * same size: the tax rate in 2026 was a field of identical dots. Two channels, two questions —
 * colour says how high, size says who is highest — and the caption beside the picture says so.
 *
 * Nothing here imports the pantry schema, so `shared/pantry.ts` can import this to describe the
 * layout it publishes.
 */

export type ScaleKind = 'sequential' | 'diverging'

/**
 * Layout units. The kitchen's centroids arrive in a unit square — x over the frame's 1000, y over
 * its 2000 — and are scaled by this, so the layout box is 1000 wide and Sweden is drawn at half
 * its true height. The distortion is deliberate and is the one the layout has carried since
 * Plan 1: a country three times taller than it is wide would otherwise turn the cartogram into a
 * column with most of the panel empty either side. `src/map/frame.ts` fits the result into the
 * map's frame with one uniform scale, so a circle stays a circle.
 */
export const LAYOUT_SCALE = 1000

/**
 * The smallest bubble ever drawn, in layout units: the year's lowest value, or a municipality with
 * no value at all. Not zero, because a shape that vanished would take its accessible name, its
 * pattern fill and its tab stop with it. Eight rather than six: with six, dense clusters of tiny
 * bubbles around Stockholm left municipalities the arrow keys could never land on in seven of the
 * forty-two layouts; at eight every layout is reachable with the default spacing.
 */
export const MIN_R = 8

/**
 * How much of the 1000 × 1000 layout box the slots may fill between them.
 *
 * This is what keeps the country recognisable. Without a budget the first prototype gave every
 * slot near the maximum radius for any measure that had risen everywhere, and the 290 circles
 * inflated into a shapeless blob 300–460 units from home. The population layout this replaces
 * filled 12% of its box and drifted 28 units on average; at 13% every one of the 42 layouts
 * drifts between 11 and 23.
 */
export const AREA_BUDGET = 0.13

/** The two numbers the site needs to size a bubble the way the kitchen did. */
export type Sizing = { minR: number; maxR: number }

/**
 * Where each value of one year's column sits between the year's lowest and highest, 0 to 1.
 *
 * A diverging measure is compared by magnitude from zero rather than from its minimum: net
 * migration of −20 and +20 are equally large changes, and the colour ramp already says which way.
 * Absent stays absent — the caller draws those at the floor — and a year whose present values are
 * all equal puts each at 1, because each is that year's highest.
 */
export function sizeNorms(column: readonly (number | null)[], kind: ScaleKind): (number | null)[] {
  const magnitude = (v: number) => (kind === 'diverging' ? Math.abs(v) : v)
  let lo = kind === 'diverging' ? 0 : Infinity
  let hi = -Infinity
  for (const v of column) {
    if (v === null) continue
    lo = Math.min(lo, magnitude(v))
    hi = Math.max(hi, magnitude(v))
  }
  return column.map((v) => {
    if (v === null) return null
    if (hi <= lo) return 1
    return Math.min(1, Math.max(0, (magnitude(v) - lo) / (hi - lo)))
  })
}

/**
 * The radius for a norm: area affine between the floor and the maximum, so a norm of 0.5 is a
 * bubble with half the area of the largest — the way a bubble chart is read — never half the
 * radius, which would be a quarter of the area and would exaggerate every difference.
 */
export function radiusFor(norm: number | null, sizing: Sizing): number {
  if (norm === null) return sizing.minR
  const clamped = Math.min(1, Math.max(0, norm))
  return Math.sqrt(sizing.minR ** 2 + (sizing.maxR ** 2 - sizing.minR ** 2) * clamped)
}

/**
 * The largest radius that keeps the slots' total area on the budget.
 *
 * Each municipality's slot is `radiusFor` of the largest norm it takes in any year, so the total
 * slot area is `count · π · minR²` plus `π · (maxR² − minR²)` times the sum of those norms. This
 * solves that for `maxR`. Never below `minR`: a measure where nobody has a value would otherwise
 * ask for an imaginary radius.
 */
export function maxRadiusFor(
  sumOfMaxNorms: number,
  count: number,
  minR: number = MIN_R,
  budget: number = AREA_BUDGET,
): number {
  const area = budget * LAYOUT_SCALE * LAYOUT_SCALE
  const spare = area / Math.PI - count * minR * minR
  if (sumOfMaxNorms <= 0 || spare <= 0) return minR
  return Math.sqrt(minR * minR + spare / sumOfMaxNorms)
}
