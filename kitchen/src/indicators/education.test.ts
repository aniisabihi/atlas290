import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { TableMeta } from '../scb/client'
import type { FrozenData } from '../scb/freeze'
import { toRows } from '../scb/jsonstat'
import { EDUCATION_TABLE, EDUCATION_YEARS, educationDefined } from './education'
import { selectionFor } from './source'

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

describe("EDUCATION_YEARS: education's own year range, distinct from population's ctx.years", () => {
  it('runs 1985 through 2025', () => {
    expect(EDUCATION_YEARS[0]).toBe(1985)
    expect(EDUCATION_YEARS[EDUCATION_YEARS.length - 1]).toBe(2025)
  })
})

describe("the national aggregate reconciles with SCB's own Riket row", () => {
  // kitchen/raw/TAB3981/sv/d6a780b4a40ecc7e.json and .../dea675f08306d256.json: the real
  // production fetch (Steps 3-6 of this task) — all 290 municipalities, every UtbildningsNiva
  // level, both sexes, Alder='tot16-74', Tid=1985..2025 (chunked automatically into these two
  // 145-municipality halves by freezeData, since the full selection is 190,240 cells, over
  // SCB's 150,000-cell limit).
  //
  // The per-municipality figures this block also asserted moved to
  // src/indicators.semantics.test.ts in plan 15, where they read the published pantry. This one
  // cannot follow them: it sums the RAW chunks and reconciles the total against a row fetched
  // separately from SCB, which is a claim about the fetch rather than about what was published.
  const chunkA = JSON.parse(
    readFileSync('kitchen/raw/TAB3981/sv/d6a780b4a40ecc7e.json', 'utf8'),
  ) as FrozenData
  const chunkB = JSON.parse(
    readFileSync('kitchen/raw/TAB3981/sv/dea675f08306d256.json', 'utf8'),
  ) as FrozenData

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
