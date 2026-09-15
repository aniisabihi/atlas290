import { describe, expect, it } from 'vitest'
import {
  Indicator,
  IndicatorSeries,
  Municipality,
  Similar,
  OBSERVATION_STATUS,
  PantryData,
  statusCode,
} from './pantry'

const stockholm = { code: '0180', name: { sv: 'Stockholm', en: 'Stockholm' }, county: '01' }

/** Smallest index that satisfies the schema; only the money tests care what is in it. */
const priceIndex = { base: 2025, values: { '2024': 100, '2025': 101 } }

describe('pantry schemas', () => {
  it('accepts a valid municipality and rejects a code without leading zero', () => {
    expect(Municipality.parse(stockholm)).toEqual(stockholm)
    expect(() => Municipality.parse({ ...stockholm, code: '180' })).toThrow()
  })

  it('maps status names to stable small integers', () => {
    expect(OBSERVATION_STATUS).toEqual([
      'present',
      'not-yet-published',
      'did-not-exist',
      'perturbed',
      'too-few-cases',
      'structural-break',
    ])
    expect(statusCode('perturbed')).toBe(3)
  })

  it('appends structural-break at the end, leaving every previously stored index unchanged', () => {
    // The whole point of "append only": every status that existed before Plan 2's Task 12
    // keeps the exact same byte it always had. If this ever fails, something inserted or
    // reordered instead of appending, and every published series's stored status bytes for
    // that index would now mean something different than when they were written.
    expect(statusCode('present')).toBe(0)
    expect(statusCode('not-yet-published')).toBe(1)
    expect(statusCode('did-not-exist')).toBe(2)
    expect(statusCode('perturbed')).toBe(3)
    expect(statusCode('too-few-cases')).toBe(4)
    expect(statusCode('structural-break')).toBe(5)
  })

  it('requires series rows to match municipality order and years length', () => {
    const indicator = Indicator.parse({
      id: 'population',
      name: { sv: 'Folkmängd', en: 'Population' },
      description: { sv: 'Antal invånare 31 december.', en: 'Residents on 31 December.' },
      unit: 'count',
      priceBasis: 'none',
      scale: { kind: 'sequential', breaks: [1000, 5000, 20000, 50000, 100000, 500000] },
      coverage: { from: 1968, to: 2025 },
      caveat: { sv: '', en: '' },
      sensitivity: 'none',
      sources: [{ table: 'TAB638', contentCode: 'BE0101N1', note: '1968–2024' }],
      derivation: 'Sum over sex and marital status of SCB table cell values.',
    })
    const series = IndicatorSeries.parse({
      indicator: 'population',
      years: [2024, 2025],
      values: [[984748, 990000]],
      status: [[0, 3]],
    })
    const pantry = PantryData.parse({
      schemaVersion: 1,
      municipalities: [stockholm],
      indicators: [indicator],
      series: [series],
      priceIndex,
    })
    expect(pantry.series[0]?.values[0]?.[1]).toBe(990000)
    expect(() =>
      PantryData.parse({
        ...pantry,
        series: [
          {
            ...series,
            values: [
              [1, 2],
              [3, 4],
            ],
          },
        ],
      }),
    ).toThrow(/rows/)
  })

  it('rejects null values with status 0 (present)', () => {
    expect(() =>
      IndicatorSeries.parse({
        indicator: 'population',
        years: [2024, 2025],
        values: [[null, 990000]],
        status: [[0, 3]],
      }),
    ).toThrow(/null value cannot be 'present'/)
  })

  it('rejects series whose indicator id has no matching indicator', () => {
    const indicator = Indicator.parse({
      id: 'population',
      name: { sv: 'Folkmängd', en: 'Population' },
      description: { sv: 'Antal invånare 31 december.', en: 'Residents on 31 December.' },
      unit: 'count',
      priceBasis: 'none',
      scale: { kind: 'sequential', breaks: [1000, 5000, 20000, 50000, 100000, 500000] },
      coverage: { from: 1968, to: 2025 },
      caveat: { sv: '', en: '' },
      sensitivity: 'none',
      sources: [{ table: 'TAB638', contentCode: 'BE0101N1', note: '1968–2024' }],
      derivation: 'Sum over sex and marital status of SCB table cell values.',
    })
    const series = IndicatorSeries.parse({
      indicator: 'missing-indicator',
      years: [2024, 2025],
      values: [[984748, 990000]],
      status: [[0, 3]],
    })
    expect(() =>
      PantryData.parse({
        schemaVersion: 1,
        municipalities: [stockholm],
        indicators: [indicator],
        series: [series],
        priceIndex,
      }),
    ).toThrow(/missing-indicator/)
  })
})

describe('Similar', () => {
  const valid = {
    schemaVersion: 1 as const,
    method: {
      indicators: ['population', 'density', 'mean-age'],
      logged: ['population', 'density'],
      window: { from: 2015, to: 2024 },
      neighbours: 2,
    },
    nearest: { '0180': ['1280', '1480'], '1280': ['0180', '1480'] },
  }

  it('accepts a well-formed file', () => {
    expect(Similar.parse(valid).nearest['0180']).toEqual(['1280', '1480'])
  })

  it('refuses a backwards window', () => {
    expect(() =>
      Similar.parse({ ...valid, method: { ...valid.method, window: { from: 2024, to: 2015 } } }),
    ).toThrow(/2024-2015, which is backwards/)
  })

  it('refuses a logged indicator that is not one of the indicators compared', () => {
    // The real hazard: dropping an indicator from the metric and forgetting to drop it from
    // the logged list leaves the published method describing a transform applied to nothing,
    // and the site renders that description to the visitor as fact.
    expect(() =>
      Similar.parse({ ...valid, method: { ...valid.method, logged: ['house-prices'] } }),
    ).toThrow(/'house-prices' is listed as log-transformed/)
  })

  it('refuses a municipality with no neighbours', () => {
    expect(() => Similar.parse({ ...valid, nearest: { ...valid.nearest, '0180': [] } })).toThrow(
      /no neighbours, which is not a result/,
    )
  })

  it('refuses a municipality listed as its own neighbour', () => {
    expect(() =>
      Similar.parse({ ...valid, nearest: { ...valid.nearest, '0180': ['0180', '1280'] } }),
    ).toThrow(/is listed as its own neighbour/)
  })

  it('refuses a duplicated neighbour', () => {
    expect(() =>
      Similar.parse({ ...valid, nearest: { ...valid.nearest, '0180': ['1280', '1280'] } }),
    ).toThrow(/appears twice among its neighbours/)
  })

  it('refuses a neighbour that is not a four-digit municipality code', () => {
    expect(() =>
      Similar.parse({ ...valid, nearest: { ...valid.nearest, '0180': ['180', '1280'] } }),
    ).toThrow(/four digits/)
  })
})
