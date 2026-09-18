import type { PantryData, Similar } from '../../../shared/pantry'
import { nearest, sharedDimensions, windowMean, type Feature } from './distance'
import { isLogged, zScoresForYear } from './standardise'

/**
 * "Places like this", computed once from the whole pantry.
 *
 * Every municipality gets the five others closest to it across all ten indicators, averaged
 * over the last ten complete years. The decisions behind those choices, and the measurements
 * that forced them, are in docs/decisions/0002-similarity-metric.md; the short version is that
 * a single year is noise, raw values make the whole thing a test of "is it Stockholm", and a
 * per-year version cannot exist before 2009 because the tax rate series starts in 2000.
 */

/** How many years the standard scores are averaged over. */
export const WINDOW_YEARS = 10

/** How many neighbours each municipality gets. */
export const NEIGHBOURS = 5

/**
 * How many indicators may be missing from a comparison before the two are not neighbours.
 *
 * Expressed as a number of holes rather than a number of indicators, so it still means the
 * same thing the day an eleventh indicator is added — `MIN_SHARED = 8` written as a literal
 * would silently loosen from "two may be missing" to "three may be missing" instead.
 *
 * Two is one step of slack over what actually occurs. Averaged across the ten-year window,
 * exactly ONE municipality in the committed pantry loses a dimension: Dorotea, which has no
 * house price in any of 2015-2024. The other four suppressed in 2024 as `too-few-cases` —
 * Bjurholm, Sorsele, Arjeplog, Malå — have between three and six years of prices inside the
 * window, so the window quietly repairs most of the hole that a single-year snapshot shows.
 *
 * A pair compared on four indicators is not a neighbour in any sense a visitor would accept.
 * `distance`'s rescaling is a correction for a hole, not a licence to compare two
 * municipalities on whatever they happen to share.
 */
export const MAX_MISSING = 2

/**
 * The indicators "places like this" is measured over, named rather than inferred.
 *
 * Until Plan 14 this was "whatever the pantry contains", which was the same ten by accident of
 * there being only ten. Plan 15 adds fifteen more, and every one of them would have silently
 * changed every neighbour on the site — including the ones people have already linked to.
 *
 * Decision 0002 measured this metric on exactly these ten and recorded what it weighs and what it
 * over-weighs. Changing the set is changing the metric, so it is a decision with a record, not a
 * consequence of adding an indicator.
 */
export const CORE_INDICATORS: readonly string[] = [
  'population',
  'population-change',
  'mean-age',
  'share-65-plus',
  'net-migration-rate',
  'median-income',
  'post-secondary-education',
  'house-prices',
  'tax-rate',
  'density',
]

/**
 * The core set, in the pantry's own published order, refusing anything it cannot find.
 *
 * Refusing rather than skipping: an indicator named here and missing from the pantry means the
 * two have drifted apart, and quietly measuring over nine indicators while the published method
 * says ten is exactly the kind of silence this project does not allow.
 */
export function coreOf(
  data: PantryData,
  core: readonly string[] = CORE_INDICATORS,
): PantryData['indicators'] {
  const missing = core.filter((id) => !data.indicators.some((i) => i.id === id))
  if (missing.length > 0) {
    throw new Error(
      `similar: the core set names ${missing.join(', ')}, which the pantry does not publish — ` +
        'the metric and the data have drifted apart',
    )
  }
  return data.indicators.filter((i) => core.includes(i.id))
}

/**
 * The last year EVERY indicator covers, which is what the window has to end on: an indicator
 * missing from the final year would otherwise be silently averaged over nine years while the
 * rest got ten, and the published method would say ten.
 *
 * Read from the data rather than written down, so the day SCB publishes 2025 median income the
 * window moves on its own instead of needing an edit nobody remembers to make.
 */
export function windowFor(
  data: PantryData,
  coreIds: readonly string[] = CORE_INDICATORS,
): { from: number; to: number } {
  const core = coreOf(data, coreIds)
  if (core.length === 0) throw new Error('similar: no indicators to compare')
  const to = Math.min(...core.map((i) => i.coverage.to))
  return { from: to - WINDOW_YEARS + 1, to }
}

/** One row per municipality, one column per indicator, in the pantry's own published order. */
export function featuresFor(
  data: PantryData,
  window: { from: number; to: number },
  coreIds: readonly string[] = CORE_INDICATORS,
): Feature[] {
  const columns: Array<Array<number | null>> = coreOf(data, coreIds).map((indicator) => {
    const series = data.series.find((s) => s.indicator === indicator.id)
    if (!series) throw new Error(`similar: no series for indicator '${indicator.id}'`)
    const perYear: Array<Array<number | null> | null> = []
    for (let year = window.from; year <= window.to; year++) {
      perYear.push(zScoresForYear(series, year, { log: isLogged(indicator.id) }))
    }
    const mean = windowMean(perYear)
    if (mean.length !== data.municipalities.length) {
      throw new Error(
        `similar: '${indicator.id}' produced ${mean.length} rows over ${window.from}-` +
          `${window.to}, but the pantry has ${data.municipalities.length} municipalities`,
      )
    }
    return mean
  })
  // Transpose: the loop above builds one column per indicator, the distance wants one row per
  // municipality.
  return data.municipalities.map((_, m) => columns.map((column) => column[m] ?? null))
}

/**
 * Refuses to publish a result that would be wrong in a way the rendered page could not show.
 *
 * All three of these are silent failures rather than loud ones — a municipality with four
 * neighbours renders as a shorter list, and a neighbour chosen on four indicators renders
 * exactly like one chosen on ten — which is precisely why they have to throw here instead of
 * being noticed by someone reading the site.
 */
export function assertUsable(
  data: PantryData,
  features: readonly Feature[],
  result: Similar['nearest'],
  window: { from: number; to: number },
): void {
  const from = Math.max(...data.indicators.map((i) => i.coverage.from))
  if (window.to - window.from + 1 < WINDOW_YEARS) {
    throw new Error(
      `similar: the window ${window.from}-${window.to} is ${window.to - window.from + 1} ` +
        `years, and ${WINDOW_YEARS} are needed for a stable result`,
    )
  }
  if (window.from < from) {
    const late = data.indicators.filter((i) => i.coverage.from > window.from).map((i) => i.id)
    throw new Error(
      `similar: the window starts in ${window.from}, before ${late.join(', ')} ` +
        `${late.length === 1 ? 'begins' : 'begin'}`,
    )
  }

  const row = new Map(data.municipalities.map((m, i) => [m.code, i]))
  for (const m of data.municipalities) {
    const neighbours = result[m.code]
    if (!neighbours || neighbours.length !== NEIGHBOURS) {
      throw new Error(
        `similar: ${m.code} (${m.name.sv}) has ${neighbours?.length ?? 0} neighbours, not ` +
          `${NEIGHBOURS}`,
      )
    }
    const self = features[row.get(m.code)!]!
    for (const code of neighbours) {
      const shared = sharedDimensions(self, features[row.get(code)!]!)
      const missing = data.indicators.length - shared
      if (missing > MAX_MISSING) {
        throw new Error(
          `similar: ${m.code} (${m.name.sv}) and ${code} were compared on only ${shared} of ` +
            `${data.indicators.length} indicators, and at most ${MAX_MISSING} may be missing`,
        )
      }
    }
  }
}

export function buildSimilar(
  data: PantryData,
  /**
   * Which indicators the metric is measured over. Defaults to the ten decision 0002 measured;
   * tests pass their own so a fabricated pantry can still exercise the guards.
   */
  coreIds: readonly string[] = CORE_INDICATORS,
): Similar {
  const window = windowFor(data, coreIds)
  const features = featuresFor(data, window, coreIds)
  const codeAt = (index: number) => data.municipalities[index]!.code

  const result: Similar['nearest'] = {}
  for (const [index, m] of data.municipalities.entries()) {
    result[m.code] = nearest(features, index, NEIGHBOURS, codeAt).map((n) => codeAt(n.index))
  }

  assertUsable(data, features, result, window)

  return {
    schemaVersion: 1,
    method: {
      // The core set, not everything the pantry publishes. The published method has to name what
      // the metric actually measured over, or the page states a method it did not use.
      indicators: coreOf(data, coreIds).map((i) => i.id) as [string, ...string[]],
      // Only the logged indicators that are actually being compared — the schema refuses a
      // `logged` entry naming an indicator the metric never saw.
      logged: coreOf(data, coreIds)
        .map((i) => i.id)
        .filter((id) => isLogged(id)),
      window,
      neighbours: NEIGHBOURS,
    },
    nearest: result,
  }
}
