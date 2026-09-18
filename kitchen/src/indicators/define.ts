import { statusCode, type Indicator, type IndicatorSeries } from '../../../shared/pantry'
import { existed } from '../municipalities'
import { buildRows, type BuildContext } from './registry'
import { resolveSources, type Source } from './source'

/**
 * How an indicator's values are computed once its sources have been read.
 *
 * `direct` is the only one here; the rest arrive with the indicators that need them, each proven
 * by the same gate — the published pantry, byte for byte. Adding all five before any of them had
 * a caller would be five guesses at what the migration needs.
 */
export type BuildSpec = { kind: 'direct' }

/**
 * An indicator as data: what it is, where it comes from, and how the values are computed.
 *
 * The metadata stays hand-written. `description`, `caveat` and `derivation` are prose a reader
 * checks a published figure against, and generating them from this record would produce something
 * true and unreadable.
 */
export type Definition = {
  indicator: Indicator
  sources: readonly Source[]
  spec: BuildSpec
  /**
   * First year SCB's Cell Key Method perturbs this indicator's values, where it does. Every cell
   * from that year on is published as `perturbed` rather than `present`, because the figure is
   * deliberately fuzzed and the site says so.
   */
  perturbedFrom?: number
}

/**
 * The status rules every indicator shares, in the order they are decided.
 *
 * A municipality that did not yet exist gets `did-not-exist` whatever SCB sent — the question
 * "what was its population in 1970" has no answer for a municipality created in 2003, and a
 * fetched cell for it would be a statement about its parent. Only then does a missing cell become
 * `not-yet-published`, which is absence rather than zero. This is population.ts's ruling R16,
 * carried over rather than re-derived.
 */
function directSeries(
  definition: Definition,
  municipalities: BuildContext['municipalities'],
  years: readonly number[],
  values: ReadonlyMap<string, number | null>,
): IndicatorSeries {
  const cells = buildRows(municipalities, [...years], (m, y) => {
    if (!existed(m.code, y)) return { v: null as number | null, s: statusCode('did-not-exist') }
    const value = values.get(`${m.code}|${y}`) ?? null
    if (value === null) return { v: null, s: statusCode('not-yet-published') }
    const perturbed = definition.perturbedFrom !== undefined && y >= definition.perturbedFrom
    return { v: value, s: statusCode(perturbed ? 'perturbed' : 'present') }
  })
  return {
    indicator: definition.indicator.id,
    years: [...years],
    values: cells.map((row) => row.map((c) => c.v)),
    status: cells.map((row) => row.map((c) => c.s)),
  }
}

/**
 * Builds one indicator from its definition: read the declared sources, then compute.
 *
 * The years published are the union of what the sources declare, in order — so a stitched
 * indicator covers the whole span its tables cover between them, and nothing else decides it.
 */
export async function buildDefined(
  definition: Definition,
  ctx: BuildContext,
): Promise<IndicatorSeries> {
  const resolved = await resolveSources(definition.sources, ctx.freeze)
  ctx.frozen.push(...resolved.frozen)

  const years = [...new Set(definition.sources.flatMap((s) => [...s.years]))].sort((a, b) => a - b)
  return directSeries(definition, ctx.municipalities, years, resolved.values)
}
