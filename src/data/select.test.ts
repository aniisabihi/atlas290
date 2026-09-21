import { describe, expect, it } from 'vitest'
import { publishedPantry } from '../test/pantry'
import {
  classOf,
  statusesIn,
  extremesFor,
  lookup,
  nearestCoveredYear,
  observationAt,
  rankOf,
  ranksFor,
} from './select'

const data = publishedPantry
const lk = lookup(data)
const indicator = (id: string) => lk.indicator(id)

/**
 * Self-proving: every figure below was read out of the committed pantry, so these assertions
 * fail if the data changes as well as if the selectors do. That is the point — a selector test
 * against invented numbers proves only that the arithmetic is self-consistent.
 */
describe('observationAt, against real published cells', () => {
  it('reads a plain published value', () => {
    expect(observationAt(lk, 'population', '0180', 2024)).toEqual({
      value: 995574,
      status: 'present',
    })
  })

  it('marks the years SCB perturbs, while keeping the value', () => {
    expect(observationAt(lk, 'population', '0180', 2025)).toEqual({
      value: 999239,
      status: 'perturbed',
    })
  })

  it('says a municipality did not exist, rather than showing a zero', () => {
    // Knivsta was split out of Uppsala in 2003.
    expect(observationAt(lk, 'population', '0330', 2000)).toEqual({
      value: null,
      status: 'did-not-exist',
    })
    expect(observationAt(lk, 'population', '0330', 2003).value).toBe(12821)
  })

  it('suppresses a mean price resting on too few sales', () => {
    expect(observationAt(lk, 'house-prices', '0128', 1989)).toEqual({
      value: null,
      status: 'too-few-cases',
    })
  })

  it('marks a parent municipality the year a child split off', () => {
    // Nyköping lost Gnesta and Trosa in 1992, so its 1991-to-1992 change is a redrawn
    // boundary rather than anyone moving. The value is withheld, not merely annotated.
    expect(observationAt(lk, 'population-change', '0480', 1991)).toEqual({
      value: null,
      status: 'structural-break',
    })
  })

  it('reports a year the indicator does not cover as outside its coverage, not as unpublished', () => {
    // Mean age starts in 1998. 1970 is not a missing cell — there is no column at all, and
    // calling it "not yet published" would imply SCB is going to publish it one day.
    expect(observationAt(lk, 'mean-age', '0180', 1970)).toEqual({
      value: null,
      status: 'outside-coverage',
    })
  })

  it('reports an unknown municipality as outside coverage rather than throwing', () => {
    expect(observationAt(lk, 'population', '9999', 2024).status).toBe('outside-coverage')
  })

  it('throws for an unknown indicator, because that is a programming error and not data', () => {
    expect(() => observationAt(lk, 'not-an-indicator', '0180', 2024)).toThrow(/not-an-indicator/)
  })
})

describe('classOf', () => {
  const population = indicator('population')

  it('puts a value below the first break in the first class', () => {
    expect(classOf(population, 0)).toBe(0)
  })

  it('puts a value on a break into the class above it, like a threshold scale', () => {
    const first = population.scale.breaks[0]!
    expect(classOf(population, first - 0.001)).toBe(0)
    expect(classOf(population, first)).toBe(1)
  })

  it('puts the largest value in the last class', () => {
    expect(classOf(population, 995574)).toBe(population.scale.breaks.length)
  })

  it('gives seven classes for six breaks', () => {
    expect(population.scale.breaks).toHaveLength(6)
    const classes = new Set(
      [0, 1_000, 9_000, 12_000, 15_000, 25_000, 40_000, 1_000_000].map((v) =>
        classOf(population, v),
      ),
    )
    expect(classes).toEqual(new Set([0, 1, 2, 3, 4, 5, 6]))
  })

  it('has no class for an absent value', () => {
    expect(classOf(population, null)).toBeNull()
  })
})

describe('ranks', () => {
  it('ranks the largest first', () => {
    expect(rankOf(lk, 'population', 2024, '0180')).toEqual({ rank: 1, outOf: 290 })
  })

  it('ranks the smallest last', () => {
    expect(rankOf(lk, 'population', 2024, '2425')).toEqual({ rank: 290, outOf: 290 })
  })

  it('counts only municipalities that have a value, never all 290 regardless', () => {
    // 1996 house prices: some municipalities are suppressed for too few sales and some did
    // not exist. Saying "180th of 290" when 30 of those had no data is a false statement.
    const ranks = ranksFor(lk, 'house-prices', 1996)
    const present = [...lk.series('house-prices').status.entries()].filter(
      ([i]) =>
        observationAt(lk, 'house-prices', lk.data.municipalities[i]!.code, 1996).value !== null,
    ).length
    expect(ranks.size).toBe(present)
    expect(present).toBeLessThan(290)
    for (const r of ranks.values()) expect(r.outOf).toBe(present)
  })

  it('has no rank for a municipality with no value', () => {
    expect(rankOf(lk, 'house-prices', 1989, '0128')).toBeNull()
  })

  it('gives tied values the same rank, and skips the ranks they consumed', () => {
    // Municipal tax rates repeat often, so ties are real here rather than hypothetical.
    const ranks = ranksFor(lk, 'tax-rate', 2024)
    const byRank = [...ranks.values()].map((r) => r.rank).sort((a, b) => a - b)
    expect(byRank[0]).toBe(1)
    expect(Math.max(...byRank)).toBeLessThanOrEqual(ranks.size)
    expect(new Set(byRank).size).toBeLessThan(byRank.length)
  })

  it('caches per Lookup, which is why the Lookup has to outlive a render', () => {
    // The cache is a WeakMap keyed on the Lookup OBJECT. That makes whoever builds the Lookup
    // responsible for the cache surviving: `App` memoises it on the pantry, and when it did not,
    // every render silently re-sorted all 290 municipalities. Asserted here rather than left as
    // a comment, because the coupling is invisible from either file on its own.
    expect(ranksFor(lk, 'population', 2024)).toBe(ranksFor(lk, 'population', 2024))
    expect(ranksFor(lookup(data), 'population', 2024)).not.toBe(ranksFor(lk, 'population', 2024))
  })
})

describe('coverage', () => {
  it('jumps forward to the first covered year', () => {
    expect(nearestCoveredYear(indicator('mean-age'), 1970)).toBe(1998)
  })

  it('jumps back to the last covered year', () => {
    expect(nearestCoveredYear(indicator('median-income'), 2026)).toBe(2024)
  })

  it('stays put when the year is already covered', () => {
    expect(nearestCoveredYear(indicator('population'), 1990)).toBe(1990)
  })
})

describe('extremesFor', () => {
  it('finds the highest and lowest municipality of a year', () => {
    expect(extremesFor(lk, 'population', 2024)).toEqual({
      low: { code: '2425', value: 2294 },
      high: { code: '0180', value: 995574 },
    })
  })

  it('is null for a year with nothing published', () => {
    expect(extremesFor(lk, 'mean-age', 1970)).toBeNull()
  })
})

describe('statusesIn', () => {
  it('reports only what actually occurs, so the legend can stay honest', () => {
    expect(statusesIn(lk, 'population', 2024)).toEqual(new Set(['present']))
  })

  it('finds the suppressed cells on a year of house prices that has them', () => {
    expect(statusesIn(lk, 'house-prices', 1989)).toContain('too-few-cases')
  })

  it('finds municipalities that did not exist yet', () => {
    expect(statusesIn(lk, 'population', 2000)).toEqual(new Set(['present', 'did-not-exist']))
  })

  it('reports a whole year outside coverage as exactly that and nothing else', () => {
    expect(statusesIn(lk, 'mean-age', 1970)).toEqual(new Set(['outside-coverage']))
  })

  it('finds the year SCB perturbs', () => {
    expect(statusesIn(lk, 'population', 2025)).toContain('perturbed')
  })
})

/**
 * Plan 19. A sparse indicator has holes INSIDE its range, so "nearest covered" stops meaning
 * "clamped into the range" — 1974 is inside turnout's 1973–2022 and has nothing in it.
 */
describe('coverage, when the indicator is sparse', () => {
  const turnout = {
    ...indicator('population'),
    id: 'turnout',
    coverage: { from: 1973, to: 1982, years: [1973, 1976, 1982] },
  }

  it('jumps to the nearest year that HAS data, not to the edge of the range', () => {
    expect(nearestCoveredYear(turnout, 1974)).toBe(1973)
    expect(nearestCoveredYear(turnout, 1977)).toBe(1976)
    expect(nearestCoveredYear(turnout, 1981)).toBe(1982)
  })

  it('stays put on a year it has', () => {
    expect(nearestCoveredYear(turnout, 1976)).toBe(1976)
  })

  it('clamps to the ends from outside', () => {
    expect(nearestCoveredYear(turnout, 1950)).toBe(1973)
    expect(nearestCoveredYear(turnout, 2030)).toBe(1982)
  })

  it('breaks a tie toward the earlier year, deliberately and not by accident', () => {
    // 1979 is three from 1976 and three from 1982. Something has to win; the earlier one does,
    // so the jump never skips a value the visitor has not seen yet.
    expect(nearestCoveredYear(turnout, 1979)).toBe(1976)
  })
})
