import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { OBSERVATION_STATUS } from '../../../shared/pantry'
import type { FrozenData, FrozenMeta } from '../scb/freeze'
import { parseMetadata, type TableMeta } from '../scb/client'
import { toRows } from '../scb/jsonstat'
import {
  buildPopulationSeries,
  CKM_FROM,
  fetchPopulation,
  LATEST_YEAR,
  populationSelection,
  quantileBreaks,
  withBreaks,
  POPULATION,
} from './population'

const oldChunk = JSON.parse(
  readFileSync('kitchen/fixtures/population-mini-old.json', 'utf8'),
) as FrozenData
const newChunk = JSON.parse(
  readFileSync('kitchen/fixtures/population-mini-new.json', 'utf8'),
) as FrozenData
const municipalities = [
  { code: '0330', name: { sv: 'Knivsta', en: 'Knivsta' }, county: '03' },
  { code: '0380', name: { sv: 'Uppsala', en: 'Uppsala' }, county: '03' },
]

// NOTE ON YEARS: the task-8 brief's own test used years [2002, 2003, 2025] for this fixture,
// treating 2002 as "before Knivsta existed" and 2003 as "after". That contradicts the
// already-established, empirically verified `existed()` boundary in kitchen/src/municipalities.ts
// (CREATED['0330'] = 2002, verified against real TAB638 data in Task 6/7): year 2002 is the
// FIRST year Knivsta already has real data, per SCB's "administrative division as of next
// 1 January" reporting convention. Using the brief's literal years would make R16's corrected
// status rule report 'not-yet-published' (existed=true, value=null) instead of the brief's
// expected 'did-not-exist' for that cell — a genuine test/registry inconsistency, not just
// R6/R16/R17. Fixed here by shifting the two "old" years to 2001/2002 (one year earlier),
// keeping R6's exact values and arithmetic unchanged, so the not-yet-created/created boundary
// in the test matches the real registry. See task-8-report.md for the full explanation.
const YEARS = [2001, 2002, 2025]

describe('buildPopulationSeries', () => {
  const series = buildPopulationSeries(municipalities, [oldChunk], [newChunk], YEARS)

  it('sums over every dimension except region and year', () => {
    expect(series.values[1]).toEqual([185000, 187000, 238007])
    expect(series.values[0]).toEqual([null, 12200, 20003])
  })

  it('marks statuses: did-not-exist before creation, perturbed from 2025', () => {
    const name = (i: number, j: number) => OBSERVATION_STATUS[series.status[i]![j]!]
    expect(name(0, 0)).toBe('did-not-exist')
    expect(name(0, 1)).toBe('present')
    expect(name(0, 2)).toBe('perturbed')
    expect(name(1, 0)).toBe('present')
  })

  it('keeps rows in municipality order and years in the requested order', () => {
    expect(series.years).toEqual(YEARS)
    expect(series.values).toHaveLength(2)
  })
})

describe('buildPopulationSeries with real SCB data (literal 0, not null, before creation)', () => {
  // Real frozen TAB638 response from the Task 6 spike (kitchen/raw/TAB638/sv/b3f6cdc3a6ab5818.json),
  // already on disk — no network call. Selection: Region 0330/0380, Alder='tot', Kon both,
  // Civilstand all four, ContentsCode BE0101N1, Tid 1998-2005. SCB returns literal 0 (not null)
  // for Knivsta before it existed; ruling R16 requires that 0 be discarded and replaced with
  // null + 'did-not-exist' once existed() says so, regardless of the raw SCB value.
  const realChunk = JSON.parse(
    readFileSync('kitchen/raw/TAB638/sv/b3f6cdc3a6ab5818.json', 'utf8'),
  ) as FrozenData
  const years = [1998, 1999, 2000, 2001, 2002]
  const series = buildPopulationSeries(municipalities, [realChunk], [], years)

  it('discards literal 0 and reports did-not-exist for years before Knivsta existed', () => {
    expect(series.values[0]).toEqual([null, null, null, null, 12586])
    const name = (j: number) => OBSERVATION_STATUS[series.status[0]![j]!]
    expect(name(0)).toBe('did-not-exist')
    expect(name(1)).toBe('did-not-exist')
    expect(name(2)).toBe('did-not-exist')
    expect(name(3)).toBe('did-not-exist')
    expect(name(4)).toBe('present')
  })

  it('leaves Uppsala (which always existed) present throughout, matching the real published totals', () => {
    expect(series.values[1]).toEqual([187302, 188478, 189569, 191110, 179673])
    const name = (j: number) => OBSERVATION_STATUS[series.status[1]![j]!]
    for (let j = 0; j < years.length; j++) expect(name(j)).toBe('present')
  })
})

describe('populationSelection', () => {
  const oldMeta = JSON.parse(
    readFileSync('kitchen/raw/TAB638/sv/metadata.json', 'utf8'),
  ) as FrozenMeta
  const newMeta = JSON.parse(
    readFileSync('kitchen/raw/TAB5557/sv/metadata.json', 'utf8'),
  ) as FrozenMeta

  it('TAB638: uses the tot age code, both sexes and all civil states (no totals exist for those)', () => {
    const meta = parseMetadata('TAB638', oldMeta.response)
    const sel = populationSelection(meta, ['2002'])
    expect(sel.Alder).toEqual(['tot'])
    expect(sel.Kon).toEqual(['1', '2'])
    expect(sel.Civilstand).toEqual(['OG', 'G', 'SK', 'ÄNKL'])
    expect(sel.ContentsCode).toEqual(['BE0101N1'])
  })

  it('TAB5557: uses the TotSA age total, TotSa sex total and SC civil-status total', () => {
    const meta = parseMetadata('TAB5557', newMeta.response)
    const sel = populationSelection(meta, ['2025'])
    expect(sel.Alder).toEqual(['TotSA'])
    expect(sel.Kon).toEqual(['TotSa'])
    expect(sel.Civilstand).toEqual(['SC'])
    expect(sel.ContentsCode).toEqual(['000007ME'])
  })

  it("reproduces SCB's published Stockholm 2025 total of 999,239 from already-frozen real data", () => {
    // kitchen/raw/TAB5557/sv/99c222773be9103a.json: Stockholm 2025, every Alder code, Kon=TotSa,
    // Civilstand=SC, ContentsCode=000007ME — a superset of what populationSelection picks.
    // Filtering it down to exactly the codes populationSelection selects must reproduce SCB's
    // one published figure, proving the selection (not a sum) is correct. R17.
    const stockholmChunk = JSON.parse(
      readFileSync('kitchen/raw/TAB5557/sv/99c222773be9103a.json', 'utf8'),
    ) as FrozenData
    const meta = parseMetadata('TAB5557', newMeta.response)
    const sel = populationSelection(meta, ['2025'])
    const rows = toRows(stockholmChunk.response)
    const match = rows.find(
      (r) =>
        r.dims.Region === '0180' &&
        r.dims.Tid === '2025' &&
        r.dims.Alder === sel.Alder?.[0] &&
        r.dims.Kon === sel.Kon?.[0] &&
        r.dims.Civilstand === sel.Civilstand?.[0],
    )
    expect(match?.value).toBe(999239)
  })

  it('the real 290-municipality production fetch also reads 999,239 for Stockholm 2025', () => {
    // kitchen/raw/TAB5557/sv/ac392dca4f25fab2.json is the actual frozen response from running
    // fetchPopulation() end to end (Step 6): Region=all 290 codes, Alder=['TotSA'], Kon=['TotSa'],
    // Civilstand=['SC'], ContentsCode=['000007ME'], Tid=['2025'] — exactly what populationSelection
    // produces for the full run, not a hand-picked subset. This is the R17-required proof that the
    // real production selection (not a sum) reproduces SCB's published figure.
    const prodChunk = JSON.parse(
      readFileSync('kitchen/raw/TAB5557/sv/ac392dca4f25fab2.json', 'utf8'),
    ) as FrozenData
    const rows = toRows(prodChunk.response)
    const stockholm = rows.find((r) => r.dims.Region === '0180' && r.dims.Tid === '2025')
    expect(stockholm?.value).toBe(999239)

    const series = buildPopulationSeries(
      [{ code: '0180', name: { sv: 'Stockholm', en: 'Stockholm' }, county: '01' }],
      [],
      [prodChunk],
      [2025],
    )
    expect(series.values[0]).toEqual([999239])
    expect(OBSERVATION_STATUS[series.status[0]![0]!]).toBe('perturbed')
  })
})

/** Minimal fake TableMeta for testing populationSelection's guard rails without real SCB JSON. */
function fakeMeta(
  id: string,
  overrides: Record<string, Array<{ code: string; label: string }>>,
): TableMeta {
  const defaults: Record<string, Array<{ code: string; label: string }>> = {
    Region: [{ code: '0001', label: 'Fake municipality' }],
    Alder: [{ code: 'tot', label: 'totalt' }],
    Kon: [{ code: 'TotSa', label: 'totalt' }],
    Civilstand: [{ code: 'SC', label: 'totalt' }],
    ContentsCode: [{ code: 'X1', label: 'Folkmängd' }],
  }
  const vars = { ...defaults, ...overrides }
  return {
    id,
    label: id,
    variables: Object.entries(vars).map(([code, values]) => ({ code, label: code, values })),
  }
}

describe('populationSelection: ContentsCode ambiguity guard (review finding 2)', () => {
  it('throws, naming every matching code, when two ContentsCode values share the population label', () => {
    const meta = fakeMeta('TABFAKE', {
      ContentsCode: [
        { code: 'X1', label: 'Folkmängd' },
        { code: 'X2', label: 'Folkmängd' },
      ],
    })
    expect(() => populationSelection(meta, ['2025'])).toThrow(/X1/)
    expect(() => populationSelection(meta, ['2025'])).toThrow(/X2/)
  })
})

describe('populationSelection: total-code allowlist, not an unguarded sum fallback (review finding 3)', () => {
  it('throws, naming the table and dimension, when a dimension has no recognised total and summing is not declared safe', () => {
    const meta = fakeMeta('TABFAKE', {
      Kon: [
        { code: '1', label: 'män' },
        { code: '2', label: 'kvinnor' },
      ],
    })
    expect(() => populationSelection(meta, ['2025'])).toThrow(/TABFAKE/)
    expect(() => populationSelection(meta, ['2025'])).toThrow(/Kon/)
  })

  it('throws for an unrecognised Civilstand too, not just Kon', () => {
    const meta = fakeMeta('TABFAKE', {
      Civilstand: [
        { code: 'OG', label: 'ogift' },
        { code: 'G', label: 'gift' },
      ],
    })
    expect(() => populationSelection(meta, ['2025'])).toThrow(/TABFAKE/)
    expect(() => populationSelection(meta, ['2025'])).toThrow(/Civilstand/)
  })

  it('still sums TAB638 Kon and Civilstand: they are explicitly declared safe, not a silent fallback', () => {
    const meta = fakeMeta('TAB638', {
      Kon: [
        { code: '1', label: 'män' },
        { code: '2', label: 'kvinnor' },
      ],
      Civilstand: [
        { code: 'OG', label: 'ogift' },
        { code: 'G', label: 'gift' },
        { code: 'SK', label: 'skild' },
        { code: 'ÄNKL', label: 'änka/änkling' },
      ],
    })
    const sel = populationSelection(meta, ['2024'])
    expect(sel.Kon).toEqual(['1', '2'])
    expect(sel.Civilstand).toEqual(['OG', 'G', 'SK', 'ÄNKL'])
  })
})

describe('buildPopulationSeries: mixed null/real subgroups (review finding 4)', () => {
  function chunkWith(value: Array<number | null>): FrozenData {
    return {
      kind: 'data',
      table: 'TAB638',
      lang: 'sv',
      url: '',
      selection: { Region: ['0380'], Kon: ['1', '2'], Tid: ['2010'] },
      fetchedAt: '2026-09-13T10:00:00.000Z',
      response: {
        id: ['Region', 'Kon', 'Tid'],
        size: [1, 2, 1],
        dimension: {
          Region: { category: { index: ['0380'] } },
          Kon: { category: { index: ['1', '2'] } },
          Tid: { category: { index: ['2010'] } },
        },
        value,
      },
    }
  }
  const uppsala = [{ code: '0380', name: { sv: 'Uppsala', en: 'Uppsala' }, county: '03' }]

  it('a partial cell (null seen first, then a real value) resolves to null / not-yet-published, never a partial sum', () => {
    // Old buggy behaviour: `(prev ?? 0) + 93000` treats the earlier null as 0, silently
    // publishing 93000 as if it were the complete total.
    const series = buildPopulationSeries(uppsala, [chunkWith([null, 93000])], [], [2010])
    expect(series.values[0]).toEqual([null])
    expect(OBSERVATION_STATUS[series.status[0]![0]!]).toBe('not-yet-published')
  })

  it('a partial cell (real value seen first, then null) also resolves to null / not-yet-published', () => {
    // Old buggy behaviour: the `if (!totals.has(key))` guard silently drops a null that
    // arrives after a real value was already summed, again publishing a partial total.
    const series = buildPopulationSeries(uppsala, [chunkWith([93000, null])], [], [2010])
    expect(series.values[0]).toEqual([null])
    expect(OBSERVATION_STATUS[series.status[0]![0]!]).toBe('not-yet-published')
  })

  it('a fully real cell (no nulls) still sums normally', () => {
    const series = buildPopulationSeries(uppsala, [chunkWith([93000, 94000])], [], [2010])
    expect(series.values[0]).toEqual([187000])
    expect(OBSERVATION_STATUS[series.status[0]![0]!]).toBe('present')
  })
})

describe('fetchPopulation: returns frozen chunks and metadata for provenance (review finding 1 / ruling R2)', () => {
  it('returns { municipalities, indicator, series, frozen } with frozen = [...oldChunks, ...newChunks, svMeta, enMeta, newMeta]', async () => {
    const oldMetaSv = {
      id: ['Region', 'Civilstand', 'Alder', 'Kon', 'ContentsCode', 'Tid'],
      dimension: {
        Region: { category: { index: ['0180'] } },
        Civilstand: { category: { index: ['OG', 'G'] } },
        Alder: { category: { index: ['tot'] } },
        Kon: { category: { index: ['1', '2'] } },
        ContentsCode: {
          category: {
            index: ['BE0101N1', 'BE0101N2'],
            label: { BE0101N1: 'Folkmängd', BE0101N2: 'Folkökning' },
          },
        },
        Tid: { category: { index: ['2024'] } },
      },
    }
    const oldMetaEn = {
      id: ['Region'],
      dimension: { Region: { category: { index: ['0180'], label: { '0180': 'Stockholm' } } } },
    }
    const newMetaSv = {
      id: ['Region', 'Civilstand', 'Alder', 'Kon', 'ContentsCode', 'Tid'],
      dimension: {
        Region: { category: { index: ['0180'] } },
        Civilstand: { category: { index: ['SC', 'OG', 'G'] } },
        Alder: { category: { index: ['TotSA'] } },
        Kon: { category: { index: ['TotSa'] } },
        ContentsCode: {
          category: {
            index: ['000007ME', '000007MG'],
            label: { '000007ME': 'Folkmängd', '000007MG': 'Folkökning' },
          },
        },
        Tid: { category: { index: ['2025'] } },
      },
    }

    const fetchImpl = vi.fn(async (url: string | URL, init?: RequestInit) => {
      const u = String(url)
      const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 })
      if (init?.method === 'POST') {
        const body = JSON.parse(init.body as string) as {
          selection: Array<{ variableCode: string; valueCodes: string[] }>
        }
        const ids = body.selection.map((s) => s.variableCode)
        const sizes = body.selection.map((s) => s.valueCodes.length)
        const dimension: Record<string, { category: { index: string[] } }> = {}
        for (const s of body.selection)
          dimension[s.variableCode] = { category: { index: s.valueCodes } }
        const total = sizes.reduce((n, s) => n * s, 1)
        return json({
          id: ids,
          size: sizes,
          dimension,
          value: Array.from({ length: total }, () => 100),
        })
      }
      if (u.includes('/TAB638/metadata') && u.includes('lang=sv')) return json(oldMetaSv)
      if (u.includes('/TAB638/metadata') && u.includes('lang=en')) return json(oldMetaEn)
      if (u.includes('/TAB5557/metadata') && u.includes('lang=sv')) return json(newMetaSv)
      throw new Error(`unexpected request: ${init?.method ?? 'GET'} ${u}`)
    })
    const rawDir = mkdtempSync(join(tmpdir(), 'population-raw-'))
    const opts = {
      rawDir,
      deps: { fetchImpl: fetchImpl as unknown as typeof fetch },
      clock: () => '2026-09-13T10:00:00.000Z',
    }

    const result = await fetchPopulation(opts)

    expect(result.municipalities).toHaveLength(1)
    expect(result.frozen).toHaveLength(5)
    expect(result.frozen[0]?.kind).toBe('data')
    expect((result.frozen[0] as FrozenData).table).toBe('TAB638')
    expect(result.frozen[1]?.kind).toBe('data')
    expect((result.frozen[1] as FrozenData).table).toBe('TAB5557')
    expect(result.frozen[2]).toEqual(
      expect.objectContaining({ kind: 'metadata', table: 'TAB638', lang: 'sv' }),
    )
    expect(result.frozen[3]).toEqual(
      expect.objectContaining({ kind: 'metadata', table: 'TAB638', lang: 'en' }),
    )
    expect(result.frozen[4]).toEqual(
      expect.objectContaining({ kind: 'metadata', table: 'TAB5557', lang: 'sv' }),
    )
  })
})

describe('breaks', () => {
  it('quantileBreaks returns classes-1 sorted interior cut points', () => {
    expect(quantileBreaks([1, 2, 3, 4, 5, 6, 7, 8], 4)).toEqual([2.75, 4.5, 6.25])
  })

  it('withBreaks fills the indicator scale from every non-null value', () => {
    const series = buildPopulationSeries(municipalities, [oldChunk], [newChunk], YEARS)
    const ind = withBreaks(POPULATION, series, 3)
    expect(ind.scale.breaks).toHaveLength(2)
    expect(ind.scale.breaks[0]!).toBeLessThan(ind.scale.breaks[1]!)
  })

  it('throws, naming the indicator, when every value is null', () => {
    const nullSeries = buildPopulationSeries(
      [{ code: '0330', name: { sv: 'Knivsta', en: 'Knivsta' }, county: '03' }],
      [],
      [],
      [2001], // before Knivsta existed: 'did-not-exist' everywhere, so no value is non-null
    )
    expect(() => withBreaks(POPULATION, nullSeries)).toThrow(/population/)
  })
})

// Review finding 2: CKM_FROM (first year SCB perturbs) and LATEST_YEAR (newest published
// reference year) used to be the same constant. This pins that the 'perturbed' status split
// is keyed on CKM_FROM alone, and stays correct even when years extend past CKM_FROM the way
// they would once LATEST_YEAR is bumped ahead of it by a future data refresh.
describe('CKM_FROM vs LATEST_YEAR (review finding 2)', () => {
  function chunkFor(year: number, value: number): FrozenData {
    return {
      kind: 'data',
      table: 'TABFAKE',
      lang: 'sv',
      url: '',
      selection: { Region: ['0380'], Tid: [String(year)] },
      fetchedAt: '2026-09-13T10:00:00.000Z',
      response: {
        id: ['Region', 'Tid'],
        size: [1, 1],
        dimension: {
          Region: { category: { index: ['0380'] } },
          Tid: { category: { index: [String(year)] } },
        },
        value: [value],
      },
    }
  }

  it('a year at or after CKM_FROM is perturbed; an earlier one is not, regardless of how far the requested years extend past CKM_FROM', () => {
    const uppsala = [{ code: '0380', name: { sv: 'Uppsala', en: 'Uppsala' }, county: '03' }]
    // Simulates a future refresh where LATEST_YEAR has moved to CKM_FROM + 1 without
    // CKM_FROM itself changing.
    const years = [CKM_FROM - 1, CKM_FROM, CKM_FROM + 1]
    const chunks = years.map((y, i) => chunkFor(y, 100_000 + i))
    const series = buildPopulationSeries(uppsala, chunks, [], years)
    const name = (j: number) => OBSERVATION_STATUS[series.status[0]![j]!]
    expect(name(0)).toBe('present')
    expect(name(1)).toBe('perturbed')
    expect(name(2)).toBe('perturbed')
    expect(LATEST_YEAR).toBeGreaterThanOrEqual(CKM_FROM)
  })
})
