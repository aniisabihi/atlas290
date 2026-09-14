import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { OBSERVATION_STATUS, type IndicatorSeries, type Municipality } from '../../../shared/pantry'
import type { TableMeta } from '../scb/client'
import type { FrozenData } from '../scb/freeze'
import {
  buildMigrationSeries,
  migrationSelection,
  MIGRATION_TABLE_OLD,
  MIGRATION_TABLE_MID,
  MIGRATION_TABLE_NEW,
  MIGRATION_YEARS,
} from './migration'

const knivsta: Municipality = { code: '0330', name: { sv: 'Knivsta', en: 'Knivsta' }, county: '03' } // created 2002 (population), real migration only from 2003
const stockholm: Municipality = {
  code: '0180',
  name: { sv: 'Stockholm', en: 'Stockholm' },
  county: '01',
}

/** Minimal fake TableMeta, mirroring tax.test.ts's/density.test.ts's fakeMeta helper. */
function fakeMeta(
  table: string,
  overrides: Record<string, Array<{ code: string; label: string }>> = {},
): TableMeta {
  const defaults: Record<string, Array<{ code: string; label: string }>> = {
    Region: [
      { code: '00', label: 'Riket' },
      { code: '0010', label: 'Stor-Stockholm' },
      { code: '0020', label: 'Stor-Göteborg' },
      { code: '0030', label: 'Stor-Malmö' },
      { code: '0330', label: 'Knivsta' },
      { code: '0180', label: 'Stockholm' },
    ],
    Alder: [
      { code: '0', label: '0 år' },
      { code: 'tot', label: 'totalt ålder' },
    ],
    Kon: [
      { code: '1', label: 'män' },
      { code: '2', label: 'kvinnor' },
    ],
    ContentsCode: [{ code: 'BE0101C5', label: 'Flyttningsöverskott' }],
  }
  const vars = { ...defaults, ...overrides }
  return {
    id: table,
    label: table,
    variables: Object.entries(vars).map(([code, values]) => ({ code, label: code, values })),
  }
}

/** A minimal Region/Alder/Kon/ContentsCode/Tid JSON-stat2 chunk, mirroring the real tables' shape. */
function chunk(
  table: string,
  contentCode: string,
  region: string[],
  kon: string[],
  tid: string[],
  value: Array<number | null>,
): FrozenData {
  return {
    kind: 'data',
    table,
    lang: 'sv',
    url: '',
    selection: { Region: region, Alder: ['tot'], Kon: kon, ContentsCode: [contentCode], Tid: tid },
    fetchedAt: '2026-09-14T10:00:00.000Z',
    response: {
      id: ['Region', 'Alder', 'Kon', 'ContentsCode', 'Tid'],
      size: [region.length, 1, kon.length, 1, tid.length],
      dimension: {
        Region: { category: { index: region } },
        Alder: { category: { index: ['tot'] } },
        Kon: { category: { index: kon } },
        ContentsCode: { category: { index: [contentCode] } },
        Tid: { category: { index: tid } },
      },
      value,
    },
  }
}

/** A minimal population IndicatorSeries fixture, rows aligned with `municipalities` above. */
function populationFixture(years: number[], values: Array<Array<number | null>>): IndicatorSeries {
  return {
    indicator: 'population',
    years,
    values,
    status: values.map((row) => row.map((v) => (v === null ? 1 : 0))),
  }
}

describe('migrationSelection', () => {
  it("resolves the ContentsCode by its Swedish label 'Flyttningsöverskott', not a hardcoded code", () => {
    const meta = fakeMeta(MIGRATION_TABLE_OLD, {
      ContentsCode: [{ code: 'ZZZ999', label: 'Flyttningsöverskott' }],
    })
    const sel = migrationSelection(meta, ['0330', '0180'], ['2024'])
    expect(sel.ContentsCode).toEqual(['ZZZ999'])
  })

  it('throws naming the label when no ContentsCode carries it (label drift, not silently taking the wrong code)', () => {
    const meta = fakeMeta(MIGRATION_TABLE_OLD, {
      ContentsCode: [{ code: 'X', label: 'Something else' }],
    })
    expect(() => migrationSelection(meta, ['0330', '0180'], ['2024'])).toThrow(
      /Flyttningsöverskott/,
    )
  })

  it('selects only KNOWN municipality codes from Region, dropping Stor-Stockholm/Göteborg/Malmö even though they are four digits too (trap 1, also verified on TAB6640)', () => {
    const sel = migrationSelection(fakeMeta(MIGRATION_TABLE_MID), ['0330', '0180'], ['2024'])
    expect(sel.Region).toEqual(['0330', '0180'])
    expect(sel.Region).not.toContain('0010')
    expect(sel.Region).not.toContain('0020')
    expect(sel.Region).not.toContain('0030')
  })

  it('drops a known municipality code the table itself does not offer, rather than requesting a value that would fail (TAB1211 pre-1998-renumbering gap)', () => {
    // 0330 (Knivsta) is a real, current municipality code, but is simply absent from this
    // fixture's Region list — standing in for TAB1211's real 49 renamed-municipality gap.
    const meta = fakeMeta(MIGRATION_TABLE_OLD, {
      Region: [
        { code: '00', label: 'Riket' },
        { code: '0180', label: 'Stockholm' },
      ],
    })
    const sel = migrationSelection(meta, ['0330', '0180'], ['1990'])
    expect(sel.Region).toEqual(['0180'])
  })

  it('sums the two sexes when the table has no Kon total, rather than throwing or picking one (TAB1211/TAB1212 via SUM_SAFE)', () => {
    const sel = migrationSelection(fakeMeta(MIGRATION_TABLE_OLD), ['0330', '0180'], ['2024'])
    expect(sel.Kon).toEqual(['1', '2'])
  })

  it("selects the 'TotSa' sex total directly when the table has one (TAB6640), instead of summing", () => {
    const meta = fakeMeta(MIGRATION_TABLE_NEW, {
      Kon: [
        { code: 'TotSa', label: 'totalt, samtliga män och kvinnor' },
        { code: '1', label: 'män' },
        { code: '2', label: 'kvinnor' },
      ],
      ContentsCode: [{ code: '00000868', label: 'Flyttningsöverskott' }],
    })
    const sel = migrationSelection(meta, ['0330', '0180'], ['2025'])
    expect(sel.Kon).toEqual(['TotSa'])
  })

  it("resolves the age total by label ('tot'), not by array position", () => {
    const sel = migrationSelection(fakeMeta(MIGRATION_TABLE_OLD), ['0330', '0180'], ['2024'])
    expect(sel.Alder).toEqual(['tot'])
  })
})

describe('buildMigrationSeries', () => {
  it('stitches all three tables into one continuous series covering the whole range', () => {
    // Stockholm: a value in each of the three tables' own year ranges.
    const oldChunk = chunk(
      MIGRATION_TABLE_OLD,
      'BE0101C5',
      ['0180'],
      ['1', '2'],
      ['1990'],
      [4000, 3800],
    )
    const midChunk = chunk(
      MIGRATION_TABLE_MID,
      'BE0101AZ',
      ['0180'],
      ['1', '2'],
      ['2010'],
      [3000, 2600],
    )
    const newChunk = chunk(
      MIGRATION_TABLE_NEW,
      '00000868',
      ['0180'],
      ['1', '2'],
      ['2025'],
      [900, 890],
    )
    const population = populationFixture([1990, 2010, 2025], [[800000, 850000, 999239]])
    const series = buildMigrationSeries(
      [stockholm],
      [oldChunk],
      [midChunk],
      [newChunk],
      [1990, 2010, 2025],
      population,
    )
    const name = (j: number) => OBSERVATION_STATUS[series.status[0]![j]!]
    expect(name(0)).toBe('present') // from TAB1211
    expect(name(1)).toBe('present') // from TAB1212
    expect(name(2)).toBe('perturbed') // from TAB6640, 2025 = CKM_FROM
    expect(series.values[0]![0]).not.toBeNull()
    expect(series.values[0]![1]).not.toBeNull()
    expect(series.values[0]![2]).not.toBeNull()
  })

  it("computes the rate against THAT SAME YEAR's population, not any other year's", () => {
    // Net migration count 7800 (1+2 summed) against two different population fixtures for the
    // same year, to prove the year actually used is 2010's population, not 1990's.
    const c = chunk(MIGRATION_TABLE_MID, 'BE0101AZ', ['0180'], ['1', '2'], ['2010'], [4000, 3800])
    const population = populationFixture([1990, 2010], [[999999, 780000]])
    const series = buildMigrationSeries([stockholm], [], [c], [], [1990, 2010], population)
    // 7800 / 780000 * 1000 = 10
    expect(series.values[0]![1]).toBeCloseTo(10, 10)
  })

  it('yields a null rate — not a division by zero — when that year has no population figure', () => {
    const c = chunk(MIGRATION_TABLE_MID, 'BE0101AZ', ['0180'], ['1', '2'], ['2010'], [4000, 3800])
    // population fixture simply has no 2010 column: the year is entirely absent.
    const population = populationFixture([1990], [[999999]])
    const series = buildMigrationSeries([stockholm], [], [c], [], [2010], population)
    expect(series.values[0]![0]).toBeNull()
    expect(Number.isFinite(series.values[0]![0])).toBe(false)
    const name = OBSERVATION_STATUS[series.status[0]![0]!]
    expect(name).toBe('not-yet-published')
  })

  it('yields a null rate when the population cell itself is null for that year (not-yet-published upstream)', () => {
    const c = chunk(MIGRATION_TABLE_MID, 'BE0101AZ', ['0180'], ['1', '2'], ['2010'], [4000, 3800])
    const population = populationFixture([2010], [[null]])
    const series = buildMigrationSeries([stockholm], [], [c], [], [2010], population)
    expect(series.values[0]![0]).toBeNull()
    expect(OBSERVATION_STATUS[series.status[0]![0]!]).toBe('not-yet-published')
  })

  it(
    'marks a pre-existence year as did-not-exist even though SCB returns literal 0 for it, ' +
      "using migration's OWN (one-year-later) existence boundary rather than population's",
    () => {
      // Knivsta: population's CREATED year is 2002, but real migration data starts 2003 (see
      // migration.ts's migrationExisted doc comment) — 2002 must still read did-not-exist here,
      // even though population's own existed('0330', 2002) is true and SCB literally sent 0.
      const c = chunk(
        MIGRATION_TABLE_MID,
        'BE0101AZ',
        ['0330'],
        ['1', '2'],
        ['2002', '2003'],
        [0, 62, 0, 56],
      )
      const population = populationFixture([2002, 2003], [[12586, 13000]])
      const series = buildMigrationSeries([knivsta], [], [c], [], [2002, 2003], population)
      const name = (j: number) => OBSERVATION_STATUS[series.status[0]![j]!]
      expect(name(0)).toBe('did-not-exist')
      expect(series.values[0]![0]).toBeNull()
      expect(name(1)).toBe('present')
      expect(series.values[0]![1]).not.toBeNull()
      // (0 + 62 + 56) not summed with the discarded pre-existence cell: 2003 uses only 2003's
      // own count (62 + 56 = 118) against 2003's population (13000): 118/13000*1000.
      expect(series.values[0]![1]).toBeCloseTo(((62 + 56) / 13000) * 1000, 10)
    },
  )

  it('marks a genuinely pre-existence year the SAME WAY for a municipality that always existed vs one that did not, proving the gate is per-municipality', () => {
    const c = chunk(
      MIGRATION_TABLE_MID,
      'BE0101AZ',
      ['0330', '0180'],
      ['1', '2'],
      ['2002'],
      [0, 0, 1000, 900],
    )
    const population = populationFixture([2002], [[12586], [800000]])
    const series = buildMigrationSeries([knivsta, stockholm], [], [c], [], [2002], population)
    expect(OBSERVATION_STATUS[series.status[0]![0]!]).toBe('did-not-exist')
    expect(OBSERVATION_STATUS[series.status[1]![0]!]).toBe('present')
  })
})

describe("MIGRATION_YEARS: migration's own year range, distinct from population's ctx.years", () => {
  it('runs 1968 through 2025', () => {
    expect(MIGRATION_YEARS[0]).toBe(1968)
    expect(MIGRATION_YEARS[MIGRATION_YEARS.length - 1]).toBe(2025)
  })
})

describe('buildMigrationSeries with real frozen SCB data', () => {
  // The real production fetch (Steps 5/6 of this task): all 290 municipalities, ContentsCode
  // resolved by label, Tid covering each table's own range. Real population figures below are
  // from the already-committed, already-frozen TAB638/TAB5557 chunks (via fetchPopulation()),
  // verified live against the real API on 2026-09-14.
  const oldChunk = JSON.parse(
    readFileSync('kitchen/raw/TAB1211/sv/4a353213441d5701.json', 'utf8'),
  ) as FrozenData
  const midChunk = JSON.parse(
    readFileSync('kitchen/raw/TAB1212/sv/3f8d122adcf4bbf5.json', 'utf8'),
  ) as FrozenData
  const newChunk = JSON.parse(
    readFileSync('kitchen/raw/TAB6640/sv/afdd445e7ceffe7a.json', 'utf8'),
  ) as FrozenData
  const knivstaReal: Municipality = {
    code: '0330',
    name: { sv: 'Knivsta', en: 'Knivsta' },
    county: '03',
  }
  const pajala: Municipality = { code: '2521', name: { sv: 'Pajala', en: 'Pajala' }, county: '25' }
  // Real population figures (fetchPopulation(), already-frozen TAB638/TAB5557).
  const population = populationFixture(
    [2002, 2003, 2024, 2025],
    [
      [12586, 12821, 21193, 21733], // Knivsta
      [7206, 7053, 5857, 5706], // Pajala
    ],
  )

  it('reproduces the real, fast-growing Knivsta net-migration rate for 2024 and 2025', () => {
    const series = buildMigrationSeries(
      [knivstaReal, pajala],
      [oldChunk],
      [midChunk],
      [newChunk],
      [2002, 2003, 2024, 2025],
      population,
    )
    expect(series.values[0]![2]).toBeCloseTo(16.23177464257066, 9) // 2024, present
    expect(series.values[0]![3]).toBeCloseTo(19.463488703814477, 9) // 2025, perturbed (CKM)
    expect(OBSERVATION_STATUS[series.status[0]![2]!]).toBe('present')
    expect(OBSERVATION_STATUS[series.status[0]![3]!]).toBe('perturbed')
  })

  it('reproduces the real, shrinking Pajala net-migration rate for 2025 (population itself fell every year 2015-2025)', () => {
    const series = buildMigrationSeries(
      [knivstaReal, pajala],
      [oldChunk],
      [midChunk],
      [newChunk],
      [2002, 2003, 2024, 2025],
      population,
    )
    expect(series.values[1]![3]).toBeCloseTo(-15.247108307045217, 9) // 2025: net out-migration
    expect(OBSERVATION_STATUS[series.status[1]![3]!]).toBe('perturbed')
  })

  it("marks Knivsta's 2002 cell did-not-exist even in the real data, one year later than population's own CREATED boundary", () => {
    const series = buildMigrationSeries(
      [knivstaReal],
      [oldChunk],
      [midChunk],
      [newChunk],
      [2002, 2003],
      populationFixture([2002, 2003], [[12586, 12821]]),
    )
    expect(OBSERVATION_STATUS[series.status[0]![0]!]).toBe('did-not-exist')
    expect(series.values[0]![0]).toBeNull()
    expect(OBSERVATION_STATUS[series.status[0]![1]!]).toBe('present')
    expect(series.values[0]![1]).not.toBeNull()
  })

  it('reads Borås (renamed by the 1998 county mergers) as not-yet-published before 1997, present from 1997 onward', () => {
    const boras: Municipality = { code: '1490', name: { sv: 'Borås', en: 'Borås' }, county: '14' }
    const series = buildMigrationSeries(
      [boras],
      [oldChunk],
      [midChunk],
      [newChunk],
      [1990, 2000],
      populationFixture([1990, 2000], [[95000, 96000]]),
    )
    expect(OBSERVATION_STATUS[series.status[0]![0]!]).toBe('not-yet-published')
    expect(series.values[0]![0]).toBeNull()
    expect(OBSERVATION_STATUS[series.status[0]![1]!]).toBe('present')
    expect(series.values[0]![1]).not.toBeNull()
  })
})
