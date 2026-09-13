import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { MunicipalityTopology } from '../../shared/geometry'
import type { buildTopology } from './geometry/build'
import { POPULATION, type fetchPopulation } from './indicators/population'
import { assertCodesMatch, buildManifest, publish, stableStringify } from './publish'

describe('stableStringify', () => {
  it('sorts keys recursively and ends with a newline', () => {
    expect(stableStringify({ b: 1, a: { d: [3, { z: 1, y: 2 }], c: null } })).toBe(
      '{\n  "a": {\n    "c": null,\n    "d": [\n      3,\n      {\n        "y": 2,\n        "z": 1\n      }\n    ]\n  },\n  "b": 1\n}\n',
    )
  })
})

describe('buildManifest', () => {
  it('records one source per frozen data chunk with a sha256 of its response', () => {
    const m = buildManifest([
      {
        kind: 'data',
        table: 'TAB638',
        lang: 'sv',
        url: 'https://statistikdatabasen.scb.se/api/v2/tables/TAB638/data?lang=sv&outputFormat=json-stat2',
        selection: { Tid: ['2024'] },
        fetchedAt: '2026-09-13T10:00:00.000Z',
        response: {
          id: ['Tid'],
          size: [1],
          dimension: { Tid: { category: { index: ['2024'] } } },
          value: [1],
        },
      },
    ])
    expect(m.license).toBe('CC0-1.0')
    expect(m.sources).toHaveLength(1)
    expect(m.sources[0]?.cells).toBe(1)
    expect(m.sources[0]?.sha256).toMatch(/^[0-9a-f]{64}$/)
  })

  it('ignores metadata chunks — only data chunks become sources', () => {
    const m = buildManifest([
      {
        kind: 'metadata',
        table: 'TAB638',
        lang: 'sv',
        url: 'https://statistikdatabasen.scb.se/api/v2/tables/TAB638/metadata?lang=sv',
        fetchedAt: '2026-09-13T10:00:00.000Z',
        response: {},
      },
    ])
    expect(m.sources).toHaveLength(0)
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
  const fakeFetchPopulation: typeof fetchPopulation = async () => ({
    municipalities: [
      { code: '0001', name: { sv: 'A', en: 'A' }, county: '00' },
      { code: '0002', name: { sv: 'B', en: 'B' }, county: '00' },
    ],
    indicator: POPULATION,
    series: {
      indicator: 'population',
      years: [2024],
      values: [[1], [2]],
      status: [[0], [0]],
    },
    frozen: [],
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
          deps: { fetchPopulation: fakeFetchPopulation, buildTopology: fakeBuildTopology },
        }),
      ).rejects.toThrow(/mismatch/)

      expect(existsSync(join(pantryDir, 'geometry/municipalities.topo.json'))).toBe(false)
      expect(existsSync(join(pantryDir, 'geometry/adjacency.json'))).toBe(false)
      expect(existsSync(join(pantryDir, 'layout/bubbles.json'))).toBe(false)
      expect(existsSync(join(pantryDir, 'data/indicators.json'))).toBe(false)
      expect(existsSync(join(pantryDir, 'manifest.json'))).toBe(false)
    } finally {
      rmSync(pantryDir, { recursive: true, force: true })
    }
  })
})
