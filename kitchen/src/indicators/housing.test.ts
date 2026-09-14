import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { OBSERVATION_STATUS, type Municipality } from '../../../shared/pantry'
import type { TableMeta } from '../scb/client'
import type { FrozenData } from '../scb/freeze'
import { toRows } from '../scb/jsonstat'
import {
  buildHousingSeries,
  HOUSING_MIN_COUNT,
  HOUSING_TABLE,
  HOUSING_YEARS,
  housingCountSelection,
  housingPriceSelection,
} from './housing'

const municipalities: Municipality[] = [
  { code: '0330', name: { sv: 'Knivsta', en: 'Knivsta' }, county: '03' }, // created 2002
  { code: '0180', name: { sv: 'Stockholm', en: 'Stockholm' }, county: '01' }, // always existed
]

/** Minimal fake TableMeta, mirroring density.test.ts's/income.test.ts's fakeMeta helper. */
function fakeMeta(
  overrides: Record<string, Array<{ code: string; label: string }>> = {},
): TableMeta {
  const defaults: Record<string, Array<{ code: string; label: string }>> = {
    Region: [
      { code: '00', label: 'Riket' },
      { code: '0010', label: 'Stor-Stockholm' }, // not a municipality — trap 1
      { code: '0330', label: 'Knivsta' },
      { code: '0180', label: 'Stockholm' },
    ],
    Fastighetstyp: [
      { code: '220', label: 'permanentbostad (ej tomträtt)' },
      { code: '221', label: 'fritidshus' },
    ],
    ContentsCode: [
      { code: 'BO0501C1', label: 'Antal' },
      { code: 'BO0501C2', label: 'Köpeskilling, medelvärde i tkr' },
    ],
  }
  const vars = { ...defaults, ...overrides }
  return {
    id: HOUSING_TABLE,
    label: HOUSING_TABLE,
    variables: Object.entries(vars).map(([code, values]) => ({ code, label: code, values })),
  }
}

/** A minimal Region/Fastighetstyp/ContentsCode/Tid JSON-stat2 chunk, real TAB1169 shape. */
function chunk(
  contentCode: string,
  region: string[],
  tid: string[],
  value: Array<number | null>,
): FrozenData {
  return {
    kind: 'data',
    table: HOUSING_TABLE,
    lang: 'sv',
    url: '',
    selection: { Region: region, Fastighetstyp: ['220'], ContentsCode: [contentCode], Tid: tid },
    fetchedAt: '2026-09-14T10:00:00.000Z',
    response: {
      id: ['Region', 'Fastighetstyp', 'ContentsCode', 'Tid'],
      size: [region.length, 1, 1, tid.length],
      dimension: {
        Region: { category: { index: region } },
        Fastighetstyp: { category: { index: ['220'] } },
        ContentsCode: { category: { index: [contentCode] } },
        Tid: { category: { index: tid } },
      },
      value,
    },
  }
}

describe('housingPriceSelection / housingCountSelection', () => {
  it("select the '220' (permanent home) Fastighetstyp code, resolved by its Swedish label, never '221' (holiday home)", () => {
    // '221' sits first in this fixture's ordering on purpose: picking "the first code" or
    // "the second code" instead of resolving by label would be wrong.
    const meta = fakeMeta({
      Fastighetstyp: [
        { code: '221', label: 'fritidshus' },
        { code: '220', label: 'permanentbostad (ej tomträtt)' },
      ],
    })
    expect(housingPriceSelection(meta, ['0330', '0180'], ['2024']).Fastighetstyp).toEqual(['220'])
    expect(housingCountSelection(meta, ['0330', '0180'], ['2024']).Fastighetstyp).toEqual(['220'])
  })

  it('throws naming Fastighetstyp when no value carries the permanent-home label (label drift, never silently taking the wrong code)', () => {
    const meta = fakeMeta({ Fastighetstyp: [{ code: '220', label: 'something else' }] })
    expect(() => housingPriceSelection(meta, ['0330', '0180'], ['2024'])).toThrow(/Fastighetstyp/)
  })

  it("resolves the price ContentsCode by its Swedish label 'Köpeskilling, medelvärde i tkr', not a hardcoded code", () => {
    const meta = fakeMeta({
      ContentsCode: [
        { code: 'ZZZ', label: 'Köpeskilling, medelvärde i tkr' },
        { code: 'BO0501C1', label: 'Antal' },
      ],
    })
    expect(housingPriceSelection(meta, ['0330', '0180'], ['2024']).ContentsCode).toEqual(['ZZZ'])
  })

  it("resolves the count ContentsCode by its Swedish label 'Antal', not a hardcoded code", () => {
    const meta = fakeMeta({
      ContentsCode: [
        { code: 'BO0501C2', label: 'Köpeskilling, medelvärde i tkr' },
        { code: 'YYY', label: 'Antal' },
      ],
    })
    expect(housingCountSelection(meta, ['0330', '0180'], ['2024']).ContentsCode).toEqual(['YYY'])
  })

  it('selects only KNOWN municipality codes from Region, dropping a four-digit Stor-Stockholm-shaped code even though it is four digits too (trap 1)', () => {
    const sel = housingPriceSelection(fakeMeta(), ['0330', '0180'], ['2024'])
    expect(sel.Region).toEqual(['0330', '0180'])
    expect(sel.Region).not.toContain('0010')
  })
})

describe('buildHousingSeries', () => {
  const cpi = new Map([
    [1999, 100],
    [2002, 150],
    [2003, 155],
    [2024, 250],
  ])

  it(
    'marks a year before a municipality existed as did-not-exist, using the SAME one-year-later ' +
      "shift net migration uses (existed(code, y - 1)), not population's plain existed(code, y) " +
      '— verified against the real frozen data below, where Knivsta´s first real sale count is ' +
      '2003, one year after CREATED[0330]=2002, not 2002 itself',
    () => {
      const priceChunk = chunk('BO0501C2', ['0330'], ['2002', '2003'], [null, 3000])
      const countChunk = chunk('BO0501C1', ['0330'], ['2002', '2003'], [null, 100])
      const series = buildHousingSeries(
        [municipalities[0]!],
        [priceChunk],
        [countChunk],
        [2002, 2003],
        cpi,
        HOUSING_MIN_COUNT,
        2003,
      )
      const name = (j: number) => OBSERVATION_STATUS[series.status[0]![j]!]
      expect(name(0)).toBe('did-not-exist')
      expect(series.values[0]![0]).toBeNull()
      expect(name(1)).toBe('present')
    },
  )

  it('marks a year outside the fetched range as not-yet-published, not absent', () => {
    const priceChunk = chunk('BO0501C2', ['0180'], ['2024'], [3000])
    const countChunk = chunk('BO0501C1', ['0180'], ['2024'], [100])
    const series = buildHousingSeries(
      [municipalities[1]!],
      [priceChunk],
      [countChunk],
      [1999, 2024],
      cpi,
      HOUSING_MIN_COUNT,
      2024,
    )
    const name = (j: number) => OBSERVATION_STATUS[series.status[0]![j]!]
    expect(name(0)).toBe('not-yet-published')
    expect(series.values[0]![0]).toBeNull()
    expect(name(1)).toBe('present')
  })

  it(
    "REQUIRED: a cell whose sale count is below the indicator's minCount is nulled and marked " +
      "'too-few-cases', even though a real price was published for it",
    () => {
      const priceChunk = chunk('BO0501C2', ['0180'], ['2024'], [3000])
      const countChunk = chunk('BO0501C1', ['0180'], ['2024'], [HOUSING_MIN_COUNT - 1])
      const series = buildHousingSeries(
        [municipalities[1]!],
        [priceChunk],
        [countChunk],
        [2024],
        cpi,
        HOUSING_MIN_COUNT,
        2024,
      )
      expect(OBSERVATION_STATUS[series.status[0]![0]!]).toBe('too-few-cases')
      expect(series.values[0]![0]).toBeNull()
    },
  )

  it("REQUIRED: a cell whose sale count is AT the threshold is kept and marked 'present', not suppressed", () => {
    const priceChunk = chunk('BO0501C2', ['0180'], ['2024'], [3000])
    const countChunk = chunk('BO0501C1', ['0180'], ['2024'], [HOUSING_MIN_COUNT])
    const series = buildHousingSeries(
      [municipalities[1]!],
      [priceChunk],
      [countChunk],
      [2024],
      cpi,
      HOUSING_MIN_COUNT,
      2024,
    )
    expect(OBSERVATION_STATUS[series.status[0]![0]!]).toBe('present')
    expect(series.values[0]![0]).not.toBeNull()
  })

  it(
    "REQUIRED: an early year's inflation-adjusted price is meaningfully higher than its nominal " +
      'value, so a regression that silently dropped the CPI adjustment fails',
    () => {
      const priceChunk = chunk('BO0501C2', ['0180'], ['1999'], [200]) // 200 tkr nominal
      const countChunk = chunk('BO0501C1', ['0180'], ['1999'], [50])
      const series = buildHousingSeries(
        [municipalities[1]!],
        [priceChunk],
        [countChunk],
        [1999],
        cpi,
        HOUSING_MIN_COUNT,
        2024,
      )
      const adjusted = series.values[0]![0]!
      // Nominal in real kronor (tkr * 1000) is 200_000; the CPI ratio here is 250/100 = 2.5.
      expect(adjusted).toBeGreaterThan(200_000 * 1.5)
      expect(adjusted).toBeCloseTo(200_000 * 2.5, 6)
    },
  )

  it('converts published thousands of kronor (tkr) into whole kronor before adjustment', () => {
    const priceChunk = chunk('BO0501C2', ['0180'], ['2024'], [312]) // 312 tkr as SCB publishes it
    const countChunk = chunk('BO0501C1', ['0180'], ['2024'], [50])
    const flatCpi = new Map([[2024, 100]]) // no adjustment at all: fromYear === targetYear
    const series = buildHousingSeries(
      [municipalities[1]!],
      [priceChunk],
      [countChunk],
      [2024],
      flatCpi,
      HOUSING_MIN_COUNT,
      2024,
    )
    expect(series.values[0]![0]).toBe(312_000)
  })

  it('never silently substitutes the nominal value when the CPI index has no entry for a year — propagates the named throw', () => {
    const priceChunk = chunk('BO0501C2', ['0180'], ['2010'], [200])
    const countChunk = chunk('BO0501C1', ['0180'], ['2010'], [50])
    const thinCpi = new Map([[2024, 250]]) // no entry for 2010
    expect(() =>
      buildHousingSeries(
        [municipalities[1]!],
        [priceChunk],
        [countChunk],
        [2010],
        thinCpi,
        HOUSING_MIN_COUNT,
        2024,
      ),
    ).toThrow(/2010/)
  })

  it(
    'throws its own named guard when the CPI index is completely empty, rather than relying on ' +
      "toCurrentKronor's per-year guard to accidentally cover the same case",
    () => {
      const priceChunk = chunk('BO0501C2', ['0180'], ['2024'], [200])
      const countChunk = chunk('BO0501C1', ['0180'], ['2024'], [50])
      expect(() =>
        buildHousingSeries(
          [municipalities[1]!],
          [priceChunk],
          [countChunk],
          [2024],
          new Map(),
          HOUSING_MIN_COUNT,
        ),
      ).toThrow(/CPI index has no entries/)
    },
  )
})

describe("HOUSING_YEARS: housing's own year range, distinct from population's ctx.years", () => {
  it('runs 1981 through 2025', () => {
    expect(HOUSING_YEARS[0]).toBe(1981)
    expect(HOUSING_YEARS[HOUSING_YEARS.length - 1]).toBe(2025)
  })
})

describe('buildHousingSeries with real frozen SCB data', () => {
  // kitchen/raw/TAB1169/sv/26dfe1200425fa20.json (price, BO0501C2) and
  // .../8cf4dd21235d0808.json (count, BO0501C1): the real production fetch (Steps 3-6 of this
  // task) — all 290 municipalities, Fastighetstyp=['220'], Tid=1981..2025. Verified live
  // against the real API on 2026-09-14: Danderyd (0162, among the highest-price
  // municipalities) reads 151 sales at a mean of 2,615 tkr for 1990; Åsele (2463, one of the
  // lowest) reads 41 sales at a mean of 252 tkr for 1990; Solna (0184) reads only 2 sales for
  // 1990 — below HOUSING_MIN_COUNT — even though a mean price (2,188 tkr) was published for
  // it, so the minimum-count rule must fire there. The real CPI series (kitchen/raw/TAB4352)
  // gives 1990 = 207.8 and 2025 (its own latest year, this indicator's adjustment target) =
  // 417.98.
  const priceChunk = JSON.parse(
    readFileSync('kitchen/raw/TAB1169/sv/26dfe1200425fa20.json', 'utf8'),
  ) as FrozenData
  const countChunk = JSON.parse(
    readFileSync('kitchen/raw/TAB1169/sv/8cf4dd21235d0808.json', 'utf8'),
  ) as FrozenData
  const cpiChunk = JSON.parse(
    readFileSync('kitchen/raw/TAB4352/sv/6b62c2b62aa2de40.json', 'utf8'),
  ) as FrozenData
  const realCpiIndex = new Map<number, number>(
    toRows(cpiChunk.response)
      .filter((row) => row.value !== null)
      .map((row) => [Number(row.dims.Tid), row.value as number]),
  )

  const danderyd: Municipality = {
    code: '0162',
    name: { sv: 'Danderyd', en: 'Danderyd' },
    county: '01',
  }
  const asele: Municipality = { code: '2463', name: { sv: 'Åsele', en: 'Åsele' }, county: '24' }
  const solna: Municipality = { code: '0184', name: { sv: 'Solna', en: 'Solna' }, county: '01' }

  it('reproduces the real, inflation-adjusted 1990 figures for Danderyd (high price) and Åsele (low price)', () => {
    const series = buildHousingSeries(
      [danderyd, asele],
      [priceChunk],
      [countChunk],
      [1990],
      realCpiIndex,
    )
    // Nominal, per SCB: Danderyd 2,615 tkr (2,615,000 kr), Åsele 252 tkr (252,000 kr) — both
    // far below the adjusted figures below, proving the CPI step actually ran.
    expect(series.values[0]![0]).toBeCloseTo(5259950.433108758, 4) // Danderyd
    expect(series.values[1]![0]).toBeCloseTo(506886.23676612123, 4) // Åsele
    expect(series.values[0]![0]!).toBeGreaterThan(2_615_000)
    expect(series.values[1]![0]!).toBeGreaterThan(252_000)
    expect(series.values[0]![0]!).toBeGreaterThan(series.values[1]![0]!)
  })

  it('REQUIRED: nulls and marks too-few-cases the real Solna 1990 cell, which SCB published a price for on only 2 sales', () => {
    const series = buildHousingSeries([solna], [priceChunk], [countChunk], [1990], realCpiIndex)
    expect(OBSERVATION_STATUS[series.status[0]![0]!]).toBe('too-few-cases')
    expect(series.values[0]![0]).toBeNull()
  })

  it('never produces a perturbed status anywhere in the real series (TAB1169 carries no CKM note)', () => {
    const series = buildHousingSeries(
      [danderyd],
      [priceChunk],
      [countChunk],
      HOUSING_YEARS,
      realCpiIndex,
    )
    const statuses = new Set(series.status[0]!.map((s) => OBSERVATION_STATUS[s!]))
    expect(statuses.has('perturbed')).toBe(false)
  })
})
