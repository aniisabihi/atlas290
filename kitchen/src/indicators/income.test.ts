import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { OBSERVATION_STATUS } from '../../../shared/pantry'
import type { TableMeta } from '../scb/client'
import type { FrozenData } from '../scb/freeze'
import { toRows } from '../scb/jsonstat'
import { buildIncomeSeries, INCOME_TABLE, INCOME_YEARS, incomeSelection } from './income'

const municipalities = [
  { code: '0330', name: { sv: 'Knivsta', en: 'Knivsta' }, county: '03' }, // created 2002
  { code: '0180', name: { sv: 'Stockholm', en: 'Stockholm' }, county: '01' }, // always existed
]

/** Minimal fake TableMeta, mirroring tax.test.ts's/density.test.ts's fakeMeta helper. */
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
    Kon: [
      { code: '1', label: 'män' },
      { code: '2', label: 'kvinnor' },
      { code: '1+2', label: 'totalt' },
    ],
    Alder: [
      { code: '16-19', label: '16–19 år' },
      { code: 'tot16+', label: 'totalt 16+ år' },
    ],
    Inkomstklass: [
      { code: '0', label: '0' },
      { code: 'TOT', label: 'totalt' },
    ],
    ContentsCode: [{ code: 'HE0110J8', label: 'Medianinkomst, tkr' }],
  }
  const vars = { ...defaults, ...overrides }
  return {
    id: INCOME_TABLE,
    label: INCOME_TABLE,
    variables: Object.entries(vars).map(([code, values]) => ({ code, label: code, values })),
  }
}

/** A minimal Region/Kon/Alder/Inkomstklass/ContentsCode/Tid JSON-stat2 chunk, real TAB3554 shape. */
function chunk(region: string[], tid: string[], value: Array<number | null>): FrozenData {
  return {
    kind: 'data',
    table: INCOME_TABLE,
    lang: 'sv',
    url: '',
    selection: {
      Region: region,
      Kon: ['1+2'],
      Alder: ['tot16+'],
      Inkomstklass: ['TOT'],
      ContentsCode: ['HE0110J8'],
      Tid: tid,
    },
    fetchedAt: '2026-09-14T10:00:00.000Z',
    response: {
      id: ['Region', 'Kon', 'Alder', 'Inkomstklass', 'ContentsCode', 'Tid'],
      size: [region.length, 1, 1, 1, 1, tid.length],
      dimension: {
        Region: { category: { index: region } },
        Kon: { category: { index: ['1+2'] } },
        Alder: { category: { index: ['tot16+'] } },
        Inkomstklass: { category: { index: ['TOT'] } },
        ContentsCode: { category: { index: ['HE0110J8'] } },
        Tid: { category: { index: tid } },
      },
      value,
    },
  }
}

describe('incomeSelection', () => {
  it("resolves the ContentsCode by its Swedish label 'Medianinkomst, tkr', not a hardcoded HE0110J8", () => {
    const meta = fakeMeta({ ContentsCode: [{ code: 'ZZZ999', label: 'Medianinkomst, tkr' }] })
    const sel = incomeSelection(meta, ['0330', '0180'], ['2024'])
    expect(sel.ContentsCode).toEqual(['ZZZ999'])
  })

  it('throws naming the label when no ContentsCode carries it (label drift, not silently taking the wrong code)', () => {
    const meta = fakeMeta({ ContentsCode: [{ code: 'X', label: 'Something else' }] })
    expect(() => incomeSelection(meta, ['0330', '0180'], ['2024'])).toThrow(/Medianinkomst, tkr/)
  })

  it("selects the 'tot16+' age total, not any other age code, and not summing", () => {
    const sel = incomeSelection(fakeMeta(), ['0330', '0180'], ['2024'])
    expect(sel.Alder).toEqual(['tot16+'])
  })

  it('throws naming the Alder dimension when the table offers no recognised age total (never silently summing a median)', () => {
    const meta = fakeMeta({ Alder: [{ code: '16-19', label: '16–19 år' }] })
    expect(() => incomeSelection(meta, ['0330', '0180'], ['2024'])).toThrow(
      /dimension Alder has no recognised total code/,
    )
  })

  it("selects the '1+2' sex total, not any other Kon code", () => {
    const sel = incomeSelection(fakeMeta(), ['0330', '0180'], ['2024'])
    expect(sel.Kon).toEqual(['1+2'])
  })

  it("selects the 'TOT' income-class total, not any single bracket", () => {
    const sel = incomeSelection(fakeMeta(), ['0330', '0180'], ['2024'])
    expect(sel.Inkomstklass).toEqual(['TOT'])
  })

  it('throws naming the Inkomstklass dimension when the table offers no recognised total (distinct wording from the Alder guard, so a loose match on one cannot hide a break in the other)', () => {
    const meta = fakeMeta({ Inkomstklass: [{ code: '0', label: '0' }] })
    expect(() => incomeSelection(meta, ['0330', '0180'], ['2024'])).toThrow(
      /dimension Inkomstklass has no recognised total code/,
    )
  })

  it('selects only KNOWN municipality codes from Region, dropping a four-digit Stor-Stockholm-shaped code even though it is four digits too (trap 1)', () => {
    const sel = incomeSelection(fakeMeta(), ['0330', '0180'], ['2024'])
    expect(sel.Region).toEqual(['0330', '0180'])
    expect(sel.Region).not.toContain('0010')
  })

  it('drops a known municipality code the table itself does not offer, rather than requesting a value that would fail', () => {
    const meta = fakeMeta({
      Region: [
        { code: '00', label: 'Riket' },
        { code: '0180', label: 'Stockholm' },
      ],
    })
    const sel = incomeSelection(meta, ['0330', '0180'], ['2024'])
    expect(sel.Region).toEqual(['0180'])
  })
})

describe('buildIncomeSeries', () => {
  // A CPI index that genuinely moves, so the required inflation-adjustment test can tell a
  // regression apart from a no-op: 1999 = 100 (arbitrary base for this fixture), 2024 = 250.
  const cpi = new Map([
    [1999, 100],
    [2024, 250],
  ])

  it('marks a year before a municipality existed as did-not-exist, discarding whatever SCB sent (SCB sends literal 0, not null)', () => {
    const c = chunk(['0330', '0180'], ['1999', '2024'], [0, 150, 200, 300])
    const series = buildIncomeSeries(municipalities, [c], [1999, 2024], cpi, 2024)
    const name = (i: number, j: number) => OBSERVATION_STATUS[series.status[i]![j]!]
    expect(name(0, 0)).toBe('did-not-exist')
    expect(series.values[0]![0]).toBeNull()
    expect(name(0, 1)).toBe('present') // Knivsta existed by 2024
  })

  it('marks a year outside the fetched range as not-yet-published, not absent, for a municipality that always existed', () => {
    // The chunk simply has no 1999 cell; both 1999 and 2024 (the year actually fetched) are
    // years the fixture CPI index above covers, so only the fetch gap is under test here.
    const c = chunk(['0180'], ['2024'], [300])
    const series = buildIncomeSeries([municipalities[1]!], [c], [1999, 2024], cpi, 2024)
    const name = (j: number) => OBSERVATION_STATUS[series.status[0]![j]!]
    expect(name(0)).toBe('not-yet-published')
    expect(series.values[0]![0]).toBeNull()
    expect(name(1)).toBe('present')
  })

  it('never carries a perturbed status — TAB3554 has no CKM/perturbation note', () => {
    const c = chunk(['0180'], ['2024'], [300])
    const series = buildIncomeSeries([municipalities[1]!], [c], [2024], cpi, 2024)
    expect(OBSERVATION_STATUS[series.status[0]![0]!]).toBe('present')
  })

  it(
    "REQUIRED: an early year's inflation-adjusted value is meaningfully higher than its nominal " +
      'value, so a regression that silently dropped the CPI adjustment fails',
    () => {
      const c = chunk(['0180'], ['1999'], [200]) // 200 tkr nominal, published 1999
      const series = buildIncomeSeries([municipalities[1]!], [c], [1999], cpi, 2024)
      const adjusted = series.values[0]![0]!
      // Nominal (in real kronor, ×1000 per the tkr->kr conversion) would be 200_000; the CPI
      // ratio here is 250/100 = 2.5, so the adjusted figure must be far above the nominal one,
      // not merely "some number" — a no-op regression would leave it at 200_000 exactly.
      expect(adjusted).toBeGreaterThan(200_000 * 1.5)
      expect(adjusted).toBeCloseTo(200_000 * 2.5, 6)
    },
  )

  it('never silently substitutes the nominal value when the CPI index has no entry for a year — propagates the named throw', () => {
    const c = chunk(['0180'], ['2010'], [200])
    const thinCpi = new Map([[2024, 250]]) // no entry for 2010
    expect(() => buildIncomeSeries([municipalities[1]!], [c], [2010], thinCpi, 2024)).toThrow(
      /2010/,
    )
  })

  it(
    'throws its own named guard when the CPI index is completely empty, rather than relying on ' +
      "toCurrentKronor's per-year guard to accidentally cover the same case " +
      '(deliberately distinguishable from the per-year throw above by wording, not just by ' +
      'both containing "no entry")',
    () => {
      const c = chunk(['0180'], ['2024'], [200])
      // No explicit targetYear here: an empty index must be caught by buildIncomeSeries' own
      // default-parameter guard, not merely produce whatever toCurrentKronor throws once an
      // explicit (or derived) target year happens to be supplied.
      expect(() => buildIncomeSeries([municipalities[1]!], [c], [2024], new Map())).toThrow(
        /CPI index has no entries/,
      )
    },
  )

  it('converts published thousands of kronor (tkr) into whole kronor before adjustment', () => {
    const c = chunk(['0180'], ['2024'], [312]) // 312 tkr as SCB publishes it
    const flatCpi = new Map([[2024, 100]]) // no adjustment at all: fromYear === targetYear
    const series = buildIncomeSeries([municipalities[1]!], [c], [2024], flatCpi, 2024)
    expect(series.values[0]![0]).toBe(312_000)
  })
})

describe("INCOME_YEARS: income's own year range, distinct from population's ctx.years", () => {
  it('runs 1999 through 2024', () => {
    expect(INCOME_YEARS[0]).toBe(1999)
    expect(INCOME_YEARS[INCOME_YEARS.length - 1]).toBe(2024)
  })
})

describe('buildIncomeSeries with real frozen SCB data', () => {
  // kitchen/raw/TAB3554/sv/474d0f391fc1c46f.json: the real production fetch (Steps 2-6 of this
  // task) — all 290 municipalities, Kon=['1+2'], Alder=['tot16+'], Inkomstklass=['TOT'],
  // Tid=1999..2024. And the already-frozen real TAB4352 CPI series (Task 4), read the same way
  // cpi.ts's own test does. Verified live against the real API on 2026-09-14: Danderyd (0162,
  // among the highest) reads 209.6 tkr nominal for 1999 and 455.6 tkr for 2024; Högsby (0821,
  // the lowest-median municipality in the real 2024 data — found by scanning every
  // municipality's 2024 figure, not assumed) reads 140.6 tkr nominal for 1999. The real CPI
  // series (kitchen/raw/TAB4352) gives 1999 = 258.1 and 2025 (its own latest year, which is
  // also this indicator's inflation-adjustment target) = 417.98.
  const incomeChunk = JSON.parse(
    readFileSync('kitchen/raw/TAB3554/sv/474d0f391fc1c46f.json', 'utf8'),
  ) as FrozenData
  const cpiChunk = JSON.parse(
    readFileSync('kitchen/raw/TAB4352/sv/6b62c2b62aa2de40.json', 'utf8'),
  ) as FrozenData
  // Same extraction cpi.ts's own fetchCpi does internally: this chunk has only a Tid
  // dimension (plus a single-value ContentsCode), so toRows yields one row per year.
  const realCpiIndex = new Map<number, number>(
    toRows(cpiChunk.response)
      .filter((row) => row.value !== null)
      .map((row) => [Number(row.dims.Tid), row.value as number]),
  )

  const danderyd = { code: '0162', name: { sv: 'Danderyd', en: 'Danderyd' }, county: '01' }
  const hogsby = { code: '0821', name: { sv: 'Högsby', en: 'Högsby' }, county: '08' }
  const knivstaReal = { code: '0330', name: { sv: 'Knivsta', en: 'Knivsta' }, county: '03' }

  it('reproduces the real, inflation-adjusted 1999 figures for Danderyd (among the highest) and Högsby (the real lowest), meaningfully above their nominal tkr values', () => {
    const series = buildIncomeSeries([danderyd, hogsby], [incomeChunk], [1999], realCpiIndex)
    // Nominal, per SCB: Danderyd 209.6 tkr, Högsby 140.6 tkr — both far below the adjusted
    // figures below, proving the CPI step actually ran rather than passing the nominal value
    // straight through disguised as thousands-to-kronor conversion alone (209.6 * 1000 =
    // 209_600, nowhere near 339_436).
    expect(series.values[0]![0]).toBeCloseTo(339436.6834560248, 6) // Danderyd
    expect(series.values[1]![0]).toBeCloseTo(227694.64548624563, 6) // Högsby
    expect(series.values[0]![0]!).toBeGreaterThan(209_600)
    expect(series.values[1]![0]!).toBeGreaterThan(140_600)
    // Danderyd (among the highest-income municipalities) clears Högsby (the real lowest) by a
    // wide margin, in both nominal and adjusted terms.
    expect(series.values[0]![0]!).toBeGreaterThan(series.values[1]![0]!)
  })

  it("marks Knivsta's pre-2002 cells did-not-exist using the SAME existed() gate as population/tax/density (no migration-style one-year shift), matching the real data: TAB3554 itself already returns null (not a literal 0, unlike TAB638) for 1999-2001, so this gate governs the STATUS label, not the nulling itself", () => {
    const series = buildIncomeSeries(
      [knivstaReal],
      [incomeChunk],
      [1999, 2001, 2002, 2003],
      realCpiIndex,
    )
    const name = (j: number) => OBSERVATION_STATUS[series.status[0]![j]!]
    expect(name(0)).toBe('did-not-exist')
    expect(name(1)).toBe('did-not-exist')
    expect(series.values[0]![0]).toBeNull()
    expect(series.values[0]![1]).toBeNull()
    expect(name(2)).toBe('present')
    expect(series.values[0]![2]).not.toBeNull()
    expect(name(3)).toBe('present')
  })

  it('never produces a perturbed status anywhere in the real series (TAB3554 carries no CKM note)', () => {
    const series = buildIncomeSeries([danderyd], [incomeChunk], INCOME_YEARS, realCpiIndex)
    const statuses = new Set(series.status[0]!.map((s) => OBSERVATION_STATUS[s!]))
    expect(statuses.has('perturbed')).toBe(false)
  })
})
