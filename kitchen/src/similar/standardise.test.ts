import { describe, expect, it } from 'vitest'
import { IndicatorSeries } from '../../../shared/pantry'
import { isLogged, LOGGED, zScoresForYear } from './standardise'

/** Four municipalities, two years, so a mean and a standard deviation can be checked by hand. */
function series(values: Array<Array<number | null>>, years = [2023, 2024]): IndicatorSeries {
  return IndicatorSeries.parse({
    indicator: 'test',
    years,
    values,
    status: values.map((row) => row.map((v) => (v === null ? 1 : 0))),
  })
}

describe('zScoresForYear', () => {
  it('standardises against the mean and population standard deviation of the year', () => {
    // 2024 column is 2, 2, 6, 6: mean 4, population sd exactly 2.
    const z = zScoresForYear(
      series([
        [0, 2],
        [0, 2],
        [0, 6],
        [0, 6],
      ]),
      2024,
    )
    expect(z).toEqual([-1, -1, 1, 1])
  })

  it('uses the population standard deviation, not the sample one', () => {
    // Stated separately from the test above because the two differ by only 15% here and a
    // sample standard deviation would still produce plausible-looking scores: for 2, 2, 6, 6
    // it is 2.309, giving -0.866 where the population one gives -1. The difference matters
    // because it is applied to ten indicators and then squared.
    const z = zScoresForYear(
      series([
        [0, 2],
        [0, 2],
        [0, 6],
        [0, 6],
      ]),
      2024,
    )
    expect(z?.[0]).toBe(-1)
    expect(z?.[0]).not.toBeCloseTo(-0.866, 3)
  })

  it('standardises each year on its own, not across the series', () => {
    // Both columns have the same shape but different levels. If the two years were pooled,
    // 2023's scores would all be negative and 2024's all positive.
    const z2023 = zScoresForYear(
      series([
        [10, 110],
        [20, 120],
        [30, 130],
      ]),
      2023,
    )
    const z2024 = zScoresForYear(
      series([
        [10, 110],
        [20, 120],
        [30, 130],
      ]),
      2024,
    )
    expect(z2023).toEqual(z2024)
  })

  it('takes the mean over present values only, never over absences read as zero', () => {
    // 4, null, 4, 6 has mean 4.667 over the three present. Counting the null as a zero would
    // give mean 3.5 and flip the first municipality from below average to above it.
    const z = zScoresForYear(
      series([
        [0, 4],
        [0, null],
        [0, 4],
        [0, 6],
      ]),
      2024,
    )
    expect(z?.[1]).toBeNull()
    expect(z?.[0]).toBeLessThan(0)
    expect(z?.[3]).toBeGreaterThan(0)
  })

  it('log-transforms only when asked, and the transform changes the answer', () => {
    const skewed = series([
      [0, 1],
      [0, 10],
      [0, 100],
      [0, 10000],
    ])
    const plain = zScoresForYear(skewed, 2024)
    const logged = zScoresForYear(skewed, 2024, { log: true })
    // Raw, the largest is 1.73 standard deviations out and the other three are squashed
    // together near -0.58. Logged, the four are evenly spread.
    expect(plain![3]! - plain![2]!).toBeGreaterThan(2 * (plain![2]! - plain![1]!))
    expect(logged![3]! - logged![2]!).toBeCloseTo(2 * (logged![2]! - logged![1]!), 10)
  })

  it('returns null for a year the series does not cover', () => {
    // Not a throw: a window may legitimately start before tax-rate does, and the caller has
    // to be able to tell "not covered" apart from "covered but unusable".
    expect(
      zScoresForYear(
        series([
          [1, 2],
          [3, 4],
        ]),
        1999,
      ),
    ).toBeNull()
  })

  it('throws rather than dividing by zero when every value is the same', () => {
    expect(() =>
      zScoresForYear(
        series([
          [0, 7],
          [0, 7],
          [0, 7],
        ]),
        2024,
      ),
    ).toThrow(/every municipality has the same value \(7\)/)
  })

  it('throws when fewer than two municipalities have a value', () => {
    expect(() =>
      zScoresForYear(
        series([
          [0, 7],
          [0, null],
          [0, null],
        ]),
        2024,
      ),
    ).toThrow(/only 1 municipalities have a value/)
  })

  it('throws on a non-positive value rather than producing -Infinity or NaN', () => {
    // The silent-failure path this guard closes: Math.log(0) is -Infinity, which propagates
    // through the mean into every score in the year as NaN, and NaN distances sort in
    // whatever order the comparator happens to give — so the pantry would publish neighbours
    // that were never computed.
    expect(() =>
      zScoresForYear(
        series([
          [0, 1],
          [0, 0],
          [0, 3],
        ]),
        2024,
        { log: true },
      ),
    ).toThrow(/row 1 is 0, which cannot be log-transformed/)
    expect(() =>
      zScoresForYear(
        series([
          [0, 1],
          [0, -5],
          [0, 3],
        ]),
        2024,
        { log: true },
      ),
    ).toThrow(/row 1 is -5/)
  })
})

describe('LOGGED', () => {
  it('names the four skewed indicators and nothing else', () => {
    expect([...LOGGED]).toEqual(['population', 'density', 'house-prices', 'median-income'])
  })

  it('excludes the two indicators that legitimately go negative', () => {
    // A log transform on either would throw on real data — roughly half of all
    // population-change cells are negative — so this is a correctness rule, not a preference.
    expect(isLogged('net-migration-rate')).toBe(false)
    expect(isLogged('population-change')).toBe(false)
  })
})
