import { describe, expect, it } from 'vitest'
// Vite's `?raw` gives the file as a string; oxlint resolves the path without the suffix and so
// cannot see the default export that Vite synthesises. The import works — the test below reads
// real source through it — so the rule is disabled here rather than the test being weakened.
// eslint-disable-next-line import/default
import compareSource from './compare.ts?raw'
// eslint-disable-next-line import/default
import stringsSource from '../i18n/strings.ts?raw'
import { lookup } from './select'
import { compareOf, summarise } from './compare'
import { publishedIndex, partialPantry, publishedPantry } from '../test/pantry'

const lk = lookup(publishedPantry)

describe('compareOf', () => {
  it('compares every published indicator', () => {
    expect(compareOf(lk, '0180', '1280', 2024)).toHaveLength(publishedIndex.indicators.length)
  })

  it('says which side is higher, using real figures', () => {
    const rows = compareOf(lk, '0180', '1280', 2024)
    const population = rows.find((r) => r.indicator.id === 'population')!
    // Stockholm 995,574 against Malmö 365,644.
    expect(population.a).toBe(995_574)
    expect(population.b).toBe(365_644)
    expect(population.higher).toBe('a')
  })

  it('refuses to compare where either side has no value', () => {
    // Salem's 1989 house price is suppressed for too few sales, so there is nothing to compare
    // it against — and calling the other side higher would be inventing a result.
    const rows = compareOf(lk, '0128', '0180', 1989)
    const houses = rows.find((r) => r.indicator.id === 'house-prices')!
    expect(houses.a).toBeNull()
    expect(houses.higher).toBeNull()
  })

  it('keeps the pantry order, so the panel and the profile read the same way down', () => {
    expect(compareOf(lk, '0180', '1280', 2024).map((r) => r.indicator.id)).toEqual(
      lk.data.indicators.map((i) => i.id),
    )
  })
})

describe('summarise', () => {
  it('counts both sides and the ties, adding up to what was comparable', () => {
    const s = summarise(compareOf(lk, '0180', '1280', 2024))
    expect(s.aHigher + s.bHigher + s.equal).toBe(s.comparable)
    expect(s.comparable + s.notComparable).toBe(publishedIndex.indicators.length)
  })

  it('excludes what it could not compare from the denominator', () => {
    // 1970: mean age starts in 1998, median income in 1999, house prices in 1981, tax in 2000,
    // density in 1991, education in 1985. Saying "higher on 3 of 10" would be false.
    const s = summarise(compareOf(lk, '0180', '1280', 1970))
    expect(s.notComparable).toBeGreaterThan(0)
    expect(s.comparable).toBeLessThan(publishedIndex.indicators.length)
    expect(s.aHigher + s.bHigher + s.equal).toBe(s.comparable)
  })
})

describe('the rule about not declaring a winner', () => {
  /**
   * A rule about the product, not about one function, so it is asserted against the source
   * itself. There is no "higher is better" flag in this project: a high tax rate is not a defeat
   * and a low mean age is not a triumph.
   *
   * Comments are stripped first, because the rule is about what a visitor is told rather than
   * about prose — including the prose above, which has to be able to name what it forbids.
   */
  const code = (source: string) =>
    source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

  const BANNED = /\b(better|worse|wins|winner|loses|loser|beats|bra|dalig|vinnare|forlorare)\b/i

  it.each([
    ['compare.ts', compareSource],
    ['strings.ts', stringsSource],
  ])('%s never tells a visitor who won', (_name, source) => {
    expect(
      code(source)
        .split('\n')
        .filter((line) => BANNED.test(line)),
    ).toEqual([])
  })

  it('still bites on real code, so stripping comments has not made it toothless', () => {
    expect(BANNED.test(code("const summary = 'Stockholm wins'"))).toBe(true)
    expect(BANNED.test(code('// Stockholm wins'))).toBe(false)
  })
})

describe('while the pantry is still loading', () => {
  /**
   * Plan 13: the comparison needs every indicator and gets them one file at a time. An indicator
   * still in flight must not be counted as "could not compare" — that phrase means SCB published
   * nothing, which is a statement about the data rather than about our network.
   */
  it('compares only the indicators whose series has arrived', () => {
    const half = lookup(partialPantry(['population', 'tax-rate']))
    expect(compareOf(half, '0180', '1280', 2024).map((r) => r.indicator.id)).toEqual([
      'population',
      'tax-rate',
    ])
  })

  it('never counts an unfetched indicator in the denominator', () => {
    const half = lookup(partialPantry(['population']))
    const summary = summarise(compareOf(half, '0180', '1280', 2024))
    expect(summary.comparable + summary.notComparable).toBe(1)
  })

  it('compares them all once every file has arrived', () => {
    expect(compareOf(lookup(publishedPantry), '0180', '1280', 2024)).toHaveLength(
      publishedIndex.indicators.length,
    )
  })
})
