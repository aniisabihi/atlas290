import { describe, expect, it } from 'vitest'
import { assertCodesMatch, buildManifest, stableStringify } from './publish'

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
