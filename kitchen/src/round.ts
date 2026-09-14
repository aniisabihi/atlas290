import type { Indicator, IndicatorSeries } from '../../shared/pantry'

/**
 * Follow-up to Task 13 (docs/plans/2026-09-14-02-the-ten-indicators.md): the published pantry
 * was carrying full float precision on every derived indicator — `share-65-plus` publishing
 * `4.7196549599507085`, sixteen significant figures for a percentage derived from integer
 * population counts SCB deliberately perturbs from 2025 onward. That asserts a precision the
 * source data does not have, on top of costing real bytes for digits nobody can act on.
 *
 * Decimal places a value published under each `Indicator.unit` may honestly carry. Derived
 * from the unit — the schema's own enum, already the one place `check.ts` and the render code
 * trust — rather than a per-indicator table someone maintaining a tenth or eleventh indicator
 * could get wrong or forget to add to entirely.
 *
 *   count:        0 — people are counted, not measured; a fractional person is not a value.
 *   sek:          0 — whole kronor; a house price or income to four decimal places is absurd,
 *                 and every money figure here is already stored as an integer number of kronor
 *                 before this rounding step even runs (income.ts/housing.ts multiply their
 *                 source tkr figures by 1,000).
 *   percent:      2 — matches what SCB itself publishes for tax-rate, the one percent-unit
 *                 indicator whose value is NOT derived by this project (selected directly off
 *                 TAB2017): Stockholm's 2024 rate is 30.36, two decimals, verified against the
 *                 real fetched table rather than assumed. 1 decimal would collapse that to
 *                 30.4, silently discarding a real, correctly-published SCB digit — the
 *                 specific trap this task's own brief calls out by name. The other three
 *                 percent indicators (post-secondary-education, population-change,
 *                 share-65-plus) are computed here by division and so have no SCB-published
 *                 precision of their own to match; they take the same 2 decimals as their
 *                 sibling percent-unit indicator instead of a separately invented figure.
 *   per-thousand: 2 — net-migration-rate has no SCB-published precision to match either (SCB
 *                 publishes the raw migration count, not the per-1,000 rate; this project
 *                 computes the rate from that count and population) — 2 decimals matches its
 *                 nearest sibling ratio unit, percent, for the same reason.
 *   per-km2:      1 — SCB's own TAB628 density table publishes exactly one decimal (confirmed
 *                 against the real fetched data: Stockholm 2024 is 5289.4, not 5289.42 or
 *                 5289).
 *   years:        1 — SCB's own TAB637 mean-age table publishes exactly one decimal (confirmed
 *                 against the real fetched data: Borgholm 2025 is 53.3).
 */
export const UNIT_DECIMALS: Record<Indicator['unit'], number> = {
  count: 0,
  sek: 0,
  percent: 2,
  'per-thousand': 2,
  'per-km2': 1,
  years: 1,
}

/**
 * Rounds one value to the decimal precision its unit honestly carries (`UNIT_DECIMALS` above).
 *
 * Deliberately NOT `Math.round(value * 10 ** decimals) / 10 ** decimals`: that formula scales
 * through an intermediate floating-point multiplication which can itself be imprecise — the
 * textbook case is `1.005 * 100 === 100.49999999999999` in IEEE 754 double precision, which
 * then rounds to 100 instead of 101, silently rounding the wrong way for inputs that land near
 * that trap. `toFixed` instead asks the engine for the correctly-rounded decimal STRING
 * representation of the double's actual value — a computation ECMA-262 specifies exactly in
 * terms of that value, with no separate scaling step of its own — so it is bit-for-bit
 * reproducible for a given double on any conforming engine (V8/Node included), never
 * platform- or engine-sensitive, which is what determinism (byte-identical rebuilds) requires
 * here.
 */
export function roundToUnit(value: number, unit: Indicator['unit']): number {
  return Number(value.toFixed(UNIT_DECIMALS[unit]))
}

/** Rounds every non-null value in a series to `unit`'s precision. Null (absence) is never
 * coerced into a number — it passes through unchanged, exactly like every other transform in
 * this codebase that touches a nullable cell. */
export function roundSeriesValues(
  series: IndicatorSeries,
  unit: Indicator['unit'],
): IndicatorSeries {
  return {
    ...series,
    values: series.values.map((row) => row.map((v) => (v === null ? null : roundToUnit(v, unit)))),
  }
}

/** Rounds an indicator's own fixed colour-scale breaks (`Indicator.scale.breaks`) to its own
 * unit precision — the same false-precision problem applies to the breaks that drive the
 * choropleth legend as it does to the values themselves, since both are numbers under the same
 * unit. */
export function roundIndicatorBreaks(indicator: Indicator): Indicator {
  return {
    ...indicator,
    scale: {
      ...indicator.scale,
      breaks: indicator.scale.breaks.map((b) => roundToUnit(b, indicator.unit)),
    },
  }
}
