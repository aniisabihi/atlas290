import type { IndicatorSeries } from '../../../shared/pantry'

/**
 * Turning ten indicators measured in ten different units — people, kronor, years, percent,
 * people per square kilometre — into numbers that can be subtracted from each other.
 *
 * Standard scores (value minus mean, over the standard deviation), computed one year at a
 * time across all 290 municipalities. Per year rather than over the whole series, because the
 * country moves: a median income of 200,000 kr was high in 1999 and is low in 2024, and
 * standardising against a pooled 26-year mean would read that national drift as a difference
 * between places.
 */

/**
 * The four indicators compared on a log scale before standardising, because their
 * distributions are not remotely symmetric and a standard score assumes they are.
 *
 * Measured against the committed pantry for 2024, as the largest standard score in the
 * country:
 *
 *   population     12.49 raw -> 4.00 logged
 *   density        10.37 raw -> 3.19 logged
 *   house-prices    5.27 raw -> 2.80 logged
 *   median-income   3.94 raw -> 3.53 logged
 *
 * The consequence is not cosmetic. Untransformed, every small rural municipality collapses to
 * roughly the same score on population and density — the difference between 0.2 and 28 people
 * per square kilometre vanishes next to Stockholm's 6,446 — and distance becomes a test of
 * "is it Stockholm". Arjeplog's nearest places come out as Storfors, Ydre and Askersund, all
 * in the populated south. Logged, they come out as Jokkmokk, Sorsele and Storuman, which is
 * the answer anyone who has been there would give.
 *
 * `median-income` earns its place less obviously than the other three (3.94 is not an extreme
 * score) but is included for the same reason money always is: the distribution has a floor at
 * zero and a long right tail, and a ratio between two incomes is the meaningful comparison,
 * which is what a log difference is.
 *
 * Every indicator listed here is strictly positive in the published pantry — a log of zero or
 * of a negative number would be -Infinity or NaN, so `zScoresForYear` throws rather than
 * letting one through. The two indicators that genuinely go negative
 * (`net-migration-rate`, `population-change`) are deliberately absent from this list.
 */
export const LOGGED = ['population', 'density', 'house-prices', 'median-income'] as const

export function isLogged(indicatorId: string): boolean {
  return (LOGGED as readonly string[]).includes(indicatorId)
}

/**
 * One standard score per municipality for `year`, in the series' own row order, or null where
 * that municipality has no value.
 *
 * Returns null for the whole year when the series does not cover it at all, which is a normal
 * condition — `tax-rate` starts in 2000 and the window may legitimately begin earlier — and
 * so must be distinguishable from a year that is covered but unusable.
 *
 * Mean and standard deviation are taken over the municipalities that actually have a value,
 * never over 290 with absences read as zero. The population standard deviation (divide by n)
 * is used rather than the sample one (n - 1): these 290 municipalities are the entire
 * population being described, not a sample drawn from a larger one.
 */
export function zScoresForYear(
  series: IndicatorSeries,
  year: number,
  options: { log?: boolean } = {},
): Array<number | null> | null {
  const col = series.years.indexOf(year)
  if (col === -1) return null

  const raw: Array<number | null> = series.values.map((row, m) => {
    const value = row[col] ?? null
    if (value === null) return null
    if (!options.log) return value
    if (value <= 0) {
      throw new Error(
        `${series.indicator} ${year}: row ${m} is ${value}, which cannot be log-transformed. ` +
          `Only strictly positive indicators may be listed in LOGGED.`,
      )
    }
    return Math.log(value)
  })

  const present = raw.filter((v): v is number => v !== null)
  if (present.length < 2) {
    throw new Error(
      `${series.indicator} ${year}: only ${present.length} municipalities have a value, so ` +
        'there is no spread to standardise against',
    )
  }

  const mean = present.reduce((a, b) => a + b, 0) / present.length
  const variance = present.reduce((a, b) => a + (b - mean) ** 2, 0) / present.length
  const sd = Math.sqrt(variance)
  if (sd === 0) {
    throw new Error(
      `${series.indicator} ${year}: every municipality has the same value (${mean}), so a ` +
        'standard score is a division by zero',
    )
  }

  return raw.map((v) => (v === null ? null : (v - mean) / sd))
}
