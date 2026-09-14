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

const WIDTH = 120
const HEIGHT = 28
const PAD = 2

export function Sparkline({
  lk,
  indicatorId,
  code,
  year,
}: {
  lk: Lookup
  indicatorId: string
  code: string
  year: number
}) {
  const series = lk.series(indicatorId)
  const segments = segmentsFor(lk, indicatorId, code)
  const values = segments.flat().map((p) => p.value)
  if (values.length === 0) return null

  const firstYear = series.years[0]!
  const lastYear = series.years[series.years.length - 1]!
  const low = Math.min(...values)
  const high = Math.max(...values)
  // A flat series would otherwise divide by zero; drawn down the middle, which is what it is.
  const span = high - low || 1

  const x = (y: number) =>
    lastYear === firstYear ? WIDTH / 2 : ((y - firstYear) / (lastYear - firstYear)) * WIDTH
  const yOf = (v: number) => PAD + (1 - (v - low) / span) * (HEIGHT - PAD * 2)

  const cursorAt = year >= firstYear && year <= lastYear ? x(year) : null

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
      {segments.map((segment) => (
        <path
          key={segment[0]!.year}
          data-segment=""
          fill="none"
          vectorEffect="non-scaling-stroke"
          d={segment.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.year)},${yOf(p.value)}`).join(' ')}
        />
      ))}
    </svg>
  )
}
