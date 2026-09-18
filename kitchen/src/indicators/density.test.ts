import { describe, expect, it } from 'vitest'
import { type Municipality } from '../../../shared/pantry'
import type { TableMeta } from '../scb/client'
import type { FrozenData } from '../scb/freeze'
import { DENSITY_TABLE, DENSITY_YEARS, fillLandArea, landAreaSelection } from './density'

/** Minimal fake TableMeta, mirroring population.test.ts's fakeMeta helper. */
function fakeMeta(
  overrides: Record<string, Array<{ code: string; label: string }>> = {},
): TableMeta {
  const defaults: Record<string, Array<{ code: string; label: string }>> = {
    Region: [
      { code: '00', label: 'Riket' },
      { code: '0330', label: 'Knivsta' },
      { code: '0180', label: 'Stockholm' },
    ],
    Kon: [
      { code: '1', label: 'män' },
      { code: '2', label: 'kvinnor' },
      { code: '1+2', label: 'totalt' },
    ],
    ContentsCode: [
      { code: 'BE0101U1', label: 'Invånare per kvadratkilometer' },
      { code: 'BE0101U2', label: 'Folkmängd' },
      { code: 'BE0101U3', label: 'Landareal i kvadratkilometer' },
    ],
  }
  const vars = { ...defaults, ...overrides }
  return {
    id: DENSITY_TABLE,
    label: DENSITY_TABLE,
    variables: Object.entries(vars).map(([code, values]) => ({ code, label: code, values })),
  }
}

/** A minimal Region/Kon/ContentsCode/Tid JSON-stat2 chunk for a single content code and Kon value. */
function chunk(
  contentCode: string,
  region: string[],
  tid: string[],
  value: Array<number | null>,
): FrozenData {
  return {
    kind: 'data',
    table: DENSITY_TABLE,
    lang: 'sv',
    url: '',
    selection: { Region: region, Kon: ['1+2'], ContentsCode: [contentCode], Tid: tid },
    fetchedAt: '2026-09-14T10:00:00.000Z',
    response: {
      id: ['Region', 'Kon', 'ContentsCode', 'Tid'],
      size: [region.length, 1, 1, tid.length],
      dimension: {
        Region: { category: { index: region } },
        Kon: { category: { index: ['1+2'] } },
        ContentsCode: { category: { index: [contentCode] } },
        Tid: { category: { index: tid } },
      },
      value,
    },
  }
}

describe('landAreaSelection', () => {
  it('resolves the land-area ContentsCode by its own distinct label', () => {
    const sel = landAreaSelection(fakeMeta(), ['2024'])
    expect(sel.ContentsCode).toEqual(['BE0101U3'])
  })
})

describe('fillLandArea', () => {
  it('fills Municipality.landAreaKm2 from the newest year with a real value', () => {
    const m: Municipality = {
      code: '0180',
      name: { sv: 'Stockholm', en: 'Stockholm' },
      county: '01',
    }
    const c = chunk('BE0101U3', ['0180'], ['2023', '2024', '2025'], [188.2, 188.22, null])
    fillLandArea([m], [c], [2023, 2024, 2025])
    expect(m.landAreaKm2).toBe(188.22)
  })

  it('leaves landAreaKm2 undefined when every fetched year is null', () => {
    const m: Municipality = {
      code: '0180',
      name: { sv: 'Stockholm', en: 'Stockholm' },
      county: '01',
    }
    const c = chunk('BE0101U3', ['0180'], ['2024'], [null])
    fillLandArea([m], [c], [2024])
    expect(m.landAreaKm2).toBeUndefined()
  })
})

describe("DENSITY_YEARS: density's own year range, distinct from population's", () => {
  it('runs 1991 through 2025', () => {
    expect(DENSITY_YEARS[0]).toBe(1991)
    expect(DENSITY_YEARS[DENSITY_YEARS.length - 1]).toBe(2025)
  })
})
