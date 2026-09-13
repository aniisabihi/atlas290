import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { isJsonStat2, toRows } from './jsonstat'

const fixture = JSON.parse(readFileSync('kitchen/fixtures/jsonstat-2x3.json', 'utf8'))

describe('toRows', () => {
  it('walks the value array in row-major order of the id list', () => {
    expect(isJsonStat2(fixture)).toBe(true)
    const rows = toRows(fixture)
    expect(rows).toHaveLength(6)
    expect(rows[0]).toEqual({ dims: { Region: '0180', Tid: '2022' }, value: 978770 })
    expect(rows[2]).toEqual({ dims: { Region: '0180', Tid: '2024' }, value: 990000 })
    expect(rows[3]).toEqual({ dims: { Region: '0380', Tid: '2022' }, value: 237596 })
    expect(rows[5]).toEqual({ dims: { Region: '0380', Tid: '2024' }, value: null })
  })

  it('rejects a dataset whose value length does not match its size', () => {
    expect(() => toRows({ ...fixture, value: [1, 2] })).toThrow(/size/)
  })

  it('orders object-form index by position, not alphabetically', () => {
    // This inline dataset has an index where position order differs from alphabetical order
    // {"0380": 0, "0180": 1} means "0380" is first (position 0), "0180" is second (position 1)
    // If sorted alphabetically, "0180" would come first, causing a silent corruption
    const dataset = {
      id: ['Region'],
      size: [2],
      dimension: {
        Region: {
          category: {
            index: { '0380': 0, '0180': 1 },
          },
        },
      },
      value: [111, 222],
    }
    const rows = toRows(dataset)
    expect(rows[0]).toEqual({ dims: { Region: '0380' }, value: 111 })
    expect(rows[1]).toEqual({ dims: { Region: '0180' }, value: 222 })
  })

  it('rejects null dimension in type guard', () => {
    expect(isJsonStat2({ ...fixture, dimension: null })).toBe(false)
  })

  it('throws when position is out of range for dimension', () => {
    // Crafted to produce a position out of range
    const dataset = {
      id: ['Region'],
      size: [1],
      dimension: {
        Region: {
          category: {
            index: ['0180'],
          },
        },
      },
      value: [111, 222], // Size is 1, but value length is 2
    }
    expect(() => toRows(dataset)).toThrow(/size/)
  })
})
