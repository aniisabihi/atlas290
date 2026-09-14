import { describe, expect, it } from 'vitest'
import {
  Indicator,
  IndicatorSeries,
  Municipality,
  OBSERVATION_STATUS,
  PantryData,
  statusCode,
} from './pantry'

const stockholm = { code: '0180', name: { sv: 'Stockholm', en: 'Stockholm' }, county: '01' }

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
    ])
    expect(statusCode('perturbed')).toBe(3)
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
      }),
    ).toThrow(/missing-indicator/)
  })
})
