import { observationAt, type Lookup } from '../data/select'

/**
 * One indicator's whole history for one municipality, small.
 *
 * Twenty lines of SVG rather than a charting library: the shape is a polyline and a cursor, and
 * a library would bring layout, axes and tooltips this does not want.
 *
 * The thing it has to get right is **absence**. A gap in the series is a gap in the line, never a
 * straight segment across it — drawing through the years Knivsta did not exist would invent a
 * history, and drawing through a suppressed house-price year would invent a price. So the series
 * is cut into runs of consecutive published values and each run is its own path.
 *
 * The vertical scale is the municipality's own range. A scale shared across ten indicators of
 * different units would be meaningless, and one shared across all 290 municipalities would flatten
 * every small one into a straight line.
 *
 * The HORIZONTAL scale is the opposite: every sparkline on the page shares one axis, the whole
 * span the pantry covers. Normalised to its own years instead — which is what this did until
 * Plan 10 — all ten lines came out the same length, so a measure first published in 1991 read as
 * though it had been collected since 1968. On a shared axis the short ones visibly start late and
 * stop early. That is "absence is never zero", applied to the picture rather than the number.
 */

export type Point = { year: number; value: number }

export function segmentsFor(lk: Lookup, indicatorId: string, code: string): Point[][] {
  const series = lk.series(indicatorId)
  const segments: Point[][] = []
  let run: Point[] = []
  for (const year of series.years) {
    const { value } = observationAt(lk, indicatorId, code, year)
    if (value === null) {
      if (run.length > 0) segments.push(run)
      run = []
      continue
    }
    run.push({ year, value })
  }
  if (run.length > 0) segments.push(run)
  return segments
}

const WIDTH = 170
const HEIGHT = 40
const PAD = 3

/**
 * The one axis every sparkline is drawn on: the first and last year ANY indicator covers.
 * Derived rather than written down, so adding an eleventh indicator with a longer history moves
 * every line at once instead of leaving nine of them quietly lying.
 */
export function axisFor(lk: Lookup): [number, number] {
  let first = Infinity
  let last = -Infinity
  for (const row of lk.data.series) {
    first = Math.min(first, row.years[0]!)
    last = Math.max(last, row.years[row.years.length - 1]!)
  }
  return [first, last]
}

export function Sparkline({
  lk,
  indicatorId,
  code,
  compare,
  year,
}: {
  lk: Lookup
  indicatorId: string
  code: string
  /** A second municipality, drawn in the same frame. */
  compare?: string | undefined
  year: number
}) {
  const series = lk.series(indicatorId)
  const segments = segmentsFor(lk, indicatorId, code)
  // Both series share ONE vertical scale. Two lines scaled independently look comparable and are
  // not — the whole reason to put them in one frame is that their heights mean the same thing.
  const other = compare ? segmentsFor(lk, indicatorId, compare) : []
  const values = [...segments, ...other].flat().map((p) => p.value)
  if (values.length === 0) return null

  const [firstYear, lastYear] = axisFor(lk)
  const covers = { from: series.years[0]!, to: series.years[series.years.length - 1]! }
  const low = Math.min(...values)
  const high = Math.max(...values)
  // A flat series would otherwise divide by zero; drawn down the middle, which is what it is.
  const span = high - low || 1

  const x = (y: number) =>
    lastYear === firstYear
      ? WIDTH / 2
      : PAD + ((y - firstYear) / (lastYear - firstYear)) * (WIDTH - PAD * 2)
  const yOf = (v: number) => PAD + (1 - (v - low) / span) * (HEIGHT - PAD * 2)

  // Positioned on the shared axis, but shown only where THIS measure has a line to mark. A
  // cursor on a year the indicator does not cover would point at empty space and imply a value.
  const cursorAt = year >= covers.from && year <= covers.to ? x(year) : null

  const last = segments[segments.length - 1]
  const end = last ? last[last.length - 1]! : null

  return (
    // Hidden from assistive technology on purpose: it is a picture of numbers that are already
    // on the page as text, in this row and in the table twin. Announcing it again would be
    // noise, and there is no useful way to speak a polyline.
    <svg
      className="sparkline"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      width={WIDTH}
      height={HEIGHT}
      aria-hidden="true"
      focusable="false"
    >
      {cursorAt !== null && (
        <line
          data-cursor=""
          x1={cursorAt}
          y1={0}
          x2={cursorAt}
          y2={HEIGHT}
          vectorEffect="non-scaling-stroke"
        />
      )}
      <line
        data-baseline=""
        x1={PAD}
        y1={HEIGHT - PAD}
        x2={WIDTH - PAD}
        y2={HEIGHT - PAD}
        vectorEffect="non-scaling-stroke"
      />
      {other.map((segment) => (
        <path
          key={`b-${segment[0]!.year}`}
          data-compare=""
          fill="none"
          vectorEffect="non-scaling-stroke"
          d={segment.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.year)},${yOf(p.value)}`).join(' ')}
        />
      ))}
      {segments.map((segment) => {
        const line = segment
          .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.year)},${yOf(p.value)}`)
          .join(' ')
        return (
          <g key={segment[0]!.year}>
            {!compare && (
              <path
                data-area=""
                d={`${line} L${x(segment[segment.length - 1]!.year)},${HEIGHT - PAD} L${x(segment[0]!.year)},${HEIGHT - PAD} Z`}
              />
            )}
            <path data-segment="" fill="none" vectorEffect="non-scaling-stroke" d={line} />
          </g>
        )
      })}
      {end && <circle data-end="" cx={x(end.year)} cy={yOf(end.value)} r={2.6} />}
    </svg>
  )
}
