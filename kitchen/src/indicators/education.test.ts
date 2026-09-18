import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { OBSERVATION_STATUS, type Municipality } from '../../../shared/pantry'
import type { TableMeta } from '../scb/client'
import type { FrozenData } from '../scb/freeze'
import { toRows } from '../scb/jsonstat'
import {
  buildEducationSeries,
  EDUCATION_TABLE,
  EDUCATION_YEARS,
  educationDefined,
} from './education'
import { selectionFor } from './source'

const municipalities: Municipality[] = [
  { code: '0330', name: { sv: 'Knivsta', en: 'Knivsta' }, county: '03' }, // created 2002
  { code: '0180', name: { sv: 'Stockholm', en: 'Stockholm' }, county: '01' }, // always existed
]

/** Real TAB3981 label text for every UtbildningsNiva code, confirmed against the table's own
 * live frozen metadata (kitchen/raw/TAB3981/sv/metadata.json) on 2026-09-14. */
const REAL_LEVEL_LABELS: Record<string, string> = {
  '1': 'förgymnasial utbildning kortare än 9 år',
  '2': 'förgymnasial utbildning, 9 (10) år',
  '3': 'gymnasial utbildning, högst 2 år',
  '4': 'gymnasial utbildning, 3 år',
  '5': 'eftergymnasial utbildning, mindre än 3 år',
  '6': 'eftergymnasial utbildning, 3 år eller mer',
  '7': 'forskarutbildning',
  US: 'uppgift om utbildningsnivå saknas',
}

/** Minimal fake TableMeta, mirroring housing.test.ts's/income.test.ts's fakeMeta helper. */
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
    Alder: [{ code: 'tot16-74', label: '16-74 år' }],
    UtbildningsNiva: Object.entries(REAL_LEVEL_LABELS).map(([code, label]) => ({ code, label })),
    Kon: [
      { code: '1', label: 'män' },
      { code: '2', label: 'kvinnor' },
    ],
    ContentsCode: [{ code: 'UF0506A1', label: 'Antal' }],
  }
  const vars = { ...defaults, ...overrides }
  return {
    id: EDUCATION_TABLE,
    label: EDUCATION_TABLE,
    variables: Object.entries(vars).map(([code, values]) => ({ code, label: code, values })),
  }
}

/**
 * Builds a real-shaped JSON-stat2 dataset from an explicit per-dimension code list and a
 * lookup keyed `${region}|${year}|${level}|${kon}` (defaulting to `null` for any combination
 * not listed, mirroring how a real SCB response can carry an explicit null cell), in the SAME
 * id order TAB3981 itself uses (Region, Alder, UtbildningsNiva, Kon, ContentsCode, Tid), with
 * the flat `value` array encoded exactly as `toRows` decodes it (last dimension varies
 * fastest) — built generically here rather than hand-typed, because hand-typing a flat array
 * for a 6-dimensional cube is exactly the kind of arithmetic a test author gets wrong silently.
 */
function buildChunk(
  dimValues: Record<string, string[]>,
  cellValues: Record<string, number | null>,
): FrozenData {
  const id = ['Region', 'Alder', 'UtbildningsNiva', 'Kon', 'ContentsCode', 'Tid']
  const sizes = id.map((d) => dimValues[d]?.length ?? 0)
  const total = sizes.reduce((a, b) => a * b, 1)
  const value: Array<number | null> = new Array(total)

  function rec(dimIdx: number, current: Record<string, string>, flatBase: number): void {
    if (dimIdx === id.length) {
      const key = `${current.Region}|${current.Tid}|${current.UtbildningsNiva}|${current.Kon}`
      value[flatBase] = key in cellValues ? cellValues[key]! : null
      return
    }
    const dim = id[dimIdx]!
    const stride = sizes.slice(dimIdx + 1).reduce((a, b) => a * b, 1)
    ;(dimValues[dim] ?? []).forEach((code, i) => {
      rec(dimIdx + 1, { ...current, [dim]: code }, flatBase + i * stride)
    })
  }
  rec(0, {}, 0)

  return {
    kind: 'data',
    table: EDUCATION_TABLE,
    lang: 'sv',
    url: '',
    selection: dimValues,
    fetchedAt: '2026-09-14T10:00:00.000Z',
    response: {
      id,
      size: sizes,
      dimension: Object.fromEntries(
        id.map((d) => [d, { category: { index: dimValues[d] ?? [] } }]),
      ),
      value,
    },
  }
}

const ALL_LEVELS = ['1', '2', '3', '4', '5', '6', '7', 'US']

describe("post-secondary-education's declared source, resolved", () => {
  // Plan 15: these asserted `educationSelection`, the hand-written builder, until it was
  // deleted. They now assert the declaration the pipeline actually uses, through the shared
  // resolver — same six claims, against the code that runs.
  const KNOWN = ['0330', '0180']
  const resolve = (meta: TableMeta) => selectionFor(meta, educationDefined().sources[0]!, KNOWN)

  it('selects only KNOWN municipality codes from Region, dropping a four-digit Stor-Stockholm-shaped code (trap 1)', () => {
    const sel = resolve(fakeMeta())
    expect([...sel.Region!].sort()).toEqual([...KNOWN].sort())
    expect(sel.Region).not.toContain('0010')
  })

  it("selects the 'tot16-74' age total, not a per-single-year age", () => {
    expect(resolve(fakeMeta()).Alder).toEqual(['tot16-74'])
  })

  it(
    "sums both sexes ('1' and '2') since Kon has no total code on TAB3981 — verified live: " +
      "Kon carries exactly '1' and '2', no total",
    () => {
      expect([...resolve(fakeMeta()).Kon!].sort()).toEqual(['1', '2'])
    },
  )

  it('selects every one of the eight UtbildningsNiva levels, never a subset', () => {
    expect([...resolve(fakeMeta()).UtbildningsNiva!].sort()).toEqual([...ALL_LEVELS].sort())
  })

  it("resolves the ContentsCode by its Swedish label 'Antal', not a hardcoded code", () => {
    const meta = fakeMeta({ ContentsCode: [{ code: 'ZZZ', label: 'Antal' }] })
    expect(resolve(meta).ContentsCode).toEqual(['ZZZ'])
  })

  it(
    "REQUIRED: throws naming UtbildningsNiva when a level's own label has drifted from what " +
      'this indicator assumes level 5 means (post-secondary, under 3 years) — never silently ' +
      'assume the code still means the same thing',
    () => {
      const meta = fakeMeta({
        UtbildningsNiva: Object.entries(REAL_LEVEL_LABELS).map(([code, label]) => ({
          code,
          label: code === '5' ? 'something else entirely' : label,
        })),
      })
      expect(() => resolve(meta)).toThrow(/UtbildningsNiva/)
    },
  )

  it('throws naming UtbildningsNiva when a level code is missing entirely', () => {
    const meta = fakeMeta({
      UtbildningsNiva: Object.entries(REAL_LEVEL_LABELS)
        .filter(([code]) => code !== 'US')
        .map(([code, label]) => ({ code, label })),
    })
    expect(() => resolve(meta)).toThrow(/UtbildningsNiva/)
  })
})

describe('buildEducationSeries', () => {
  const dimValues = {
    Region: ['0180'],
    Alder: ['tot16-74'],
    UtbildningsNiva: ALL_LEVELS,
    Kon: ['1', '2'],
    ContentsCode: ['UF0506A1'],
    Tid: ['2024'],
  }

  it(
    "REQUIRED: computes the share as (levels 5+6+7) / (ALL EIGHT levels, including 'US') — a " +
      'case where the unknown level is non-trivial, so a test that would pass whether or not ' +
      "'US' is in the denominator is impossible here",
    () => {
      // Per sex, so summed totals are double these: level1=50,2=25,3=40,4=35,5=30,6=20,7=5,US=45
      // -> summed over both sexes: 100,50,80,70,60,40,10,90 -> total 500
      const perSex: Record<string, number> = {
        '1': 50,
        '2': 25,
        '3': 40,
        '4': 35,
        '5': 30,
        '6': 20,
        '7': 5,
        US: 45,
      }
      const cellValues: Record<string, number | null> = {}
      for (const level of ALL_LEVELS) {
        for (const kon of ['1', '2']) {
          cellValues[`0180|2024|${level}|${kon}`] = perSex[level]!
        }
      }
      const chunk = buildChunk(dimValues, cellValues)
      const series = buildEducationSeries([municipalities[1]!], [chunk], [2024])
      // numerator = (30+20+5)*2 = 110; denominator (incl. US) = 500 -> 22.0
      // denominator EXCLUDING US would be 410 -> 26.829..., a different number entirely.
      expect(series.values[0]![0]).toBeCloseTo(22.0, 6)
      expect(series.values[0]![0]).not.toBeCloseTo(110 / 410 / 0.01, 3)
      expect(OBSERVATION_STATUS[series.status[0]![0]!]).toBe('present')
    },
  )

  it('marks a year before a municipality existed as did-not-exist, discarding whatever SCB sent', () => {
    const cellValues: Record<string, number | null> = {}
    for (const level of ALL_LEVELS) {
      for (const kon of ['1', '2']) {
        cellValues[`0330|2001|${level}|${kon}`] = 0
        cellValues[`0330|2002|${level}|${kon}`] = 10
      }
    }
    const chunk = buildChunk({ ...dimValues, Region: ['0330'], Tid: ['2001', '2002'] }, cellValues)
    const series = buildEducationSeries([municipalities[0]!], [chunk], [2001, 2002])
    const name = (j: number) => OBSERVATION_STATUS[series.status[0]![j]!]
    expect(name(0)).toBe('did-not-exist')
    expect(series.values[0]![0]).toBeNull()
    expect(name(1)).toBe('present')
  })

  it('marks a year outside the fetched range as not-yet-published, not absent', () => {
    const cellValues: Record<string, number | null> = {}
    for (const level of ALL_LEVELS) {
      for (const kon of ['1', '2']) cellValues[`0180|2024|${level}|${kon}`] = 10
    }
    const chunk = buildChunk({ ...dimValues, Tid: ['2024'] }, cellValues)
    const series = buildEducationSeries([municipalities[1]!], [chunk], [1985, 2024])
    const name = (j: number) => OBSERVATION_STATUS[series.status[0]![j]!]
    expect(name(0)).toBe('not-yet-published')
    expect(series.values[0]![0]).toBeNull()
    expect(name(1)).toBe('present')
  })

  it('nulls the whole cell when one level is missing entirely, rather than computing a share from a partial sum', () => {
    const cellValues: Record<string, number | null> = {}
    for (const level of ALL_LEVELS) {
      if (level === '7') continue // simulate one level never fetched
      for (const kon of ['1', '2']) cellValues[`0180|2024|${level}|${kon}`] = 10
    }
    const chunk = buildChunk(dimValues, cellValues)
    const series = buildEducationSeries([municipalities[1]!], [chunk], [2024])
    expect(series.values[0]![0]).toBeNull()
    expect(OBSERVATION_STATUS[series.status[0]![0]!]).toBe('not-yet-published')
  })

  it('never produces a perturbed status: TAB3981 carries no CKM/perturbation note', () => {
    const cellValues: Record<string, number | null> = {}
    for (const level of ALL_LEVELS) {
      for (const kon of ['1', '2']) cellValues[`0180|2024|${level}|${kon}`] = 10
    }
    const chunk = buildChunk(dimValues, cellValues)
    const series = buildEducationSeries([municipalities[1]!], [chunk], [2024])
    expect(series.status[0]!.map((s) => OBSERVATION_STATUS[s!])).not.toContain('perturbed')
  })
})

describe("EDUCATION_YEARS: education's own year range, distinct from population's ctx.years", () => {
  it('runs 1985 through 2025', () => {
    expect(EDUCATION_YEARS[0]).toBe(1985)
    expect(EDUCATION_YEARS[EDUCATION_YEARS.length - 1]).toBe(2025)
  })
})

describe('buildEducationSeries with real frozen SCB data', () => {
  // kitchen/raw/TAB3981/sv/d6a780b4a40ecc7e.json and .../dea675f08306d256.json: the real
  // production fetch (Steps 3-6 of this task) — all 290 municipalities, every UtbildningsNiva
  // level, both sexes, Alder='tot16-74', Tid=1985..2025 (chunked automatically into these two
  // 145-municipality halves by freezeData, since the full selection is 190,240 cells, over
  // SCB's 150,000-cell limit). Verified live against the real API on 2026-09-14: Danderyd
  // (0162) is the highest 2024 share in the real data (65.28%), Lund (1281) is also high
  // (64.90%), and Filipstad (1782), a rural municipality, is the real LOWEST of all 290
  // (19.29%) — found by scanning every municipality's real 2024 figure, not assumed.
  const chunkA = JSON.parse(
    readFileSync('kitchen/raw/TAB3981/sv/d6a780b4a40ecc7e.json', 'utf8'),
  ) as FrozenData
  const chunkB = JSON.parse(
    readFileSync('kitchen/raw/TAB3981/sv/dea675f08306d256.json', 'utf8'),
  ) as FrozenData

  const danderyd: Municipality = {
    code: '0162',
    name: { sv: 'Danderyd', en: 'Danderyd' },
    county: '01',
  }
  const lund: Municipality = { code: '1281', name: { sv: 'Lund', en: 'Lund' }, county: '12' }
  const filipstad: Municipality = {
    code: '1782',
    name: { sv: 'Filipstad', en: 'Filipstad' },
    county: '17',
  }
  const knivsta: Municipality = {
    code: '0330',
    name: { sv: 'Knivsta', en: 'Knivsta' },
    county: '03',
  }

  it('reproduces the real 2024 post-secondary shares for Danderyd and Lund (both high) against Filipstad (rural, the real lowest of all 290)', () => {
    const series = buildEducationSeries([danderyd, lund, filipstad], [chunkA, chunkB], [2024])
    expect(series.values[0]![0]).toBeCloseTo(65.27777777777779, 6) // Danderyd
    expect(series.values[1]![0]).toBeCloseTo(64.90054102428508, 6) // Lund
    expect(series.values[2]![0]).toBeCloseTo(19.289263665110674, 6) // Filipstad
    expect(series.values[0]![0]!).toBeGreaterThan(series.values[2]![0]!)
    expect(series.values[1]![0]!).toBeGreaterThan(series.values[2]![0]!)
  })

  it("REQUIRED: TAB3981 sends literal 0 (not null) before a municipality existed, matching population (TAB638) rather than income/housing (TAB3554/TAB1169) — confirmed against the real Knivsta cells, and the plain existed(code, y) snapshot gate is what the real data actually needs (not migration/housing's existed(code, y - 1) flow shift)", () => {
    const series = buildEducationSeries([knivsta], [chunkA, chunkB], [2001, 2002])
    const name = (j: number) => OBSERVATION_STATUS[series.status[0]![j]!]
    expect(name(0)).toBe('did-not-exist')
    expect(series.values[0]![0]).toBeNull()
    expect(name(1)).toBe('present')
    expect(series.values[0]![1]).not.toBeNull()
  })

  it('never produces a perturbed status anywhere in the real series (TAB3981 carries no CKM note)', () => {
    const series = buildEducationSeries([danderyd], [chunkA, chunkB], EDUCATION_YEARS)
    const statuses = new Set(series.status[0]!.map((s) => OBSERVATION_STATUS[s!]))
    expect(statuses.has('perturbed')).toBe(false)
  })

  it(
    'REQUIRED: the national aggregate (summed raw counts across all 290 municipalities, 2024) ' +
      "reconciles EXACTLY with SCB's own Riket (whole-country) row fetched directly from the " +
      'same table (kitchen/_scratch_riket.ts, run live 2026-09-14) — proving no double-count ' +
      'and no missing municipality — and demonstrates the denominator decision is not academic: ' +
      "including 'US' gives 41.34%, excluding it gives 42.54%, over a percentage point apart",
    () => {
      const levelTotals: Record<string, number> = {}
      for (const chunk of [chunkA, chunkB]) {
        for (const r of toRows(chunk.response)) {
          if (r.dims.Tid !== '2024' || r.value === null) continue
          levelTotals[r.dims.UtbildningsNiva!] =
            (levelTotals[r.dims.UtbildningsNiva!] ?? 0) + r.value
        }
      }
      // Real SCB Riket ('00') row for 2024, fetched directly (kitchen/_scratch_riket.ts):
      expect(levelTotals).toEqual({
        '1': 185649,
        '2': 954024,
        '3': 1254093,
        '4': 1811141,
        '5': 1171076,
        '6': 1850629,
        '7': 91878,
        US: 213028,
      })
      const numerator = levelTotals['5']! + levelTotals['6']! + levelTotals['7']!
      const denominatorInclUs = ALL_LEVELS.reduce((a, l) => a + (levelTotals[l] ?? 0), 0)
      const denominatorExclUs = denominatorInclUs - levelTotals['US']!
      expect((numerator / denominatorInclUs) * 100).toBeCloseTo(41.34070980113172, 6)
      expect((numerator / denominatorExclUs) * 100).toBeCloseTo(42.544063051257844, 6)
    },
  )
})
