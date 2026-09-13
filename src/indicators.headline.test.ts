import { describe, expect, it } from 'vitest'
import { PantryData } from '../shared/pantry'
import rawData from '../public/pantry/data/indicators.json'

// JSON import (not node:fs), matching RenderCheck.test.ts, so this test needs no Node types
// and reads exactly the file the site itself fetches at /pantry/data/indicators.json.
//
// The highest-value missing test in the repository (final review): these six lines make the
// repository self-proving. If any of them ever fails, the pantry no longer matches the ground
// truth this whole project is built on, and something must be investigated — never "fixed" by
// changing the expected number here.
describe('published pantry: headline facts', () => {
  const data = PantryData.parse(rawData)
  const population = data.series.find((s) => s.indicator === 'population')!
  const yearIndex = (year: number) => population.years.indexOf(year)
  const totalIn = (year: number) => {
    const yi = yearIndex(year)
    return population.values.reduce((sum, row) => sum + (row[yi] ?? 0), 0)
  }

  it('covers all 290 municipalities', () => {
    expect(data.municipalities).toHaveLength(290)
  })

  it('covers 58 years, 1968 to 2025', () => {
    expect(population.years).toHaveLength(58)
    expect(population.years[0]).toBe(1968)
    expect(population.years[population.years.length - 1]).toBe(2025)
  })

  it("Stockholm's 2025 population is 999,239", () => {
    const stockholm = data.municipalities.findIndex((m) => m.code === '0180')
    expect(population.values[stockholm]?.[yearIndex(2025)]).toBe(999_239)
  })

  it('the national total is 7,931,193 in 1968 and 10,605,520 in 2025', () => {
    expect(totalIn(1968)).toBe(7_931_193)
    expect(totalIn(2025)).toBe(10_605_520)
  })
})
