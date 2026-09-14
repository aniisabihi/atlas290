import { UNIT_DECIMALS, type Indicator, type IndicatorSeries } from '../../shared/pantry'

// Re-exported so the kitchen's existing importers keep working. The definition itself moved
// to shared/pantry.ts, next to the unit enum it is keyed by, because the SITE needs it too:
// the number of decimals a value is rounded to on the way out must be the number of decimals
// it is displayed with on the way in, and src/ cannot import kitchen/.
export { UNIT_DECIMALS }

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
