import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { OBSERVATION_STATUS, type IndicatorSeries } from '../../../shared/pantry'
import type { TableMeta } from '../scb/client'
import type { FrozenData } from '../scb/freeze'
import { buildPopulationSeries } from './population'
import {
  buildPopulationChangeSeries,
  meanAgeDefined,
  MEAN_AGE_TABLE,
  MEAN_AGE_YEARS,
  share65PlusDefined,
  SHARE_65_TABLE_OLD,
  SHARE_65_TABLE_NEW,
  SHARE_65_YEARS,
} from './derived'
import { selectionFor } from './source'

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

  describe("mean-age's declared source, resolved", () => {
    // Plan 15: was `meanAgeSelection`, deleted with the hand-written builder.
    const resolveMeanAge = (meta: TableMeta) => selectionFor(meta, meanAgeDefined().sources[0]!)

    it("selects the '1+2' Kon total instead of falling through to summing the sexes", () => {
      const sel = resolveMeanAge(fakeMeta())
      expect(sel.Kon).toEqual(['1+2'])
    })

    it('resolves the mean-age ContentsCode by its Swedish label, not a hardcoded code', () => {
      const meta = fakeMeta({
        ContentsCode: [
          { code: 'ZZZ999', label: 'Something else' },
          { code: 'BE0101G9', label: 'Medelålder' },
        ],
      })
      const sel = resolveMeanAge(meta)
      expect(sel.ContentsCode).toEqual(['BE0101G9'])
    })

    it('selects only 4-digit municipality codes from Region, dropping the national/county rows', () => {
      const sel = resolveMeanAge(fakeMeta())
      expect(sel.Region).toEqual(['0330', '0180'])
    })
  })

  describe("MEAN_AGE_YEARS: mean age's own year range, distinct from population's and hardcoded rather than imported", () => {
    it('runs 1998 through 2025', () => {
      expect(MEAN_AGE_YEARS[0]).toBe(1998)
      expect(MEAN_AGE_YEARS[MEAN_AGE_YEARS.length - 1]).toBe(2025)
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

  describe("share-65-plus's TAB638 source, resolved (1968-2024)", () => {
    // Plan 15: was `share65OldSelection`. The age rule is the one ADR-0014 records a bug in —
    // single years from 65 up plus the named open-ended band, never a leading-digit match that
    // would sweep in the aggregate bands and count the same people twice.
    const resolveOld = (meta: TableMeta) =>
      selectionFor(meta, share65PlusDefined().sources[0]!, ['9001', '9002'])

    it('selects only single-year ages 65 and over plus 100+, excluding 64 and the age total', () => {
      const sel = resolveOld(fakeOldMeta())
      expect(sel.Alder).toEqual(['65', '66', '100+'])
    })

    it('falls through to summing the full Kon x Civilstand cross-tab — TAB638 has no total for either, and this is declared safe in SUM_SAFE', () => {
      const sel = resolveOld(fakeOldMeta())
      expect(sel.Kon).toEqual(['1', '2'])
      expect(sel.Civilstand).toEqual(['OG', 'G', 'SK', 'ÄNKL'])
    })

    it('resolves the population ContentsCode by its Swedish label, same as population.ts', () => {
      const sel = resolveOld(fakeOldMeta())
      expect(sel.ContentsCode).toEqual(['BE0101N1'])
    })

    it('selects only four-digit municipality codes from Region', () => {
      const sel = resolveOld(fakeOldMeta())
      expect(sel.Region).toEqual(['9001', '9002'])
    })
  })

  describe("share-65-plus's TAB5557 source, resolved (2025 onwards)", () => {
    // Plan 15: was `share65NewSelection`. TAB638 calls the top band '100+' and TAB5557 calls it
    // '100+1'; that disagreement is data, and each source names its own.
    const resolveNew = (meta: TableMeta) => selectionFor(meta, share65PlusDefined().sources[1]!)

    it('selects only single-year ages 65 and over plus the single-year 100+ code, excluding 64, group codes and every total code', () => {
      const sel = resolveNew(fakeNewMeta())
      expect(sel.Alder).toEqual(['65', '66', '100+1'])
    })

    it("selects the 'TotSa'/'SC' totals directly, never summing the sexes or marital states", () => {
      const sel = resolveNew(fakeNewMeta())
      expect(sel.Kon).toEqual(['TotSa'])
      expect(sel.Civilstand).toEqual(['SC'])
    })

    it('resolves the population ContentsCode by its Swedish label', () => {
      const sel = resolveNew(fakeNewMeta())
      expect(sel.ContentsCode).toEqual(['000007ME'])
    })
  })

  describe("SHARE_65_YEARS: this indicator's own year range, distinct from population's ctx.years and hardcoded rather than imported", () => {
    it('runs 1968 through 2025, the full approved history, not the cheaper 1998 start', () => {
      expect(SHARE_65_YEARS[0]).toBe(1968)
      expect(SHARE_65_YEARS[SHARE_65_YEARS.length - 1]).toBe(2025)
    })
  })
})
