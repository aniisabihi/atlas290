import {
  OBSERVATION_STATUS,
  type IndicatorSeries,
  type ObservationStatus,
} from '../../shared/pantry'

/**
 * The arithmetic behind the facts, and nothing else.
 *
 * Every function here takes numbers and returns numbers. None knows what an indicator is, which
 * language the site is in, or how a sentence is worded — which is what makes them checkable by
 * hand, and what keeps a phrasing change from quietly altering a claim.
 */

/** One published observation: a year, a value, and why it is what it is. */
export type Point = { year: number; value: number; status: ObservationStatus }

/**
 * The largest integer SCB's Cell Key Method can add to or subtract from a published count.
 *
 * SCB's own words, quoted in docs/research/reports/scb-pxweb.md: frequencies are "justeras med
 * ett litet negativt eller positivt heltal, eller lämnas oförändrade", in the range −3…+3. Read
 * from the research report rather than assumed, because every guard below depends on it being
 * the real bound and not a plausible one.
 *
 * It matters concretely. In the committed pantry the population series carries exactly two
 * statuses — 16,368 `present` and 290 `perturbed`, the latter being every municipality's 2025
 * figure — and several municipalities change by 0, 1 or 2 people between 2024 and 2025. A run
 * of growth extended into 2025 on a one-person step is therefore not a fact about anywhere; it
 * is a fact about the noise.
 */
export const CKM_MAX_NOISE = 3

/** Every published observation of one municipality, absences removed, in year order. */
export function pointsFor(series: IndicatorSeries, row: number): Point[] {
  const values = series.values[row]
  const statuses = series.status[row]
  if (!values || !statuses) return []
  const points: Point[] = []
  for (const [col, year] of series.years.entries()) {
    const value = values[col]
    if (value === null || value === undefined) continue
    const status = OBSERVATION_STATUS[statuses[col] ?? 0]
    if (!status)
      throw new Error(`${series.indicator} row ${row} col ${col}: status byte out of range`)
    points.push({ year, value, status })
  }
  return points
}

/**
 * Whether the direction of the step from `before` to `after` is a fact rather than noise.
 *
 * A step is trustworthy when neither end is perturbed, or when it is larger than the
 * perturbation could account for. Each perturbed end can move by up to `CKM_MAX_NOISE`, so a
 * step with one perturbed end needs to exceed that, and one with two perturbed ends needs to
 * exceed twice it.
 *
 * Strictly greater, not greater-or-equal: a step of exactly the bound could have been produced
 * entirely by the noise.
 */
export function stepIsReal(before: Point, after: Point): boolean {
  const perturbed = (before.status === 'perturbed' ? 1 : 0) + (after.status === 'perturbed' ? 1 : 0)
  if (perturbed === 0) return true
  return Math.abs(after.value - before.value) > perturbed * CKM_MAX_NOISE
}

export type Run = { years: number; from: number; to: number }

/**
 * The longest unbroken stretch of movement in one direction, as a number of year-to-year steps.
 *
 * `years` counts steps, not observations: a fall from 1968 to 2015 is 47 steps across 48
 * published figures, and "fell every year for 47 years" is what that means in a sentence.
 *
 * A step whose direction cannot be trusted (see `stepIsReal`) ends the run rather than
 * extending it — it is treated as a stop, not as a reversal, because what it actually means is
 * "we cannot tell". That is the conservative reading: it can shorten a run that was real, and
 * cannot invent one that was not.
 *
 * A gap in the years ends the run too. Two observations either side of an unpublished decade
 * do not make a consecutive pair, and calling them one would turn "every year" into a lie.
 */
export function longestRun(points: readonly Point[], direction: 1 | -1): Run | null {
  let best: Run | null = null
  let startIndex = 0
  let length = 0
  for (let i = 1; i < points.length; i++) {
    const before = points[i - 1]!
    const after = points[i]!
    const consecutive = after.year === before.year + 1
    const moved = Math.sign(after.value - before.value) === direction
    if (consecutive && moved && stepIsReal(before, after)) {
      if (length === 0) startIndex = i - 1
      length += 1
      if (!best || length > best.years) {
        best = { years: length, from: points[startIndex]!.year, to: after.year }
      }
    } else {
      length = 0
    }
  }
  return best
}

export type Reversal = {
  peak: Point
  trough: Point
  latest: Point
  /** Percentage fall from peak to trough, negative. */
  fall: number
  /** Percentage rise from trough to the latest figure, positive. */
  recovery: number
}

/**
 * A municipality that fell to a low point and then came back.
 *
 * The trough must be interior and must be `minYearsSince` years or more before the end, so a
 * dip last year does not count as a recovery nobody has seen yet. The peak is the highest
 * figure BEFORE the trough — a later high is part of the recovery, not the thing that was lost.
 *
 * Returns null unless both halves clear their thresholds, because "fell 1% and recovered 1%"
 * is a description of ordinary noise rather than a reversal.
 */
export function reversal(
  points: readonly Point[],
  options: { minFallPercent: number; minRecoveryPercent: number; minYearsSince: number },
): Reversal | null {
  const first = points[0]
  const latest = points[points.length - 1]
  if (!first || !latest || points.length < 3) return null

  let trough = first
  for (const p of points) if (p.value < trough.value) trough = p
  if (trough.year === first.year) return null
  if (latest.year - trough.year < options.minYearsSince) return null

  let peak = first
  for (const p of points) if (p.year <= trough.year && p.value > peak.value) peak = p
  if (peak.value === 0 || trough.value === 0) return null

  const fall = ((trough.value - peak.value) / peak.value) * 100
  const recovery = ((latest.value - trough.value) / trough.value) * 100
  if (-fall < options.minFallPercent || recovery < options.minRecoveryPercent) return null

  return { peak, trough, latest, fall, recovery }
}

export type Share = { matching: number; comparable: number }

/**
 * How many municipalities satisfy something, out of how many could be asked.
 *
 * The denominator is the point. Six municipalities did not exist in 1968, so "124 of 290 have
 * fewer people than in 1968" is false and "124 of 284" is true; a municipality with no figure
 * at one end is not a municipality that fails the test, it is one the question cannot be put
 * to. `answer` returns null to say so, and null never counts either way.
 */
export function shareOf<T>(items: readonly T[], answer: (item: T) => boolean | null): Share {
  let matching = 0
  let comparable = 0
  for (const item of items) {
    const verdict = answer(item)
    if (verdict === null) continue
    comparable += 1
    if (verdict) matching += 1
  }
  return { matching, comparable }
}

export type Extremes<T> = { highest: T; lowest: T; comparable: number }

/**
 * The highest and lowest of a set, with how many actually had a value.
 *
 * Ties are broken by `tieBreak` so a rebuild produces the same fact rather than whichever of
 * two equal municipalities the array happened to hold first.
 */
export function extremesOf<T>(
  items: readonly T[],
  valueOf: (item: T) => number | null,
  tieBreak: (item: T) => string,
): Extremes<T> | null {
  const present = items
    .map((item) => ({ item, value: valueOf(item) }))
    .filter((x): x is { item: T; value: number } => x.value !== null)
  if (present.length < 2) return null
  present.sort((a, b) => b.value - a.value || tieBreak(a.item).localeCompare(tieBreak(b.item)))
  return {
    highest: present[0]!.item,
    lowest: present[present.length - 1]!.item,
    comparable: present.length,
  }
}
