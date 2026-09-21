import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { MunicipalityTopology } from '../../shared/geometry'
import type { Indicator } from '../../shared/pantry'
import type { buildTopology } from './geometry/build'
import { POPULATION } from './indicators/population'
import type { buildAll } from './indicators/registry'
import {
  assertCodesMatch,
  buildIndicatorSources,
  buildManifest,
  publish,
  roundPantryData,
  stableStringify,
} from './publish'
import { selectionKey as computeSelectionKey } from './scb/freeze'

const fakeGeometrySource = {
  url: 'https://www.scb.se/contentassets/3443fea3fa6640f7a57ea15d9a372d33/shape_svenska_260225.zip',
  filename: 'shape_svenska_260225.zip',
  date: '2026-02-25',
}

describe('stableStringify', () => {
  // Follow-up to Task 13: the published pantry was pretty-printed (2-space indent), which
  // alone cost more than half the file's bytes — a build artifact a browser downloads, not a
  // document a human reads. Minified now: sorted keys still (determinism depends on stable key
  // order), indentation gone, still ending with a newline (kept because a downstream test —
  // this same describe block's second test below — expects the file to end that way).
  it('sorts keys recursively, minifies (no indentation), and ends with a newline', () => {
    expect(stableStringify({ b: 1, a: { d: [3, { z: 1, y: 2 }], c: null } })).toBe(
      '{"a":{"c":null,"d":[3,{"y":2,"z":1}]},"b":1}\n',
    )
  })

  it('never emits a newline inside the JSON itself — only the one trailing byte proves this is minified, not merely "pretty-printed at width 0"', () => {
    const out = stableStringify({ b: 1, a: { d: [3, { z: 1, y: 2 }], c: null } })
    expect(out.slice(0, -1)).not.toContain('\n')
    expect(out.endsWith('\n')).toBe(true)
  })
})

// Follow-up to Task 13: rounding must happen exactly once, at publish() time, matched to each
// series' OWN indicator's declared unit — never a blanket precision applied to every series
// regardless of unit, and never left for buildAll()/check() to see (those must keep full
// precision; round.test.ts covers roundToUnit's own per-unit correctness in isolation).
describe('roundPantryData (this task)', () => {
  const indicator = (id: string, unit: 'percent' | 'sek'): Indicator[] => [
    { ...POPULATION, id, unit, scale: { kind: 'sequential', breaks: [1.005, 2.675] } },
  ]

  it("rounds a series' values to its OWN matching indicator's unit precision", () => {
    const result = roundPantryData(indicator('share-65-plus', 'percent'), [
      {
        indicator: 'share-65-plus',
        years: [2025],
        values: [[40.65499717673631], [null]],
        status: [[0], [1]],
      },
    ])
    expect(result.series[0]?.values).toEqual([[40.65], [null]])
  })

  it("rounds two indicators of DIFFERENT units independently, never applying one unit's precision to the other", () => {
    const result = roundPantryData(
      [...indicator('share-65-plus', 'percent'), ...indicator('median-income', 'sek')],
      [
        { indicator: 'share-65-plus', years: [2025], values: [[40.65499717673631]], status: [[0]] },
        { indicator: 'median-income', years: [2025], values: [[458_705.740093942]], status: [[0]] },
      ],
    )
    expect(result.series[0]?.values).toEqual([[40.65]])
    expect(result.series[1]?.values).toEqual([[458_706]])
  })

  it("rounds an indicator's own colour-scale breaks to its own unit precision (percent: 2 decimals)", () => {
    const result = roundPantryData(indicator('share-65-plus', 'percent'), [])
    // 1.005 and 2.675 rounded via toFixed(2): both land on 1.00 and 2.67, not 1.01/2.68 —
    // because 1.005 and 2.675 are not exactly representable in IEEE 754 double precision (the
    // true stored values are fractionally below each), and toFixed rounds the double's REAL
    // value, not the decimal digits a human typed. Verified directly in node before writing
    // this assertion, not assumed — see round.test.ts's own note on this same trap.
    expect(result.indicators[0]?.scale.breaks).toEqual([1, 2.67])
  })

  it("throws, naming the series, if a series' indicator id has no matching indicator to read a unit from", () => {
    expect(() =>
      roundPantryData([], [{ indicator: 'ghost', years: [], values: [], status: [] }]),
    ).toThrow(/ghost/)
  })
})

describe('buildManifest', () => {
  it('records one source per frozen data chunk with a sha256 of its response, plus its selectionKey and resolved contentCode', () => {
    const m = buildManifest(
      [
        {
          kind: 'data',
          table: 'TAB638',
          lang: 'sv',
          url: 'https://statistikdatabasen.scb.se/api/v2/tables/TAB638/data?lang=sv&outputFormat=json-stat2',
          selection: { Tid: ['2024'], ContentsCode: ['BE0101N1'] },
          fetchedAt: '2026-09-13T10:00:00.000Z',
          response: {
            id: ['Tid'],
            size: [1],
            dimension: { Tid: { category: { index: ['2024'] } } },
            value: [1],
          },
        },
      ],
      fakeGeometrySource,
    )
    expect(m.license).toBe('CC0-1.0')
    expect(m.sources).toHaveLength(1)
    expect(m.sources[0]?.cells).toBe(1)
    expect(m.sources[0]?.sha256).toMatch(/^[0-9a-f]{64}$/)
    expect(m.sources[0]?.contentCodes).toEqual(['BE0101N1'])
    expect(m.sources[0]?.selectionKey).toMatch(/^[0-9a-f]{16}$/)
    expect(m.geometry).toEqual(fakeGeometrySource)
  })

  it('ignores metadata chunks — only data chunks become sources', () => {
    const m = buildManifest(
      [
        {
          kind: 'metadata',
          table: 'TAB638',
          lang: 'sv',
          url: 'https://statistikdatabasen.scb.se/api/v2/tables/TAB638/metadata?lang=sv',
          fetchedAt: '2026-09-13T10:00:00.000Z',
          response: {},
        },
      ],
      fakeGeometrySource,
    )
    expect(m.sources).toHaveLength(0)
  })

  it('throws, naming the table and lang, when a data chunk selection has no single ContentsCode', () => {
    const chunk = {
      kind: 'data' as const,
      table: 'TAB638',
      lang: 'sv' as const,
      url: 'https://statistikdatabasen.scb.se/api/v2/tables/TAB638/data?lang=sv&outputFormat=json-stat2',
      selection: { Tid: ['2024'] },
      fetchedAt: '2026-09-13T10:00:00.000Z',
      response: {
        id: ['Tid'],
        size: [1],
        dimension: { Tid: { category: { index: ['2024'] } } },
        value: [1],
      },
    }
    expect(() => buildManifest([chunk], fakeGeometrySource)).toThrow(/TAB638/)
  })

  it('deduplicates identical table+lang+selection chunks (income and housing each fetch cpi.ts independently)', () => {
    // Same table, lang and selection twice — exactly what happens when two indicators
    // (income, house prices) each call fetchCpi() independently and both hit the same
    // already-frozen file on disk: byte-identical FrozenData objects, not merely equal ones.
    const cpiChunk = {
      kind: 'data' as const,
      table: 'TAB4352',
      lang: 'sv' as const,
      url: 'https://statistikdatabasen.scb.se/api/v2/tables/TAB4352/data?lang=sv&outputFormat=json-stat2',
      selection: { Tid: ['2024'], ContentsCode: ['000000KL'] },
      fetchedAt: '2026-09-13T10:00:00.000Z',
      response: {
        id: ['Tid'],
        size: [1],
        dimension: { Tid: { category: { index: ['2024'] } } },
        value: [329.9],
      },
    }
    const m = buildManifest([cpiChunk, { ...cpiChunk }], fakeGeometrySource)
    expect(m.sources).toHaveLength(1)
  })
})

describe('buildIndicatorSources (Task 13)', () => {
  const chunk = (table: string, contentCode: string, tid: string) => ({
    kind: 'data' as const,
    table,
    lang: 'sv' as const,
    url: `https://statistikdatabasen.scb.se/api/v2/tables/${table}/data?lang=sv&outputFormat=json-stat2`,
    selection: { Tid: [tid], ContentsCode: [contentCode] },
    fetchedAt: '2026-09-13T10:00:00.000Z',
    response: {
      id: ['Tid'],
      size: [1],
      dimension: { Tid: { category: { index: [tid] } } },
      value: [1],
    },
  })

  it("attaches an indicator's own declared (table, contentCode) sources to the frozen chunk(s) its OWN build() call produced, by resolved selectionKey", () => {
    const taxChunk = chunk('TAB2017', 'OE0101D1', '2024')
    const result = buildIndicatorSources(
      [
        {
          ...POPULATION,
          id: 'tax-rate',
          sources: [{ table: 'TAB2017', contentCode: 'OE0101D1', note: '' }],
        },
      ],
      { 'tax-rate': [taxChunk] },
    )
    expect(result['tax-rate']).toEqual([
      {
        table: 'TAB2017',
        contentCode: 'OE0101D1',
        selectionKey: computeSelectionKey(taxChunk.selection),
      },
    ])
  })

  it('gives an indicator with no declared sources an empty array, never an omitted key', () => {
    const result = buildIndicatorSources(
      [{ ...POPULATION, id: 'population-change', sources: [] }],
      { 'population-change': [] },
    )
    expect(result['population-change']).toEqual([])
  })

  it('includes every physical chunk a single declared source resolved to, when SCB chunking split one fetch into several', () => {
    const chunkA = chunk('TAB1169', 'BO0501C2', '2024')
    const chunkB = chunk('TAB1169', 'BO0501C2', '2025')
    const result = buildIndicatorSources(
      [
        {
          ...POPULATION,
          id: 'house-prices',
          sources: [{ table: 'TAB1169', contentCode: 'BO0501C2', note: '' }],
        },
      ],
      { 'house-prices': [chunkA, chunkB] },
    )
    expect(result['house-prices']).toHaveLength(2)
    expect(new Set(result['house-prices']?.map((r) => r.selectionKey))).toEqual(
      new Set([computeSelectionKey(chunkA.selection), computeSelectionKey(chunkB.selection)]),
    )
  })

  it("never attributes one indicator's chunks to another that happens to declare the identical (table, contentCode) pair — the real population/share-65-plus overlap bug this task found and fixed", () => {
    // Population and share-65-plus both genuinely declare TAB638/BE0101N1 as one of their own
    // sources (population fetches the age TOTAL from it; share-65-plus fetches ages 65+ from
    // the same table and content code, via a different Alder selection) — so matching by
    // (table, contentCode) against a SHARED chunk pool cannot tell them apart. Matching
    // against each indicator's OWN per-definition slice (`sourcesByIndicator`) must.
    const populationChunk = chunk('TAB638', 'BE0101N1', '2024')
    const share65Chunk = chunk('TAB638', 'BE0101N1', '2025')
    const sharedSource = { table: 'TAB638', contentCode: 'BE0101N1', note: '' }
    const result = buildIndicatorSources(
      [
        { ...POPULATION, id: 'population', sources: [sharedSource] },
        { ...POPULATION, id: 'share-65-plus', sources: [sharedSource] },
      ],
      { population: [populationChunk], 'share-65-plus': [share65Chunk] },
    )
    expect(result['population']).toEqual([
      {
        table: 'TAB638',
        contentCode: 'BE0101N1',
        selectionKey: computeSelectionKey(populationChunk.selection),
      },
    ])
    expect(result['share-65-plus']).toEqual([
      {
        table: 'TAB638',
        contentCode: 'BE0101N1',
        selectionKey: computeSelectionKey(share65Chunk.selection),
      },
    ])
  })
})

// Ruling R22: the map (geometry codes) and the numbers (statistics codes) are joined by
// four-digit municipality code. A silent mismatch means a municipality is drawn with
// another's data, or drawn with none — so publish() must refuse to write anything unless
// the two code sets are exactly equal, and the error must name counts and codes in both
// directions so a human can act on it.
describe('assertCodesMatch (R22)', () => {
  it('does not throw when the code sets are identical', () => {
    expect(() => assertCodesMatch(['0180', '0181', '0182'], ['0182', '0180', '0181'])).not.toThrow()
  })

  it('throws naming both counts and the codes missing in each direction', () => {
    // geometry has 0001..0003, statistics has 0002..0004: 0001 only in geometry, 0004 only
    // in statistics.
    let error: unknown
    try {
      assertCodesMatch(['0001', '0002', '0003'], ['0002', '0003', '0004'])
    } catch (e) {
      error = e
    }
    expect(error).toBeInstanceOf(Error)
    const message = (error as Error).message
    expect(message).toMatch(/3/) // geometry count
    expect(message).toMatch(/0001/)
    expect(message).toMatch(/0004/)
    expect(message).not.toMatch(/0002/)
    expect(message).not.toMatch(/0003/)
  })

  it('throws when the sets are the same size but disjoint', () => {
    expect(() => assertCodesMatch(['0001', '0002'], ['0003', '0004'])).toThrow(
      /0001.*0002|0002.*0001/s,
    )
  })

  it('throws when one set is a strict subset of the other (same members, different size)', () => {
    expect(() => assertCodesMatch(['0001', '0002', '0003'], ['0001', '0002'])).toThrow(/0003/)
  })
})

// Review finding 1: buildTopology() writes municipalities.topo.json as a side effect of
// running mapshaper, and that write used to happen *before* assertCodesMatch ran — so on a
// genuine code mismatch, publish() threw but left a stale topology file already on disk,
// contradicting R22's "must throw before writing anything" and docs/kitchen.md's claim that
// publish refuses to write anything on a mismatch. Fixed by building the topology into a
// scratch directory first and only copying it into the pantry once the check passes.
describe('publish() writes nothing on a code mismatch (review finding 1)', () => {
  // Task 13: publish() now drives buildAll() (every registered indicator), not
  // fetchPopulation() alone — so this fake takes buildAll's shape instead. Still only two
  // municipalities and a single 'population' series: this test's whole point is the
  // geometry/statistics code mismatch (assertCodesMatch), which throws before check() (also
  // now wired into publish()) ever gets to see this fake's municipality count, so it does not
  // need to satisfy check()'s own 290-municipality rule.
  const fakeBuildAll: typeof buildAll = async () => ({
    municipalities: [
      { code: '0001', name: { sv: 'A', en: 'A' }, county: '00' },
      { code: '0002', name: { sv: 'B', en: 'B' }, county: '00' },
    ],
    indicators: [POPULATION],
    series: [
      {
        indicator: 'population',
        years: [2024],
        values: [[1], [2]],
        status: [[0], [0]],
      },
    ],
    frozen: [],
    sourcesByIndicator: {},
  })

  // Deliberately mismatched against fakeFetchPopulation's codes: '0002' is missing here,
  // '0003' is extra — proves the geometry/statistics equality check, not just a length check.
  const fakeTopology = {
    type: 'Topology',
    arcs: [
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
        [0, 0],
      ],
    ],
    objects: {
      municipalities: {
        type: 'GeometryCollection',
        geometries: [
          { type: 'Polygon', arcs: [[0]], properties: { code: '0001', name: 'A' } },
          { type: 'Polygon', arcs: [[0]], properties: { code: '0003', name: 'C' } },
        ],
      },
      counties: { type: 'GeometryCollection', geometries: [] },
    },
  } as unknown as MunicipalityTopology

  const fakeBuildTopology: typeof buildTopology = async (opts = {}) => {
    // Real buildTopology() writes its outFile as a side effect before returning — the fake
    // reproduces exactly that side effect so this test exercises the real ordering hazard,
    // not a hypothetical one.
    if (opts.outFile) {
      mkdirSync(dirname(opts.outFile), { recursive: true })
      writeFileSync(opts.outFile, JSON.stringify(fakeTopology))
    }
    return fakeTopology
  }

  it('leaves no pantry file on disk — including the topology file itself — when codes mismatch', async () => {
    const pantryDir = mkdtempSync(join(tmpdir(), 'sde-pantry-test-'))
    try {
      await expect(
        publish({
          pantryDir,
          deps: { buildAll: fakeBuildAll, buildTopology: fakeBuildTopology },
        }),
      ).rejects.toThrow(/mismatch/)

      expect(existsSync(join(pantryDir, 'geometry/municipalities.topo.json'))).toBe(false)
      expect(existsSync(join(pantryDir, 'geometry/adjacency.json'))).toBe(false)
      expect(existsSync(join(pantryDir, 'data/index.json'))).toBe(false)
      expect(existsSync(join(pantryDir, 'data/indicators'))).toBe(false)
      expect(existsSync(join(pantryDir, 'manifest.json'))).toBe(false)
    } finally {
      rmSync(pantryDir, { recursive: true, force: true })
    }
  })
})
