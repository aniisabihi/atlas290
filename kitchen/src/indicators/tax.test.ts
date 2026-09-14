import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { OBSERVATION_STATUS } from '../../../shared/pantry'
import type { TableMeta } from '../scb/client'
import type { FrozenData } from '../scb/freeze'
import { buildTaxSeries, TAX_TABLE, TAX_YEARS, taxSelection } from './tax'

const municipalities = [
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
    ContentsCode: [{ code: 'OE0101D1', label: 'Skattesats, total kommunal' }],
  }
  const vars = { ...defaults, ...overrides }
  return {
    id: TAX_TABLE,
    label: TAX_TABLE,
    variables: Object.entries(vars).map(([code, values]) => ({ code, label: code, values })),
  }
}

/** A minimal Region/ContentsCode/Tid JSON-stat2 chunk, mirroring the real TAB2017 shape. */
function chunk(region: string[], tid: string[], value: Array<number | null>): FrozenData {
  return {
    kind: 'data',
    table: TAX_TABLE,
    lang: 'sv',
    url: '',
    selection: { Region: region, ContentsCode: ['OE0101D1'], Tid: tid },
    fetchedAt: '2026-09-14T10:00:00.000Z',
    response: {
      id: ['Region', 'ContentsCode', 'Tid'],
      size: [region.length, 1, tid.length],
      dimension: {
        Region: { category: { index: region } },
        ContentsCode: { category: { index: ['OE0101D1'] } },
        Tid: { category: { index: tid } },
      },
      value,
    },
  }
}

describe('taxSelection', () => {
  it('resolves the ContentsCode by its Swedish label, not a hardcoded code', () => {
    const meta = fakeMeta({
      ContentsCode: [{ code: 'ZZZ999', label: 'Skattesats, total kommunal' }],
    })
    const sel = taxSelection(meta, ['2024'])
    expect(sel.ContentsCode).toEqual(['ZZZ999'])
  })

  it('throws naming the label when no ContentsCode carries it (label drift, not silently taking the wrong code)', () => {
    const meta = fakeMeta({ ContentsCode: [{ code: 'X', label: 'Something else' }] })
    expect(() => taxSelection(meta, ['2024'])).toThrow(/Skattesats, total kommunal/)
  })

  it('selects only 4-digit municipality codes from Region, dropping the national/county rows', () => {
    const sel = taxSelection(fakeMeta(), ['2024'])
    expect(sel.Region).toEqual(['0330', '0180'])
  })

  it('requests no dimension beyond Region, ContentsCode and Tid', () => {
    const sel = taxSelection(fakeMeta(), ['2024'])
    expect(Object.keys(sel).sort()).toEqual(['ContentsCode', 'Region', 'Tid'])
  })
})

describe('buildTaxSeries', () => {
  it('marks a year before a municipality existed as did-not-exist, discarding whatever SCB sent', () => {
    // Knivsta (CREATED['0330'] = 2002) reads 0 for 2000 on this table too, same as population's
    // TAB638 — existed() must gate regardless of the raw cell.
    const c = chunk(['0330', '0180'], ['2000', '2002'], [0, 20, 31.5, 31.6])
    const series = buildTaxSeries(municipalities, [c], [2000, 2002])
    const name = (i: number, j: number) => OBSERVATION_STATUS[series.status[i]![j]!]
    expect(name(0, 0)).toBe('did-not-exist')
    expect(series.values[0]![0]).toBeNull()
    expect(name(0, 1)).toBe('present')
    expect(series.values[0]![1]).toBe(20)
  })

  it('marks a year outside the fetched range as not-yet-published, not absent, for a municipality that always existed', () => {
    // The chunk simply has no 1999 cell — outside TAX_YEARS' own 2000-2026 coverage. Stockholm
    // existed throughout, so this is not a did-not-exist case; it must still be flagged, not
    // silently treated as a normal missing value.
    const c = chunk(['0180'], ['2000'], [31.5])
    const series = buildTaxSeries([municipalities[1]!], [c], [1999, 2000])
    const name = (j: number) => OBSERVATION_STATUS[series.status[0]![j]!]
    expect(name(0)).toBe('not-yet-published')
    expect(series.values[0]![0]).toBeNull()
    expect(name(1)).toBe('present')
    expect(series.values[0]![1]).toBe(31.5)
  })

  it('keeps rows in municipality order and years in the requested order', () => {
    const c = chunk(['0330', '0180'], ['2024'], [34.0, 30.36])
    const series = buildTaxSeries(municipalities, [c], [2024])
    expect(series.years).toEqual([2024])
    expect(series.values).toHaveLength(2)
  })
})

describe("TAX_YEARS: tax rate's own year range, distinct from population's", () => {
  it('runs 2000 through 2026 — one year beyond every other indicator', () => {
    expect(TAX_YEARS[0]).toBe(2000)
    expect(TAX_YEARS[TAX_YEARS.length - 1]).toBe(2026)
  })
})

describe('buildTaxSeries with real frozen SCB data', () => {
  // kitchen/raw/TAB2017/sv/085270a2a19c7735.json: the real production fetch (Step 5/6 of this
  // task) — all 290 municipalities, ContentsCode=['OE0101D1'], Tid=2000..2026. Verified live
  // against the real API on 2026-09-14 (curl, before writing this test): Stockholm 2024 = 30.36,
  // 2026 = 30.55; Arjeplog 2024 = 34.84.
  const prodChunk = JSON.parse(
    readFileSync('kitchen/raw/TAB2017/sv/085270a2a19c7735.json', 'utf8'),
  ) as FrozenData

  it("reproduces SCB's published Stockholm rate — roughly 30 percent in 2024 — from the real production fetch", () => {
    const stockholm = { code: '0180', name: { sv: 'Stockholm', en: 'Stockholm' }, county: '01' }
    const series = buildTaxSeries([stockholm], [prodChunk], [2024, 2026])
    expect(series.values[0]).toEqual([30.36, 30.55])
    expect(OBSERVATION_STATUS[series.status[0]![0]!]).toBe('present')
    expect(OBSERVATION_STATUS[series.status[0]![1]!]).toBe('present')
  })

  it('reproduces a second real municipality (Arjeplog) too, not just Stockholm', () => {
    const arjeplog = { code: '2506', name: { sv: 'Arjeplog', en: 'Arjeplog' }, county: '25' }
    const series = buildTaxSeries([arjeplog], [prodChunk], [2024])
    expect(series.values[0]).toEqual([34.84])
  })
})
