import type { PlacedCircle } from './frame'

/**
 * Turning a municipality's outline and its bubble into two point lists the same length, so one
 * can be interpolated into the other.
 *
 * **Why resample at all.** A map path and a circle have nothing in common: Ekerö's coastline is
 * 194 points and a circle is one `A` command. There is no way to interpolate between them
 * directly, so both ends are sampled at a fixed number of points around their perimeter and the
 * morph is a straight lerp between the two lists.
 *
 * **Why the ends are not the resampling.** At rest the map draws its real 194-point coastline
 * and the cartogram draws a real circle. The proxies are used only while `0 < t < 1`, where
 * everything is moving and nobody can see the difference. That is what lets the sample count be
 * chosen for the frame budget rather than for fidelity.
 */

export type Point = readonly [number, number]

/**
 * How many points each end is sampled at.
 *
 * Chosen by measurement, not by eye. Per-frame work for all 290 shapes under Chromium's CPU
 * throttling, against a 16.7 ms budget (4x-6x is the usual stand-in for a mid-range phone):
 *
 *            1x     2x     4x     6x    10x
 *   16     0.97   1.97   3.98   5.94   10.4
 *   32     1.59   3.40   6.67  10.12  17.47   <- misses at 10x
 *   64     2.84   5.98  12.06  18.01  34.67   <- misses at 6x
 *
 * The rule is the most faithful resampling that still fits on a phone-class device, and 32 is
 * it. Not chosen for looks: 16 and 32 are nearly indistinguishable mid-morph at the sizes
 * involved, and 16 would have been chosen had 32 not fitted. If a real device ever proves
 * slower than 6x, the fix is to drop this number, not to add a second renderer — 16 still fits
 * at 10x.
 */
export const SAMPLE_POINTS = 32

/**
 * Equally spaced points around a path, using the browser's own measurement.
 *
 * `getTotalLength`/`getPointAtLength` walk every subpath in order, so the 13 municipalities made
 * of several islands sample without special handling — the samples are simply distributed along
 * the total outline, spending more points on the larger island.
 *
 * Needs a real `SVGPathElement`, which is why this lives in the site and not in the kitchen:
 * there is no DOM in the pipeline to measure a path with.
 */
export function sampleOutline(path: SVGPathElement, d: string, n = SAMPLE_POINTS): Point[] {
  path.setAttribute('d', d)
  const total = path.getTotalLength()
  if (!Number.isFinite(total) || total <= 0) {
    throw new Error(`cannot sample a path of length ${total}`)
  }
  const points: Point[] = []
  for (let i = 0; i < n; i++) {
    const p = path.getPointAtLength((total * i) / n)
    points.push([p.x, p.y])
  }
  return points
}

/**
 * The same number of points around a circle, starting at `startAngle`.
 *
 * The start angle is not arbitrary. Both lists are walked in the same order during the lerp, so
 * point 0 of the outline travels to point 0 of the circle — and if the circle always started at
 * three o'clock, every municipality whose outline happens to start somewhere else would rotate
 * on its way over. Starting the circle at the angle the shape's own first point sits at, seen
 * from its middle, means each point travels roughly outward rather than around.
 */
export function sampleCircle(
  circle: Pick<PlacedCircle, 'x' | 'y' | 'r'>,
  startAngle: number,
  n = SAMPLE_POINTS,
): Point[] {
  const points: Point[] = []
  for (let i = 0; i < n; i++) {
    const angle = startAngle + (2 * Math.PI * i) / n
    points.push([circle.x + circle.r * Math.cos(angle), circle.y + circle.r * Math.sin(angle)])
  }
  return points
}

/** The mean of a point list — the shape's middle, for choosing the circle's start angle. */
export function middleOf(points: readonly Point[]): Point {
  if (points.length === 0) throw new Error('no points to average')
  let x = 0
  let y = 0
  for (const p of points) {
    x += p[0]
    y += p[1]
  }
  return [x / points.length, y / points.length]
}

/** The angle of a shape's first sampled point, seen from its middle. */
export function startAngleFor(outline: readonly Point[]): number {
  const [mx, my] = middleOf(outline)
  const first = outline[0]
  if (!first) throw new Error('no points to take a start angle from')
  return Math.atan2(first[1] - my, first[0] - mx)
}

export type MorphPair = {
  code: string
  /** The real path data, drawn at each end. */
  mapD: string
  cartogramD: string
  /** The proxies, used only in between. */
  from: Point[]
  to: Point[]
}

export function circlePath(circle: Pick<PlacedCircle, 'x' | 'y' | 'r'>): string {
  const { x, y, r } = circle
  // Two arcs rather than one: a single 360° arc has identical start and end points, which is
  // undefined in SVG and renders as nothing.
  return `M${x - r} ${y}A${r} ${r} 0 1 0 ${x + r} ${y}A${r} ${r} 0 1 0 ${x - r} ${y}Z`
}

export function pairFor(
  path: SVGPathElement,
  code: string,
  mapD: string,
  circle: PlacedCircle,
  n = SAMPLE_POINTS,
): MorphPair {
  const from = sampleOutline(path, mapD, n)
  const to = sampleCircle(circle, startAngleFor(from), n)
  return { code, mapD, cartogramD: circlePath(circle), from, to }
}

/** How many decimals a coordinate carries into the `d` string while moving. */
const PRECISION = 1

/**
 * The path to draw at `t`.
 *
 * Exactly 0 and exactly 1 return the real geometry — the full coastline and the true circle —
 * so the resampling is never what a stationary visitor looks at.
 */
export function morphD(pair: MorphPair, t: number): string {
  if (t <= 0) return pair.mapD
  if (t >= 1) return pair.cartogramD
  const { from, to } = pair
  let d = 'M'
  for (let i = 0; i < from.length; i++) {
    const a = from[i]!
    const b = to[i]!
    d +=
      (i ? 'L' : '') +
      (a[0] + (b[0] - a[0]) * t).toFixed(PRECISION) +
      ' ' +
      (a[1] + (b[1] - a[1]) * t).toFixed(PRECISION)
  }
  return d + 'Z'
}
