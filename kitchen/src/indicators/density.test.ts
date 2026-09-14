import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { OBSERVATION_STATUS, type Municipality } from '../../../shared/pantry'
import type { TableMeta } from '../scb/client'
import type { FrozenData } from '../scb/freeze'
import {
  buildDensitySeries,
  densitySelection,
  DENSITY_TABLE,
  DENSITY_YEARS,
  fillLandArea,
  landAreaSelection,
} from './density'

const municipalities: Municipality[] = [
  { code: '0330', name: { sv: 'Knivsta', en: 'Knivsta' }, county: '03' }, // created 2002
  { code: '0180', name: { sv: 'Stockholm', en: 'Stockholm' }, county: '01' }, // always existed
]

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

describe('densitySelection', () => {
  it("selects the '1+2' Kon total instead of falling through to summing the sexes (ruling R1)", () => {
    const sel = densitySelection(fakeMeta(), ['2024'])
    expect(sel.Kon).toEqual(['1+2'])
  })

  it('resolves the density ContentsCode by its Swedish label, not by array position', () => {
    // BE0101U2 (Folkmängd) sits before BE0101U1 in this fixture's ordering on purpose: picking
    // "the first code" or "the population code" instead of resolving by label would be wrong.
    const meta = fakeMeta({
      ContentsCode: [
        { code: 'BE0101U2', label: 'Folkmängd' },
        { code: 'BE0101U1', label: 'Invånare per kvadratkilometer' },
        { code: 'BE0101U3', label: 'Landareal i kvadratkilometer' },
      ],
    })
    const sel = densitySelection(meta, ['2024'])
    expect(sel.ContentsCode).toEqual(['BE0101U1'])
  })

  it('selects only 4-digit municipality codes from Region, dropping the national/county rows', () => {
    const sel = densitySelection(fakeMeta(), ['2024'])
    expect(sel.Region).toEqual(['0330', '0180'])
  })
})

describe('landAreaSelection', () => {
  it('resolves the land-area ContentsCode by its own distinct label', () => {
    const sel = landAreaSelection(fakeMeta(), ['2024'])
    expect(sel.ContentsCode).toEqual(['BE0101U3'])
  })
})

describe('buildDensitySeries', () => {
  it('marks a year before a municipality existed as did-not-exist, discarding whatever SCB sent', () => {
    const c = chunk('BE0101U1', ['0330', '0180'], ['2000', '2002'], [0, 5289.4, 0.5, 5300.1])
    const series = buildDensitySeries(municipalities, [c], [2000, 2002])
    const name = (i: number, j: number) => OBSERVATION_STATUS[series.status[i]![j]!]
    expect(name(0, 0)).toBe('did-not-exist')
    expect(series.values[0]![0]).toBeNull()
    expect(name(0, 1)).toBe('present')
    expect(series.values[0]![1]).toBe(5289.4)
  })

  it('marks a year outside the fetched range as not-yet-published, not absent', () => {
    const c = chunk('BE0101U1', ['0180'], ['2000'], [5289.4])
    const series = buildDensitySeries([municipalities[1]!], [c], [1990, 2000])
    const name = (j: number) => OBSERVATION_STATUS[series.status[0]![j]!]
    expect(name(0)).toBe('not-yet-published')
    expect(series.values[0]![0]).toBeNull()
    expect(name(1)).toBe('present')
  })

  it('marks years from 2025 onward as perturbed, matching population´s CKM_FROM', () => {
    const c = chunk('BE0101U1', ['0180'], ['2024', '2025'], [5280.0, 5289.4])
    const series = buildDensitySeries([municipalities[1]!], [c], [2024, 2025])
    const name = (j: number) => OBSERVATION_STATUS[series.status[0]![j]!]
    expect(name(0)).toBe('present')
    expect(name(1)).toBe('perturbed')
  })

  it('supports an explicit perturbation year distinct from the real CKM_FROM, mirroring buildPopulationSeries', () => {
    const c = chunk('BE0101U1', ['0180'], ['2010', '2011'], [5000, 5001])
    const series = buildDensitySeries([municipalities[1]!], [c], [2010, 2011], 2011)
    const name = (j: number) => OBSERVATION_STATUS[series.status[0]![j]!]
    expect(name(0)).toBe('present')
    expect(name(1)).toBe('perturbed')
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

describe('buildDensitySeries and fillLandArea with real frozen SCB data', () => {
  // kitchen/raw/TAB628/sv/d01696b0da77ba49.json (density, BE0101U1) and
  // .../a26d8c86f74ca15a.json (land area, BE0101U3): the real production fetch (Step 5/6 of
  // this task) — all 290 municipalities, Kon=['1+2'], Tid=1991..2025. Verified live against the
  // real API on 2026-09-14 (curl, before writing this test): Stockholm 2024 density = 5289.4
  // (thousands per km²), Arjeplog 2024 density = 0.2 (well under one); Stockholm land area =
  // 188.22 km², Arjeplog = 12635.46 km².
  const densityChunk = JSON.parse(
    readFileSync('kitchen/raw/TAB628/sv/d01696b0da77ba49.json', 'utf8'),
  ) as FrozenData
  const areaChunk = JSON.parse(
    readFileSync('kitchen/raw/TAB628/sv/a26d8c86f74ca15a.json', 'utf8'),
  ) as FrozenData
  const stockholm: Municipality = {
    code: '0180',
    name: { sv: 'Stockholm', en: 'Stockholm' },
    county: '01',
  }
  const arjeplog: Municipality = {
    code: '2506',
    name: { sv: 'Arjeplog', en: 'Arjeplog' },
    county: '25',
  }

  it('reproduces the real Stockholm and Arjeplog densities for 2024', () => {
    const series = buildDensitySeries([stockholm, arjeplog], [densityChunk], [2024])
    expect(series.values[0]).toEqual([5289.4])
    expect(series.values[1]).toEqual([0.2])
  })

  it('marks the real 2025 cell perturbed, matching population´s CKM_FROM', () => {
    const series = buildDensitySeries([stockholm], [densityChunk], [2024, 2025])
    expect(OBSERVATION_STATUS[series.status[0]![0]!]).toBe('present')
    expect(OBSERVATION_STATUS[series.status[0]![1]!]).toBe('perturbed')
  })

  it('fills real land areas for Stockholm and Arjeplog from the same table', () => {
    const stockholmCopy = { ...stockholm }
    const arjeplogCopy = { ...arjeplog }
    fillLandArea([stockholmCopy, arjeplogCopy], [areaChunk], DENSITY_YEARS)
    expect(stockholmCopy.landAreaKm2).toBe(188.22)
    expect(arjeplogCopy.landAreaKm2).toBe(12635.46)
  })
})
