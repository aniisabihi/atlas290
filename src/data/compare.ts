import type { IndicatorMeta } from '../../shared/pantry'
import { observationAt, type Lookup } from './select'

/**
 * Two municipalities, ten indicators, and no verdict.
 *
 * There is no "higher is better" flag anywhere in this project and this module does not add one.
 * A high tax rate is not a defeat, a low mean age is not a victory, and which of those a visitor
 * wants is theirs to decide — so the summary says "higher on 7 of 10", never "wins".
 *
 * `higher` is null where either side has no value that year, and those indicators are excluded
 * from the denominator. "Higher on 7 of 10" and "higher on 7 of the 8 we could compare" are
 * different claims, and only one of them is true.
 */
export type Comparison = {
  indicator: IndicatorMeta
  a: number | null
  b: number | null
  higher: 'a' | 'b' | 'equal' | null
}

export function compareOf(lk: Lookup, aCode: string, bCode: string, year: number): Comparison[] {
  // Only indicators whose series has arrived (Plan 13). An indicator still in flight is not the
  // same as one with no value: leaving it out keeps "higher on 7 of the 8 we could compare"
  // truthful, where counting it would quietly inflate the denominator with an unknown.
  return lk.data.indicators
    .filter((indicator) => lk.hasSeries(indicator.id))
    .map((indicator) => {
      const a = observationAt(lk, indicator.id, aCode, year).value
      const b = observationAt(lk, indicator.id, bCode, year).value
      const higher = a === null || b === null ? null : a > b ? 'a' : b > a ? 'b' : 'equal'
      return { indicator, a, b, higher }
    })
}

export type ComparisonSummary = {
  aHigher: number
  bHigher: number
  equal: number
  comparable: number
  notComparable: number
}

export function summarise(rows: readonly Comparison[]): ComparisonSummary {
  const comparable = rows.filter((r) => r.higher !== null)
  return {
    aHigher: comparable.filter((r) => r.higher === 'a').length,
    bHigher: comparable.filter((r) => r.higher === 'b').length,
    equal: comparable.filter((r) => r.higher === 'equal').length,
    comparable: comparable.length,
    notComparable: rows.length - comparable.length,
  }
}
