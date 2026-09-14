import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { OBSERVATION_STATUS, type IndicatorSeries } from '../../../shared/pantry'
import type { FrozenData } from '../scb/freeze'
import { buildPopulationSeries } from './population'
import { buildPopulationChangeSeries } from './derived'

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
