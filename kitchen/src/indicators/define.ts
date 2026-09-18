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
export type BuildSpec =
  | { kind: 'direct' }
  /**
   * This indicator's count over another indicator's series, times a factor.
   *
   * Share aged 65 and over is the 65+ count over population, times 100; net migration is the
   * migration count over population, times 1,000. They are one shape, not two.
   *
   * The denominator is READ from the already-built series rather than refetched, so numerator and
   * denominator can never quietly disagree about what a municipality's population was.
   */
  | { kind: 'ratio'; of: string; times: number }
  /**
   * A share of one fetch, partitioned by a dimension: these values over all of them, times a
   * factor. Post-secondary education is the post-secondary levels over every level.
   */
  | { kind: 'share'; over: string; numerator: readonly string[]; times: number }

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
  /**
   * Every value of the dimension a `share` is partitioned by — the whole denominator.
   *
   * Listed rather than read from the table's metadata, because "every level SCB happens to
   * publish" and "every level this share is defined over" are different claims, and only the
   * second one belongs in a published figure. education.ts validates the two against each other.
   */
  shareOver?: readonly string[]
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
  const spec = definition.spec
  const groupBy = spec.kind === 'share' ? spec.over : undefined
  const resolved = await resolveSources(definition.sources, ctx.freeze, codes, groupBy)
  ctx.frozen.push(...resolved.frozen)

  const years = [...new Set(definition.sources.flatMap((s) => [...s.years]))].sort((a, b) => a - b)

  if (spec.kind === 'ratio') {
    return ratioSeries(definition, spec, ctx, years, resolved.values)
  }
  if (spec.kind === 'share') {
    return shareSeries(definition, spec, ctx, years, resolved.values, definition.shareOver ?? [])
  }

  let counts: ReadonlyMap<string, number | null> | undefined
  const minCount = definition.modifiers?.minCount
  if (minCount) {
    const resolvedCounts = await resolveSources(minCount.counts, ctx.freeze, codes)
    ctx.frozen.push(...resolvedCounts.frozen)
    counts = resolvedCounts.values
  }

  return directSeries(definition, ctx.municipalities, years, resolved.values, counts, ctx.cpi)
}

/** Reads the series this one divides by, refusing to guess if it has not been built yet. */
function denominatorOf(ctx: BuildContext, of: string, id: string): IndicatorSeries {
  const series = ctx.series.get(of)
  if (!series) {
    throw new Error(
      `${id}: needs ${of}'s series as its denominator, but ${of} has not been built yet — ` +
        `it must come first in REGISTRY`,
    )
  }
  return series
}

/** One count over another indicator's series, times a factor. */
function ratioSeries(
  definition: Definition,
  spec: { of: string; times: number },
  ctx: BuildContext,
  years: readonly number[],
  counts: ReadonlyMap<string, number | null>,
): IndicatorSeries {
  const denominator = denominatorOf(ctx, spec.of, definition.indicator.id)
  const colOf = new Map(denominator.years.map((y, i) => [y, i]))
  const rowOf = new Map(ctx.municipalities.map((m, i) => [m.code, i]))
  const shift = definition.existsShift ?? 0

  const cells = buildRows(ctx.municipalities, [...years], (m, y) => {
    if (!existed(m.code, y - shift)) {
      return { v: null as number | null, s: statusCode('did-not-exist') }
    }
    const count = counts.get(`${m.code}|${y}`) ?? null
    if (count === null) return { v: null, s: statusCode('not-yet-published') }
    const row = rowOf.get(m.code)
    const col = colOf.get(y)
    const denom =
      row === undefined || col === undefined ? null : (denominator.values[row]?.[col] ?? null)
    // A zero denominator is not a ratio of zero, it is a question with no answer.
    if (denom === null || denom === 0) return { v: null, s: statusCode('not-yet-published') }
    const perturbed = definition.perturbedFrom !== undefined && y >= definition.perturbedFrom
    return { v: (count / denom) * spec.times, s: statusCode(perturbed ? 'perturbed' : 'present') }
  })
  return {
    indicator: definition.indicator.id,
    years: [...years],
    values: cells.map((row) => row.map((c) => c.v)),
    status: cells.map((row) => row.map((c) => c.s)),
  }
}

/** A share of one fetch, partitioned by a dimension. */
function shareSeries(
  definition: Definition,
  spec: { over: string; numerator: readonly string[]; times: number },
  ctx: BuildContext,
  years: readonly number[],
  parts: ReadonlyMap<string, number | null>,
  all: readonly string[],
): IndicatorSeries {
  const cells = buildRows(ctx.municipalities, [...years], (m, y) => {
    if (!existed(m.code, y)) return { v: null as number | null, s: statusCode('did-not-exist') }
    const perLevel = all.map((value) => parts.get(`${m.code}|${y}|${value}`) ?? null)
    // Every part must be present: a denominator missing one of its parts is a smaller number
    // that looks like a total, and the share computed from it would be too large.
    if (perLevel.some((v) => v === null)) return { v: null, s: statusCode('not-yet-published') }
    const denominator = (perLevel as number[]).reduce((a, b) => a + b, 0)
    if (denominator === 0) return { v: null, s: statusCode('not-yet-published') }
    const numerator = spec.numerator
      .map((value) => (parts.get(`${m.code}|${y}|${value}`) ?? 0) as number)
      .reduce((a, b) => a + b, 0)
    const perturbed = definition.perturbedFrom !== undefined && y >= definition.perturbedFrom
    return {
      v: (numerator / denominator) * spec.times,
      s: statusCode(perturbed ? 'perturbed' : 'present'),
    }
  })
  return {
    indicator: definition.indicator.id,
    years: [...years],
    values: cells.map((row) => row.map((c) => c.v)),
    status: cells.map((row) => row.map((c) => c.s)),
  }
}
