import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { OBSERVATION_STATUS } from '../../../shared/pantry'
import type { FrozenData, FrozenMeta } from '../scb/freeze'
import { parseMetadata } from '../scb/client'
import { toRows } from '../scb/jsonstat'
import {
  buildPopulationSeries,
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
})
