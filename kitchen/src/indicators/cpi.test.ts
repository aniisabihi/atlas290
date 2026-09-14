import { describe, expect, it } from 'vitest'
import { CPI_TABLE, fetchCpi, toCurrentKronor } from './cpi'

describe('toCurrentKronor', () => {
  it("converts a past value into the target year's kronor", () => {
    const index = new Map([
      [2000, 100],
      [2024, 200],
    ])
    expect(toCurrentKronor(50, 2000, index, 2024)).toBe(100)
    expect(toCurrentKronor(200, 2024, index, 2024)).toBe(200)
  })

  it('throws naming the year when the index has no entry for it', () => {
    const index = new Map([[2024, 200]])
    expect(() => toCurrentKronor(50, 1999, index, 2024)).toThrow(/1999/)
  })

  it('throws naming the year when the index has no entry for the TARGET year', () => {
    const index = new Map([[1999, 50]])
    expect(() => toCurrentKronor(50, 1999, index, 2024)).toThrow(/2024/)
  })
})

describe('fetchCpi against the real, frozen SCB series', () => {
  // Uses the project's real kitchen/raw cache (default rawDir), not a throwaway tmp dir:
  // metadata was already frozen there during planning reconnaissance, and this test's first
  // run also freezes the data chunk there, to be committed like every other table's frozen
  // response ("All fetching happens in the kitchen... frozen to kitchen/raw/ and committed;
  // every later stage runs offline" — Global Constraints). Every run after the first reads
  // the cached file with no network call. No fixture/mock: this is the actual TAB4352 series.

  it('resolves TAB4352 with 1980 pinned at 100 and the index rising over the covered period', async () => {
    const { index, frozen } = await fetchCpi()

    expect(index.get(1980)).toBe(100)

    const years = [...index.keys()].sort((a, b) => a - b)
    expect(years[0]).toBe(1980)
    expect(years[years.length - 1]).toBe(2025)

    // NOTE ON "monotonically": the plan brief for this task asked for a test asserting the
    // index "rises monotonically across the covered period". That is not true of the real,
    // frozen series at single-year resolution — Swedish CPI actually falls year-on-year at
    // several points (1997->1998, 2008->2009, and each year 2012->2015, real disinflationary/
    // deflationary periods, not a fetching bug). A strict per-year non-decreasing assertion
    // would fail against genuine SCB data, which is exactly the kind of test-vs-reality gap
    // this plan's TDD discipline exists to catch rather than paper over. What IS true, and is
    // asserted here instead, is the period-level fact the brief was actually reaching for:
    // the index is far higher at the end of the series than at the start.
    const first = index.get(years[0]!)!
    const last = index.get(years[years.length - 1]!)!
    expect(last).toBeGreaterThan(first)

    expect(frozen.length).toBeGreaterThan(0)
  })
})

describe('CPI_TABLE', () => {
  it('is TAB4352', () => {
    expect(CPI_TABLE).toBe('TAB4352')
  })
})
