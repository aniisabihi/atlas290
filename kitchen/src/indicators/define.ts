import { statusCode, type Indicator, type IndicatorSeries } from '../../../shared/pantry'
import { existed } from '../municipalities'
import { buildRows, type BuildContext } from './registry'
import { toCurrentKronor } from './cpi'
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
  /**
   * Years to shift the existence gate back by.
   *
   * House prices and migration describe what happened DURING a year and are stamped with the
   * following one, so the boundary that matters is the one that existed the year before. `existed`
   * is a full calendar year too early for them; one is the shift they need.
   */
  existsShift?: number
  modifiers?: Modifiers
}

export type Modifiers = {
  /** Multiply the source figure, where SCB publishes in thousands and the pantry wants units. */
  scale?: number
  /**
   * Express every year's figure in the price index's own base-year kronor.
   *
   * Throws rather than silently passing a nominal figure through when the index lacks a year —
   * a money series with one unadjusted value in it is worse than none, because nothing on the
   * page would show which one it was.
   */
  inflationAdjust?: boolean
  /**
   * Below this many underlying cases the cell is `too-few-cases` rather than a published figure.
   * A mean price resting on a handful of sales is noise wearing a number's clothes.
   */
  minCount?: { threshold: number; counts: readonly Source[] }
}

/**
 * The year every money figure is expressed in: the last year the price index covers.
 *
 * Guarded against an empty index, which would otherwise make `Math.max` return `-Infinity` and
 * push the failure into `toCurrentKronor` wearing a message about a missing year rather than a
 * missing index. income.ts and housing.ts each carry their own copy of this guard for the build
 * paths they still own; this is the one the definitions use, and it names whichever indicator
 * asked.
 */
function targetKronorYear(cpi: Map<number, number>, indicatorId: string): number {
  if (cpi.size === 0) {
    throw new Error(
      `${indicatorId}: CPI index has no entries at all — cannot determine the latest year to ` +
        'adjust every value to',
    )
  }
  return Math.max(...cpi.keys())
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
  counts: ReadonlyMap<string, number | null> | undefined,
  cpi: Map<number, number> | undefined,
): IndicatorSeries {
  const mods = definition.modifiers ?? {}
  const shift = definition.existsShift ?? 0
  const target =
    mods.inflationAdjust && cpi ? targetKronorYear(cpi, definition.indicator.id) : undefined

  const cells = buildRows(municipalities, [...years], (m, y) => {
    if (!existed(m.code, y - shift)) {
      return { v: null as number | null, s: statusCode('did-not-exist') }
    }
    const key = `${m.code}|${y}`
    const value = values.get(key) ?? null
    const count = counts ? (counts.get(key) ?? null) : undefined
    if (value === null || count === null) return { v: null, s: statusCode('not-yet-published') }
    if (mods.minCount && count !== undefined && count < mods.minCount.threshold) {
      return { v: null, s: statusCode('too-few-cases') }
    }
    let out = value * (mods.scale ?? 1)
    if (mods.inflationAdjust) {
      if (!cpi || target === undefined) {
        throw new Error(
          `${definition.indicator.id}: adjusts for inflation but no price index was supplied`,
        )
      }
      out = toCurrentKronor(out, y, cpi, target)
    }
    const perturbed = definition.perturbedFrom !== undefined && y >= definition.perturbedFrom
    return { v: out, s: statusCode(perturbed ? 'perturbed' : 'present') }
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
  const codes = ctx.municipalities.map((m) => m.code)
  const resolved = await resolveSources(definition.sources, ctx.freeze, codes)
  ctx.frozen.push(...resolved.frozen)

  let counts: ReadonlyMap<string, number | null> | undefined
  const minCount = definition.modifiers?.minCount
  if (minCount) {
    const resolvedCounts = await resolveSources(minCount.counts, ctx.freeze, codes)
    ctx.frozen.push(...resolvedCounts.frozen)
    counts = resolvedCounts.values
  }

  const years = [...new Set(definition.sources.flatMap((s) => [...s.years]))].sort((a, b) => a - b)
  return directSeries(definition, ctx.municipalities, years, resolved.values, counts, ctx.cpi)
}
