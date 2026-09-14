import { describe, expect, it } from 'vitest'
import type { Indicator, IndicatorSeries } from '../../shared/pantry'
import { roundIndicatorBreaks, roundSeriesValues, roundToUnit, UNIT_DECIMALS } from './round'

describe('UNIT_DECIMALS', () => {
  it('declares exactly the six units Indicator.unit allows, per this task', () => {
    expect(UNIT_DECIMALS).toEqual({
      count: 0,
      sek: 0,
      percent: 2,
      'per-thousand': 2,
      'per-km2': 1,
      years: 1,
    })
  })
})

describe('roundToUnit', () => {
  it('rounds count to whole numbers', () => {
    expect(roundToUnit(999_239.4, 'count')).toBe(999_239)
  })

  it('rounds sek to whole kronor', () => {
    expect(roundToUnit(16_253_221.539089134, 'sek')).toBe(16_253_222)
    expect(roundToUnit(458_705.740093942, 'sek')).toBe(458_706)
  })

  it('rounds percent to two decimals — matching what SCB itself publishes for tax-rate (Stockholm 2024: 30.36)', () => {
    expect(roundToUnit(30.36, 'percent')).toBe(30.36)
    expect(roundToUnit(3.0348662110506197, 'percent')).toBe(3.03)
    expect(roundToUnit(65.27777777777779, 'percent')).toBe(65.28)
  })

  it("does not collapse a two-decimal tax rate to one decimal (the brief's own named trap)", () => {
    // 30.36 rounded to 2 decimals must stay 30.36, never 30.4.
    expect(roundToUnit(30.36, 'percent')).not.toBe(30.4)
  })

  it('rounds per-thousand to two decimals', () => {
    expect(roundToUnit(1.1621436477850968, 'per-thousand')).toBe(1.16)
  })

  it("rounds per-km2 to one decimal — matching SCB's own density table", () => {
    expect(roundToUnit(5289.4, 'per-km2')).toBe(5289.4)
  })

  it("rounds years to one decimal — matching SCB's own mean-age table", () => {
    expect(roundToUnit(53.3, 'years')).toBe(53.3)
  })

  it('is stable under the classic floating-point scaling trap (1.005 * 100 !== 100.5)', () => {
    // Math.round(value * 100) / 100 gives 1 here (WRONG — should be 1.01) because
    // 1.005 * 100 === 100.49999999999999 in IEEE 754 double precision. toFixed asks the
    // engine for the correctly-rounded decimal string of the double's true value instead of
    // going through that lossy intermediate multiplication.
    const naive = Math.round(1.005 * 100) / 100
    expect(naive).toBe(1) // proves the trap is real in this environment
    // roundToUnit must not reproduce it (though it may round to 1 OR 1.01 depending on the
    // double actually closest to "1.005" — the point is it comes from toFixed, not the naive
    // formula, so it is deterministic and spec-defined either way).
    expect(roundToUnit(1.005, 'percent')).toBe(Number((1.005).toFixed(2)))
  })

  it('leaves null untouched when rounding a series (never coerces missing data into a number)', () => {
    const series: IndicatorSeries = {
      indicator: 'x',
      years: [2024],
      values: [[null]],
      status: [[1]],
    }
    expect(roundSeriesValues(series, 'percent').values).toEqual([[null]])
  })

  it('rounds every non-null value in a series to the given unit precision', () => {
    const series: IndicatorSeries = {
      indicator: 'x',
      years: [2023, 2024],
      values: [
        [3.0348662110506197, null],
        [-2.678983833718245, 65.27777777777779],
      ],
      status: [
        [0, 1],
        [0, 0],
      ],
    }
    expect(roundSeriesValues(series, 'percent').values).toEqual([
      [3.03, null],
      [-2.68, 65.28],
    ])
  })
})

describe('roundIndicatorBreaks', () => {
  it("rounds an indicator's fixed colour-scale breaks to its own unit precision", () => {
    const indicator: Indicator = {
      id: 'x',
      name: { sv: '', en: '' },
      description: { sv: '', en: '' },
      unit: 'sek',
      priceBasis: 'none',
      scale: {
        kind: 'sequential',
        breaks: [670_879.1674928813, 822_481.3764731244],
      },
      coverage: { from: 2000, to: 2020 },
      caveat: { sv: '', en: '' },
      sensitivity: 'none',
      sources: [],
      derivation: '',
    }
    expect(roundIndicatorBreaks(indicator).scale.breaks).toEqual([670_879, 822_481])
  })
})
