import { describe, expect, it } from 'vitest'
import { publishedPantry } from './test/pantry'
import { OBSERVATION_STATUS, type IndicatorSeries } from '../shared/pantry'

// JSON import (not node:fs), matching RenderCheck.test.ts, so this test needs no Node types
// and reads exactly the file the site itself fetches at /pantry/data/indicators.json.
//
// The highest-value missing test in the repository (final review): these lines make the
// repository self-proving. If any of them ever fails, the pantry no longer matches the ground
// truth this whole project is built on, and something must be investigated — never "fixed" by
// changing the expected number here.
//
// Task 13 (docs/plans/2026-09-14-02-the-ten-indicators.md) extends this from population alone
// to all ten published indicators: coverage years, an EXACT non-null cell count (never merely
// "greater than zero" — a count is a number that can drift wrong the same way a value can, and
// asserting only its sign would not catch that), and one specific real value per indicator.
// Every figure below was read off the actual published `public/pantry/data/indicators.json`
// after a real `yarn kitchen publish` (never estimated, never carried over from a planning
// document without re-checking) — see this task's own commit message for how each was
// obtained.
describe('published pantry: headline facts', () => {
  const data = publishedPantry
  const codeOf = (name: string) =>
    data.municipalities.find((m) => m.name.sv === name)?.code ??
    (() => {
      throw new Error(`no municipality named '${name}'`)
    })()
  const rowOf = (code: string) => data.municipalities.findIndex((m) => m.code === code)
  const seriesOf = (id: string): IndicatorSeries => {
    const s = data.series.find((x) => x.indicator === id)
    if (!s) throw new Error(`no series for indicator '${id}'`)
    return s
  }
  const nonNullCount = (id: string) =>
    seriesOf(id).values.reduce((n, row) => n + row.filter((v) => v !== null).length, 0)
  const cell = (id: string, code: string, year: number) => {
    const s = seriesOf(id)
    const i = rowOf(code)
    const j = s.years.indexOf(year)
    return { value: s.values[i]?.[j] ?? null, status: OBSERVATION_STATUS[s.status[i]?.[j] ?? 0] }
  }

  const population = seriesOf('population')
  const yearIndex = (year: number) => population.years.indexOf(year)
  const totalIn = (year: number) => {
    const yi = yearIndex(year)
    return population.values.reduce((sum, row) => sum + (row[yi] ?? 0), 0)
  }

  it('covers all 290 municipalities', () => {
    expect(data.municipalities).toHaveLength(290)
  })

  it('publishes exactly the ten registered indicators', () => {
    expect(data.indicators.map((i) => i.id).sort()).toEqual(
      [
        'population',
        'tax-rate',
        'density',
        'net-migration-rate',
        'median-income',
        'house-prices',
        'post-secondary-education',
        'population-change',
        'mean-age',
        'share-65-plus',
      ].sort(),
    )
  })

  describe('population', () => {
    it('covers 58 years, 1968 to 2025, with 16,658 of 16,820 cells non-null', () => {
      expect(population.years).toHaveLength(58)
      expect(population.years[0]).toBe(1968)
      expect(population.years[population.years.length - 1]).toBe(2025)
      expect(nonNullCount('population')).toBe(16_658)
    })

    it("Stockholm's 2025 population is 999,239 (perturbed, Cell Key Method)", () => {
      expect(cell('population', codeOf('Stockholm'), 2025)).toEqual({
        value: 999_239,
        status: 'perturbed',
      })
    })

    it('the national total is 7,931,193 in 1968 and 10,605,520 in 2025', () => {
      expect(totalIn(1968)).toBe(7_931_193)
      expect(totalIn(2025)).toBe(10_605_520)
    })
  })

  describe('tax-rate', () => {
    it('covers 2000 to 2026 (a year ahead of every other indicator), 7,827 of 7,830 cells non-null', () => {
      const s = seriesOf('tax-rate')
      expect(s.years[0]).toBe(2000)
      expect(s.years[s.years.length - 1]).toBe(2026)
      expect(nonNullCount('tax-rate')).toBe(7_827)
    })

    it("Stockholm's 2024 tax rate is 30.36 percent", () => {
      expect(cell('tax-rate', codeOf('Stockholm'), 2024)).toEqual({
        value: 30.36,
        status: 'present',
      })
    })
  })

  describe('density', () => {
    it('covers 1991 to 2025, 10,126 of 10,150 cells non-null', () => {
      const s = seriesOf('density')
      expect(s.years[0]).toBe(1991)
      expect(s.years[s.years.length - 1]).toBe(2025)
      expect(nonNullCount('density')).toBe(10_126)
    })

    it("Stockholm's 2024 density is 5,289.4 residents per km²", () => {
      expect(cell('density', codeOf('Stockholm'), 2024)).toEqual({
        value: 5_289.4,
        status: 'present',
      })
    })
  })

  describe('net-migration-rate', () => {
    it('covers 1968 to 2025, 15,229 of 16,820 cells non-null (50 current municipalities have no reachable 1968-1996 code)', () => {
      const s = seriesOf('net-migration-rate')
      expect(s.years[0]).toBe(1968)
      expect(s.years[s.years.length - 1]).toBe(2025)
      expect(nonNullCount('net-migration-rate')).toBe(15_229)
    })

    // Follow-up to Task 13: the published pantry now rounds every value to the precision its
    // unit honestly carries (per-thousand: 2 decimals) — the raw computed rate was
    // 1.1621436477850968, which this asserted via toBeCloseTo before rounding was applied.
    // Now published as exactly 1.16, so this asserts the real number, not merely "close to" a
    // figure with more digits than the pantry actually stores.
    it("Stockholm's 2024 net migration rate is 1.16 per 1,000 residents", () => {
      const { value, status } = cell('net-migration-rate', codeOf('Stockholm'), 2024)
      expect(value).toBe(1.16)
      expect(status).toBe('present')
    })
  })

  describe('median-income', () => {
    it('covers 1999 to 2024, 7,537 of 7,540 cells non-null', () => {
      const s = seriesOf('median-income')
      expect(s.years[0]).toBe(1999)
      expect(s.years[s.years.length - 1]).toBe(2024)
      expect(nonNullCount('median-income')).toBe(7_537)
    })

    // Follow-up to Task 13: sek rounds to whole kronor (0 decimals) — the raw adjusted value
    // was 458,705.740093942, which this asserted via toBeCloseTo(…, 2) before rounding. Now
    // published as exactly 458,706 kronor (rounded up from .74), still nowhere near the
    // 455,600 kronor nominal (unadjusted) figure this test exists to rule out.
    it("Danderyd's 2024 median income is 458,706 kronor, adjusted to the latest (2025) kronor — not the 455,600 kronor nominal figure", () => {
      const { value, status } = cell('median-income', codeOf('Danderyd'), 2024)
      expect(value).toBe(458_706)
      expect(status).toBe('present')
    })
  })

  describe('house-prices', () => {
    it('covers 1981 to 2025, 12,723 of 13,050 cells non-null', () => {
      const s = seriesOf('house-prices')
      expect(s.years[0]).toBe(1981)
      expect(s.years[s.years.length - 1]).toBe(2025)
      expect(nonNullCount('house-prices')).toBe(12_723)
    })

    // Follow-up to Task 13: sek rounds to whole kronor (0 decimals) — the raw adjusted value
    // was 16,253,221.539089134, which this asserted via toBeCloseTo(…, 2) before rounding. Now
    // published as exactly 16,253,222 kronor (rounded up from .539).
    it("Danderyd's 2021 mean house price is 16,253,222 kronor, adjusted to the latest kronor", () => {
      const { value, status } = cell('house-prices', codeOf('Danderyd'), 2021)
      expect(value).toBe(16_253_222)
      expect(status).toBe('present')
    })
  })

  describe('post-secondary-education', () => {
    it('covers 1985 to 2025, 11,830 of 11,890 cells non-null', () => {
      const s = seriesOf('post-secondary-education')
      expect(s.years[0]).toBe(1985)
      expect(s.years[s.years.length - 1]).toBe(2025)
      expect(nonNullCount('post-secondary-education')).toBe(11_830)
    })

    // Follow-up to Task 13: percent rounds to 2 decimals — the raw share was
    // 65.27777777777779, which this asserted via toBeCloseTo(65.278, 2) before rounding (that
    // assertion still happened to pass afterward, within its 0.005 tolerance, but 65.278 is no
    // longer the real published number — asserting it as if it still were would be exactly the
    // kind of silent staleness this task exists to fix). Now published as exactly 65.28.
    it("Danderyd's 2024 post-secondary education share is 65.28 percent", () => {
      const { value, status } = cell('post-secondary-education', codeOf('Danderyd'), 2024)
      expect(value).toBe(65.28)
      expect(status).toBe('present')
    })
  })

  describe('population-change', () => {
    it('covers 1968 to 2025, 16,363 of 16,820 cells non-null', () => {
      const s = seriesOf('population-change')
      expect(s.years[0]).toBe(1968)
      expect(s.years[s.years.length - 1]).toBe(2025)
      expect(nonNullCount('population-change')).toBe(16_363)
    })

    // Follow-up to Task 13: percent rounds to 2 decimals — the raw values were
    // 3.0348662110506197 and -2.678983833718245, which this asserted via toBeCloseTo(…, 3)
    // before rounding. Now published as exactly 3.03 and -2.68.
    it('Järfälla grew 3.03 percent in 2024 and Hällefors shrank 2.68 percent', () => {
      const jarfalla = cell('population-change', codeOf('Järfälla'), 2024)
      const hallefors = cell('population-change', codeOf('Hällefors'), 2024)
      expect(jarfalla.value).toBe(3.03)
      expect(jarfalla.status).toBe('present')
      expect(hallefors.value).toBe(-2.68)
      expect(hallefors.status).toBe('present')
    })
  })

  describe('mean-age', () => {
    it('covers 1998 to 2025 (SCB has no municipal mean-age table before 1998), 8,116 of 8,120 cells non-null', () => {
      const s = seriesOf('mean-age')
      expect(s.years[0]).toBe(1998)
      expect(s.years[s.years.length - 1]).toBe(2025)
      expect(nonNullCount('mean-age')).toBe(8_116)
    })

    it("Borgholm's 2025 mean age is 53.3 years", () => {
      expect(cell('mean-age', codeOf('Borgholm'), 2025)).toEqual({
        value: 53.3,
        status: 'present',
      })
    })
  })

  describe('share-65-plus', () => {
    it('covers 1968 to 2025, 16,658 of 16,820 cells non-null', () => {
      const s = seriesOf('share-65-plus')
      expect(s.years[0]).toBe(1968)
      expect(s.years[s.years.length - 1]).toBe(2025)
      expect(nonNullCount('share-65-plus')).toBe(16_658)
    })

    // Follow-up to Task 13: percent rounds to 2 decimals. Borgholm's raw share was
    // 40.65499717673631 — asserted here via toBeCloseTo(40.655, 2) before rounding, which sat
    // right at that assertion's own 0.005 tolerance boundary (the actual gap was 0.0000028).
    // toFixed(2) rounds the double's true value, which is a hair under 40.655, to 40.65, not
    // 40.66 — confirmed directly in node, not assumed. Sundbyberg's raw share was
    // 13.629824561403508, already rounding to the same 13.63 this test asserted before.
    it("Borgholm's 2025 share aged 65+ is 40.65 percent and Sundbyberg's is 13.63 percent, both perturbed", () => {
      const borgholm = cell('share-65-plus', codeOf('Borgholm'), 2025)
      const sundbyberg = cell('share-65-plus', codeOf('Sundbyberg'), 2025)
      expect(borgholm.value).toBe(40.65)
      expect(borgholm.status).toBe('perturbed')
      expect(sundbyberg.value).toBe(13.63)
      expect(sundbyberg.status).toBe('perturbed')
    })

    it('the national (population-weighted) share aged 65+ is about 13.39 percent in 1968 and 21.08 percent in 2025', () => {
      // A national SHARE cannot be read off any one municipality's row, and averaging the 290
      // per-municipality percentages unweighted would let tiny Bjurholm move the figure as
      // much as Stockholm — the national share is (sum of every municipality's 65+ residents)
      // / (sum of every municipality's total population), not an average of ratios.
      const share65 = seriesOf('share-65-plus')
      const nationalShare65 = (year: number) => {
        const pj = yearIndex(year)
        const sj = share65.years.indexOf(year)
        let numerator = 0
        let denominator = 0
        for (let i = 0; i < data.municipalities.length; i++) {
          const pop = population.values[i]?.[pj] ?? null
          const share = share65.values[i]?.[sj] ?? null
          if (pop === null || share === null) continue
          numerator += (share / 100) * pop
          denominator += pop
        }
        return (numerator / denominator) * 100
      }
      expect(nationalShare65(1968)).toBeCloseTo(13.39, 2)
      expect(nationalShare65(2025)).toBeCloseTo(21.08, 2)
    })
  })
})
