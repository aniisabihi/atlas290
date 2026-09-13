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
})
