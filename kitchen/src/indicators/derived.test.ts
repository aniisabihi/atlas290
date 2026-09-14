import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { OBSERVATION_STATUS, type IndicatorSeries, type Municipality } from '../../../shared/pantry'
import type { TableMeta } from '../scb/client'
import type { FrozenData } from '../scb/freeze'
import { buildPopulationSeries } from './population'
import {
  buildMeanAgeSeries,
  buildPopulationChangeSeries,
  buildShare65PlusSeries,
  MEAN_AGE_TABLE,
  MEAN_AGE_YEARS,
  meanAgeSelection,
  SHARE_65_TABLE_OLD,
  SHARE_65_TABLE_NEW,
  SHARE_65_YEARS,
  share65OldSelection,
  share65NewSelection,
} from './derived'

const name = (series: IndicatorSeries, i: number, j: number) =>
  OBSERVATION_STATUS[series.status[i]![j]!]

describe('buildPopulationChangeSeries: real TAB638 data (Knivsta/Uppsala, the Uppsala split of 2002)', () => {
  // Same real frozen chunk population.test.ts already uses for its own "literal 0, not null"
  // coverage — kitchen/raw/TAB638/sv/b3f6cdc3a6ab5818.json, Region 0330/0380, years 1998-2005 —
  // sliced here to 1998-2002, the five years spanning Uppsala's real 2002 split. No new fixture:
  // this is the same committed real data, read the same way, so the structural-break case below
  // is a real case from the table in the task brief, not a synthetic one.
  const realChunk = JSON.parse(
    readFileSync('kitchen/raw/TAB638/sv/b3f6cdc3a6ab5818.json', 'utf8'),
  ) as FrozenData
  const municipalities = [
    { code: '0330', name: { sv: 'Knivsta', en: 'Knivsta' }, county: '03' },
    { code: '0380', name: { sv: 'Uppsala', en: 'Uppsala' }, county: '03' },
  ]
  const years = [1998, 1999, 2000, 2001, 2002]
  // Real values this produces (confirmed against population.test.ts's own assertions of the
  // same chunk): Knivsta [null, null, null, null, 12586], all did-not-exist except 2002
  // (present); Uppsala [187302, 188478, 189569, 191110, 179673], present throughout — including
  // the real drop from 191110 (2001) to 179673 (2002), a fall of 11,437, exactly the Uppsala row
  // of the task brief's parent-break table.
  const population = buildPopulationSeries(municipalities, [realChunk], [], years)
  const change = buildPopulationChangeSeries(municipalities, population)

  it("the series' first requested year has no previous year, even for a municipality that already existed: null, not-yet-published (Uppsala, 1998)", () => {
    expect(change.values[1]![0]).toBeNull()
    expect(name(change, 1, 0)).toBe('not-yet-published')
  })

  it('a normal year computes the real percentage change (Uppsala, 1998 -> 1999)', () => {
    expect(change.values[1]![1]).toBeCloseTo(((188478 - 187302) / 187302) * 100, 10)
    expect(name(change, 1, 1)).toBe('present')
  })

  it("Uppsala's real 2002 split-year drop is null with status structural-break, not a fabricated -6.0% collapse — the case the task brief names by name", () => {
    // Computed naively, (179673 - 191110) / 191110 * 100 ≈ -5.98%, which is exactly the
    // fabricated "Uppsala collapsed" figure the brief describes and this status exists to
    // prevent. Assert the STATUS, not only that the value is null: a bug that instead reported
    // 'did-not-exist' here (Uppsala's own status, confused with the child's) would still make a
    // loose "value is null" assertion pass.
    expect(change.values[1]![4]).toBeNull()
    expect(name(change, 1, 4)).toBe('structural-break')
    expect(name(change, 1, 4)).not.toBe('did-not-exist')
  })

  it('Knivsta itself, in its own first real year (2002), is null with status did-not-exist — not structural-break, and not a division by its own missing previous year', () => {
    // This is the case docs/plans/2026-09-14-02-the-ten-indicators.md's Task 10 calls out by
    // name as "the case most likely to produce a wrong number": Knivsta's previous year (2001)
    // is itself did-not-exist, so a naive implementation would compute (12586 - null) / null or
    // (12586 - 0) / 0 instead of recognising there is no rate to publish at all.
    expect(change.values[0]![4]).toBeNull()
    expect(name(change, 0, 4)).toBe('did-not-exist')
    expect(name(change, 0, 4)).not.toBe('structural-break')
    expect(name(change, 0, 4)).not.toBe('not-yet-published')
  })

  it('Knivsta before it existed (1999-2001) is did-not-exist throughout, same as population itself', () => {
    for (let j = 1; j <= 3; j++) {
      expect(change.values[0]![j]).toBeNull()
      expect(name(change, 0, j)).toBe('did-not-exist')
    }
  })
})

describe('buildPopulationChangeSeries: synthetic cases the real fixture above does not cover', () => {
  const municipalities = [
    { code: '9001', name: { sv: 'Test A', en: 'Test A' }, county: '99' },
    { code: '9002', name: { sv: 'Test B', en: 'Test B' }, county: '99' },
  ]
  const PRESENT = OBSERVATION_STATUS.indexOf('present')
  const NOT_YET_PUBLISHED = OBSERVATION_STATUS.indexOf('not-yet-published')
  const DID_NOT_EXIST = OBSERVATION_STATUS.indexOf('did-not-exist')
  const PERTURBED = OBSERVATION_STATUS.indexOf('perturbed')

  it('a municipality created mid-series (not Knivsta): its first year has no previous year, null, did-not-exist', () => {
    const population: IndicatorSeries = {
      indicator: 'population',
      years: [2000, 2001, 2002],
      // Test B did not exist until 2002 — a different created-mid-series shape from Knivsta's,
      // to prove this is a general rule, not one that only happens to work for Knivsta's exact
      // fixture.
      values: [
        [1000, 1100, 1210],
        [null, null, 500],
      ],
      status: [
        [PRESENT, PRESENT, PRESENT],
        [DID_NOT_EXIST, DID_NOT_EXIST, PRESENT],
      ],
    }
    const change = buildPopulationChangeSeries(municipalities, population)
    expect(change.values[1]![2]).toBeNull()
    expect(name(change, 1, 2)).toBe('did-not-exist')
  })

  it('a year whose previous value is null (but the municipality already existed) yields null, not-yet-published — not a nonsense percentage from a null denominator', () => {
    const population: IndicatorSeries = {
      indicator: 'population',
      years: [2000, 2001, 2002],
      // Test A existed throughout (present, present, present) but SCB's own figure for 2001 is
      // itself unpublished — a genuine publication gap, never did-not-exist, since the
      // municipality unquestionably existed that year.
      values: [
        [1000, null, 1200],
        [1000, 1100, 1210],
      ],
      status: [
        [PRESENT, NOT_YET_PUBLISHED, PRESENT],
        [PRESENT, PRESENT, PRESENT],
      ],
    }
    const change = buildPopulationChangeSeries(municipalities, population)
    // 2002's own value (1200) is real; only its PREVIOUS year (2001) is null. A bug that read
    // curVal alone, or that computed (1200 - null) as (1200 - 0), would produce a real, wrong
    // number here instead of refusing to publish one.
    expect(change.values[0]![2]).toBeNull()
    expect(name(change, 0, 2)).toBe('not-yet-published')
    expect(name(change, 0, 2)).not.toBe('did-not-exist')
  })

  it("carries the current year's perturbed status onto a real computed change (CKM years)", () => {
    const population: IndicatorSeries = {
      indicator: 'population',
      years: [2024, 2025],
      values: [[1000, 1010]],
      status: [[PRESENT, PERTURBED]],
    }
    const change = buildPopulationChangeSeries([municipalities[0]!], population)
    expect(change.values[0]![1]).toBeCloseTo(1, 10)
    expect(name(change, 0, 1)).toBe('perturbed')
  })
})

describe('mean age (Task 11 of docs/plans/2026-09-14-02-the-ten-indicators.md)', () => {
  const municipalities: Municipality[] = [
    { code: '0330', name: { sv: 'Knivsta', en: 'Knivsta' }, county: '03' }, // created 2002
    { code: '0180', name: { sv: 'Stockholm', en: 'Stockholm' }, county: '01' }, // always existed
  ]

  /** Minimal fake TableMeta mirroring TAB637's real shape: Region, Kon, ContentsCode, Tid. */
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
      ContentsCode: [{ code: 'BE0101G9', label: 'Medelålder' }],
    }
    const vars = { ...defaults, ...overrides }
    return {
      id: MEAN_AGE_TABLE,
      label: MEAN_AGE_TABLE,
      variables: Object.entries(vars).map(([code, values]) => ({ code, label: code, values })),
    }
  }

  /** A minimal Region/Kon/ContentsCode/Tid JSON-stat2 chunk, mirroring the real TAB637 shape. */
  function chunk(region: string[], tid: string[], value: Array<number | null>): FrozenData {
    return {
      kind: 'data',
      table: MEAN_AGE_TABLE,
      lang: 'sv',
      url: '',
      selection: { Region: region, Kon: ['1+2'], ContentsCode: ['BE0101G9'], Tid: tid },
      fetchedAt: '2026-09-14T10:00:00.000Z',
      response: {
        id: ['Region', 'Kon', 'ContentsCode', 'Tid'],
        size: [region.length, 1, 1, tid.length],
        dimension: {
          Region: { category: { index: region } },
          Kon: { category: { index: ['1+2'] } },
          ContentsCode: { category: { index: ['BE0101G9'] } },
          Tid: { category: { index: tid } },
        },
        value,
      },
    }
  }

  describe('meanAgeSelection', () => {
    it("selects the '1+2' Kon total instead of falling through to summing the sexes", () => {
      const sel = meanAgeSelection(fakeMeta(), ['2024'])
      expect(sel.Kon).toEqual(['1+2'])
    })

    it('resolves the mean-age ContentsCode by its Swedish label, not a hardcoded code', () => {
      const meta = fakeMeta({
        ContentsCode: [
          { code: 'ZZZ999', label: 'Something else' },
          { code: 'BE0101G9', label: 'Medelålder' },
        ],
      })
      const sel = meanAgeSelection(meta, ['2024'])
      expect(sel.ContentsCode).toEqual(['BE0101G9'])
    })

    it('selects only 4-digit municipality codes from Region, dropping the national/county rows', () => {
      const sel = meanAgeSelection(fakeMeta(), ['2024'])
      expect(sel.Region).toEqual(['0330', '0180'])
    })
  })

  describe('buildMeanAgeSeries', () => {
    it('marks a year before a municipality existed as did-not-exist, discarding the literal 0 TAB637 sends for it (verified live against the real API 2026-09-14: Region 0330 Tid 1998-2001 = 0, not null)', () => {
      const c = chunk(['0330', '0180'], ['2000', '2002'], [0, 36.1, 40.3, 40.6])
      const series = buildMeanAgeSeries(municipalities, [c], [2000, 2002])
      const cellName = (i: number, j: number) => OBSERVATION_STATUS[series.status[i]![j]!]
      expect(cellName(0, 0)).toBe('did-not-exist')
      expect(series.values[0]![0]).toBeNull()
      expect(cellName(0, 1)).toBe('present')
      expect(series.values[0]![1]).toBe(36.1)
    })

    it('marks a year outside the fetched range as not-yet-published, not absent', () => {
      const c = chunk(['0180'], ['2000'], [40.3])
      const series = buildMeanAgeSeries([municipalities[1]!], [c], [1998, 2000])
      const cellName = (j: number) => OBSERVATION_STATUS[series.status[0]![j]!]
      expect(cellName(0)).toBe('not-yet-published')
      expect(series.values[0]![0]).toBeNull()
      expect(cellName(1)).toBe('present')
    })

    it('a municipality that already existed gets its real mean age with status present, never perturbed — TAB637 carries no Cell Key Method note', () => {
      const c = chunk(['0180'], ['2024', '2025'], [41.2, 41.3])
      const series = buildMeanAgeSeries([municipalities[1]!], [c], [2024, 2025])
      const cellName = (j: number) => OBSERVATION_STATUS[series.status[0]![j]!]
      expect(cellName(0)).toBe('present')
      expect(cellName(1)).toBe('present')
      expect(series.values[0]![1]).toBe(41.3)
    })
  })

  describe("MEAN_AGE_YEARS: mean age's own year range, distinct from population's and hardcoded rather than imported", () => {
    it('runs 1998 through 2025', () => {
      expect(MEAN_AGE_YEARS[0]).toBe(1998)
      expect(MEAN_AGE_YEARS[MEAN_AGE_YEARS.length - 1]).toBe(2025)
    })
  })

  describe('buildMeanAgeSeries with real frozen SCB data (TAB637, all 290 municipalities, 1998-2025)', () => {
    // kitchen/raw/TAB637/sv/58c16831ff51365b.json: the real production fetch (this task's
    // Steps 2-6) — all 290 municipalities, Kon=['1+2'], ContentsCode=['BE0101G9'], Tid=1998..2025.
    // Verified live against the real API on 2026-09-14 (curl, before writing this test): Region
    // 0330 (Knivsta) sends literal 0 for 1998-2001 and its first real value, 36.1, in 2002 —
    // exactly matching CREATED['0330'] = 2002 and the snapshot convention this indicator uses.
    const realChunk = JSON.parse(
      readFileSync('kitchen/raw/TAB637/sv/58c16831ff51365b.json', 'utf8'),
    ) as FrozenData
    const knivsta: Municipality = {
      code: '0330',
      name: { sv: 'Knivsta', en: 'Knivsta' },
      county: '03',
    }
    const borgholm: Municipality = {
      code: '0885',
      name: { sv: 'Borgholm', en: 'Borgholm' },
      county: '08',
    }

    it('reproduces the real 2025 extremes: Borgholm the oldest municipality, Knivsta the youngest (spot-checked against all 290 municipalities on 2026-09-14)', () => {
      const series = buildMeanAgeSeries([knivsta, borgholm], [realChunk], [2025])
      expect(series.values[0]).toEqual([37.8])
      expect(series.values[1]).toEqual([53.3])
    })

    it("discards SCB's own literal 0 for Knivsta's pre-existence years (1998-2001) as did-not-exist, and reads its real first value (36.1) in 2002 as present — the split-year case this indicator's status rule exists to get right", () => {
      const series = buildMeanAgeSeries([knivsta], [realChunk], [1998, 1999, 2000, 2001, 2002])
      const cellName = (j: number) => OBSERVATION_STATUS[series.status[0]![j]!]
      for (let j = 0; j <= 3; j++) {
        expect(cellName(j)).toBe('did-not-exist')
        expect(series.values[0]![j]).toBeNull()
      }
      expect(cellName(4)).toBe('present')
      expect(series.values[0]![4]).toBe(36.1)
    })

    it('never marks a real cell perturbed — TAB637 carries no Cell Key Method note, unlike population/density', () => {
      const series = buildMeanAgeSeries([borgholm], [realChunk], [2024, 2025])
      expect(OBSERVATION_STATUS[series.status[0]![0]!]).toBe('present')
      expect(OBSERVATION_STATUS[series.status[0]![1]!]).toBe('present')
    })
  })
})

describe('share aged 65 and over (Task 11 of docs/plans/2026-09-14-02-the-ten-indicators.md, the share-65+ half)', () => {
  /** Minimal fake TableMeta mirroring TAB638's real shape: Region, Civilstand, Alder, Kon, ContentsCode. */
  function fakeOldMeta(): TableMeta {
    return {
      id: SHARE_65_TABLE_OLD,
      label: SHARE_65_TABLE_OLD,
      variables: [
        {
          code: 'Region',
          label: 'Region',
          values: [
            { code: '9001', label: 'Test A' },
            { code: '9002', label: 'Test B' },
          ],
        },
        {
          code: 'Civilstand',
          label: 'Civilstand',
          values: [
            { code: 'OG', label: 'ogift' },
            { code: 'G', label: 'gift' },
            { code: 'SK', label: 'skild' },
            { code: 'ÄNKL', label: 'änka/änkling' },
          ],
        },
        {
          code: 'Alder',
          label: 'Alder',
          // Mirrors TAB638's real shape: single years '0'..'100+' plus the age total 'tot'.
          values: [
            { code: '63', label: '63 år' },
            { code: '64', label: '64 år' },
            { code: '65', label: '65 år' },
            { code: '66', label: '66 år' },
            { code: '100+', label: '100+ år' },
            { code: 'tot', label: 'totalt ålder' },
          ],
        },
        {
          code: 'Kon',
          label: 'Kon',
          values: [
            { code: '1', label: 'män' },
            { code: '2', label: 'kvinnor' },
          ],
        },
        {
          code: 'ContentsCode',
          label: 'ContentsCode',
          values: [{ code: 'BE0101N1', label: 'Folkmängd' }],
        },
      ],
    }
  }

  /** Minimal fake TableMeta mirroring TAB5557's real shape, verified live 2026-09-14. */
  function fakeNewMeta(): TableMeta {
    return {
      id: SHARE_65_TABLE_NEW,
      label: SHARE_65_TABLE_NEW,
      variables: [
        {
          code: 'Region',
          label: 'Region',
          values: [
            { code: '9001', label: 'Test A' },
            { code: '9002', label: 'Test B' },
          ],
        },
        {
          code: 'Civilstand',
          label: 'Civilstand',
          values: [
            { code: 'OG', label: 'ogift' },
            { code: 'G', label: 'gift' },
            { code: 'SK', label: 'skild' },
            { code: 'ÄNKL', label: 'änka/änkling' },
            { code: 'SC', label: 'totalt, samtliga civilstånd' },
          ],
        },
        {
          code: 'Alder',
          label: 'Alder',
          // Mirrors TAB5557's real shape: single years, group codes, and several distinct
          // total codes — verified live 2026-09-14 against kitchen/raw/TAB5557/sv/metadata.json.
          values: [
            { code: '64', label: '64 år' },
            { code: '65', label: '65 år' },
            { code: '66', label: '66 år' },
            { code: '65-69', label: '65–69 år' },
            { code: '60-69', label: '60–69 år' },
            { code: '100+1', label: '100+ år' },
            { code: '100+5', label: '100+ år' },
            { code: 'TotSA', label: 'totalt, samtliga åldrar' },
            { code: 'TOT1', label: 'totalt, samtliga åldrar' },
          ],
        },
        {
          code: 'Kon',
          label: 'Kon',
          values: [
            { code: '1', label: 'män' },
            { code: '2', label: 'kvinnor' },
            { code: 'TotSa', label: 'totalt, samtliga män och kvinnor' },
          ],
        },
        {
          code: 'ContentsCode',
          label: 'ContentsCode',
          values: [{ code: '000007ME', label: 'Folkmängd' }],
        },
      ],
    }
  }

  describe('share65OldSelection (TAB638, 1968-2024)', () => {
    it('selects only single-year ages 65 and over plus 100+, excluding 64 and the age total', () => {
      const sel = share65OldSelection(fakeOldMeta(), ['9001', '9002'], ['2024'])
      expect(sel.Alder).toEqual(['65', '66', '100+'])
    })

    it('falls through to summing the full Kon x Civilstand cross-tab — TAB638 has no total for either, and this is declared safe in SUM_SAFE', () => {
      const sel = share65OldSelection(fakeOldMeta(), ['9001', '9002'], ['2024'])
      expect(sel.Kon).toEqual(['1', '2'])
      expect(sel.Civilstand).toEqual(['OG', 'G', 'SK', 'ÄNKL'])
    })

    it('resolves the population ContentsCode by its Swedish label, same as population.ts', () => {
      const sel = share65OldSelection(fakeOldMeta(), ['9001', '9002'], ['2024'])
      expect(sel.ContentsCode).toEqual(['BE0101N1'])
    })

    it('selects only four-digit municipality codes from Region', () => {
      const sel = share65OldSelection(fakeOldMeta(), ['9001', '9002'], ['2024'])
      expect(sel.Region).toEqual(['9001', '9002'])
    })
  })

  describe('share65NewSelection (TAB5557, 2025 onwards)', () => {
    it('selects only single-year ages 65 and over plus the single-year 100+ code, excluding 64, group codes and every total code', () => {
      const sel = share65NewSelection(fakeNewMeta(), ['2025'])
      expect(sel.Alder).toEqual(['65', '66', '100+1'])
    })

    it("selects the 'TotSa'/'SC' totals directly, never summing the sexes or marital states", () => {
      const sel = share65NewSelection(fakeNewMeta(), ['2025'])
      expect(sel.Kon).toEqual(['TotSa'])
      expect(sel.Civilstand).toEqual(['SC'])
    })

    it('resolves the population ContentsCode by its Swedish label', () => {
      const sel = share65NewSelection(fakeNewMeta(), ['2025'])
      expect(sel.ContentsCode).toEqual(['000007ME'])
    })
  })

  describe('buildShare65PlusSeries', () => {
    const municipalities: Municipality[] = [
      { code: '9001', name: { sv: 'Test A', en: 'Test A' }, county: '99' },
      { code: '9002', name: { sv: 'Test B', en: 'Test B' }, county: '99' },
      { code: '0330', name: { sv: 'Knivsta', en: 'Knivsta' }, county: '03' }, // created 2002
    ]
    const statusAt = (series: IndicatorSeries, i: number, j: number) =>
      OBSERVATION_STATUS[series.status[i]![j]!]

    // A minimal single-cell Region x Tid JSON-stat2 chunk. sum65PlusByRegionYear only ever
    // reads r.dims.Region/r.dims.Tid off each row (identical to population.ts's/migration.ts's
    // own sumByRegionYear), so the real tables' extra Alder/Kon/Civilstand dimensions are
    // irrelevant to it and safely omitted here — one `cell` call per constituent cross-tab
    // cell mirrors how the real 2x4 (or single-total) cross-tab arrives as several rows
    // sharing the same (Region, Tid) key, which this helper must sum rather than overwrite.
    function cell(table: string, region: string, year: string, value: number | null): FrozenData {
      return {
        kind: 'data',
        table,
        lang: 'sv',
        url: '',
        selection: {},
        fetchedAt: '2026-09-14T10:00:00.000Z',
        response: {
          id: ['Region', 'Tid'],
          size: [1, 1],
          dimension: {
            Region: { category: { index: [region] } },
            Tid: { category: { index: [year] } },
          },
          value: [value],
        },
      }
    }
    function population(
      years: number[],
      rows: Array<{ code: string; values: Array<number | null>; status: string[] }>,
    ): IndicatorSeries {
      return {
        indicator: 'population',
        years,
        values: rows.map((r) => r.values),
        status: rows.map((r) => r.status.map((s) => OBSERVATION_STATUS.indexOf(s as never))),
      }
    }

    it('hand-worked: sums the full 65+ cross-tab (8 cells, values of 5 each = 40) against a real population, both years, both tables', () => {
      // Test A, 2000 (TAB638-era): eight cross-tab cells (Alder 65,66 x Kon 1,2 x Civilstand
      // OG,G), each 5, sum to 40. Population 400 -> share 40/400*100 = 10%.
      // Test A, 2025 (TAB5557-era, totals already collapsed): two Alder cells (65, 66) at 25
      // each, sum to 50. Population 500 -> share 50/500*100 = 10%, same rate, different table.
      const oldChunks = [
        cell(SHARE_65_TABLE_OLD, '9001', '2000', 5),
        cell(SHARE_65_TABLE_OLD, '9001', '2000', 5),
        cell(SHARE_65_TABLE_OLD, '9001', '2000', 5),
        cell(SHARE_65_TABLE_OLD, '9001', '2000', 5),
        cell(SHARE_65_TABLE_OLD, '9001', '2000', 5),
        cell(SHARE_65_TABLE_OLD, '9001', '2000', 5),
        cell(SHARE_65_TABLE_OLD, '9001', '2000', 5),
        cell(SHARE_65_TABLE_OLD, '9001', '2000', 5),
      ]
      const newChunks = [
        cell(SHARE_65_TABLE_NEW, '9001', '2025', 25),
        cell(SHARE_65_TABLE_NEW, '9001', '2025', 25),
      ]
      const pop = population(
        [2000, 2025],
        [
          { code: '9001', values: [400, 500], status: ['present', 'perturbed'] },
          {
            code: '9002',
            values: [null, null],
            status: ['not-yet-published', 'not-yet-published'],
          },
          { code: '0330', values: [null, null], status: ['did-not-exist', 'did-not-exist'] },
        ],
      )
      const series = buildShare65PlusSeries(municipalities, oldChunks, newChunks, [2000, 2025], pop)
      expect(series.values[0]![0]).toBeCloseTo(10, 10)
      expect(statusAt(series, 0, 0)).toBe('present')
      expect(series.values[0]![1]).toBeCloseTo(10, 10)
      expect(statusAt(series, 0, 1)).toBe('perturbed')
    })

    it("marks a year before a municipality existed as did-not-exist, discarding TAB638's literal 0 rather than computing a false 0% or 0/0", () => {
      // Knivsta (0330) did not exist until 2002; TAB638 sends literal 0 for its pre-existence
      // years, exactly like population's own 'Folkmängd' cells. Feeding a nonzero 65+ count for
      // 2000 here deliberately, so a bug that read the value before checking existed() would
      // publish a wrong percentage instead of null/did-not-exist.
      const oldChunks = [cell(SHARE_65_TABLE_OLD, '0330', '2000', 999)]
      const pop = population(
        [2000],
        [
          { code: '9001', values: [null], status: ['not-yet-published'] },
          { code: '9002', values: [null], status: ['not-yet-published'] },
          { code: '0330', values: [null], status: ['did-not-exist'] },
        ],
      )
      const series = buildShare65PlusSeries(municipalities, oldChunks, [], [2000], pop)
      expect(series.values[2]![0]).toBeNull()
      expect(statusAt(series, 2, 0)).toBe('did-not-exist')
    })

    it('a missing 65+ count (not fetched / not yet published) yields null, not-yet-published — never treated as zero', () => {
      const pop = population(
        [2000],
        [
          { code: '9001', values: [400], status: ['present'] },
          { code: '9002', values: [null], status: ['not-yet-published'] },
          { code: '0330', values: [null], status: ['did-not-exist'] },
        ],
      )
      const series = buildShare65PlusSeries(municipalities, [], [], [2000], pop)
      expect(series.values[0]![0]).toBeNull()
      expect(statusAt(series, 0, 0)).toBe('not-yet-published')
    })

    it('a null population denominator yields a null share, not a division by zero or null', () => {
      const oldChunks = [cell(SHARE_65_TABLE_OLD, '9001', '2000', 40)]
      const pop = population(
        [2000],
        [
          { code: '9001', values: [null], status: ['not-yet-published'] },
          { code: '9002', values: [null], status: ['not-yet-published'] },
          { code: '0330', values: [null], status: ['did-not-exist'] },
        ],
      )
      const series = buildShare65PlusSeries(municipalities, oldChunks, [], [2000], pop)
      expect(series.values[0]![0]).toBeNull()
      expect(statusAt(series, 0, 0)).toBe('not-yet-published')
    })
  })

  describe("SHARE_65_YEARS: this indicator's own year range, distinct from population's ctx.years and hardcoded rather than imported", () => {
    it('runs 1968 through 2025, the full approved history, not the cheaper 1998 start', () => {
      expect(SHARE_65_YEARS[0]).toBe(1968)
      expect(SHARE_65_YEARS[SHARE_65_YEARS.length - 1]).toBe(2025)
    })
  })

  describe('buildShare65PlusSeries with real frozen SCB data (TAB638, all 290 municipalities, 2024)', () => {
    // kitchen/raw/TAB638/sv/32d7d058409c75aa.json: the Task 2 spike's own real frozen chunk
    // (docs/kitchen.md's "828,022 B for 2024" measurement) — all 290 municipalities, single-year
    // ages 65 through 100+ (36 codes), the full Kon(1,2) x Civilstand(OG,G,SK,ÄNKL) cross-tab,
    // 2024 only. Its selection is exactly what share65OldSelection produces for a single year,
    // so this is the real production fetch shape, not a synthetic stand-in. Population figures
    // and hand-summed 65+ counts below were extracted from this same committed chunk plus the
    // real (already-frozen) population series on 2026-09-14, before writing these assertions:
    // Stockholm (0180) sums to 162,879 of 995,574 (16.360310735314503%), Borgholm (0885) — the
    // real oldest municipality by this measure — to 4,222 of 10,666 (39.58372398274892%), and
    // Knivsta (0330, created 2002) to 2,939 of 21,193 (13.867786533289294%).
    const realChunk = JSON.parse(
      readFileSync('kitchen/raw/TAB638/sv/32d7d058409c75aa.json', 'utf8'),
    ) as FrozenData
    const stockholm: Municipality = {
      code: '0180',
      name: { sv: 'Stockholm', en: 'Stockholm' },
      county: '01',
    }
    const borgholm: Municipality = {
      code: '0885',
      name: { sv: 'Borgholm', en: 'Borgholm' },
      county: '08',
    }
    const knivsta: Municipality = {
      code: '0330',
      name: { sv: 'Knivsta', en: 'Knivsta' },
      county: '03',
    }
    const pop2024: IndicatorSeries = {
      indicator: 'population',
      years: [2024],
      values: [[995574], [10666], [21193]],
      status: [
        [OBSERVATION_STATUS.indexOf('present')],
        [OBSERVATION_STATUS.indexOf('present')],
        [OBSERVATION_STATUS.indexOf('present')],
      ],
    }

    it('reproduces the real 2024 share for Stockholm, hand-summed from the real chunk (162,879 / 995,574)', () => {
      const series = buildShare65PlusSeries([stockholm], [realChunk], [], [2024], {
        ...pop2024,
        values: [pop2024.values[0]!],
        status: [pop2024.status[0]!],
      })
      expect(series.values[0]![0]).toBeCloseTo(16.360310735314503, 10)
      expect(OBSERVATION_STATUS[series.status[0]![0]!]).toBe('present')
    })

    it('reproduces the real 2024 extreme: Borgholm, the real oldest municipality by this measure (4,222 / 10,666)', () => {
      const series = buildShare65PlusSeries([borgholm], [realChunk], [], [2024], {
        ...pop2024,
        values: [pop2024.values[1]!],
        status: [pop2024.status[1]!],
      })
      expect(series.values[0]![0]).toBeCloseTo(39.58372398274892, 10)
    })

    it('sums the real full 2x4 sex/marital-status cross-tab correctly for a split municipality still gated by existed() (Knivsta, 2,939 / 21,193)', () => {
      const series = buildShare65PlusSeries([knivsta], [realChunk], [], [2024], {
        ...pop2024,
        values: [pop2024.values[2]!],
        status: [pop2024.status[2]!],
      })
      expect(series.values[0]![0]).toBeCloseTo(13.867786533289294, 10)
      expect(OBSERVATION_STATUS[series.status[0]![0]!]).toBe('present')
    })
  })
})
