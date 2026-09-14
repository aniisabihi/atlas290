import { describe, expect, it, vi } from 'vitest'
import {
  cellCount,
  chunkSelection,
  fetchData,
  fetchMetadata,
  fetchMetadataRaw,
  RateLimiter,
  toRequestBody,
  type Selection,
} from './client'

const big: Selection = {
  Region: Array.from({ length: 290 }, (_, i) => String(i).padStart(4, '0')),
  Alder: Array.from({ length: 102 }, (_, i) => String(i)),
  Kon: ['1', '2'],
  Civilstand: ['OG', 'G', 'SK', 'ÄNKL'],
  Tid: Array.from({ length: 57 }, (_, i) => String(1968 + i)),
}

describe('cellCount', () => {
  it('multiplies the value counts of every variable', () => {
    expect(cellCount({ A: ['1', '2'], B: ['x', 'y', 'z'] })).toBe(6)
    expect(cellCount(big)).toBe(290 * 102 * 2 * 4 * 57)
  })
})

describe('chunkSelection', () => {
  it('returns the selection unchanged when under the limit', () => {
    const sel = { A: ['1'], B: ['x', 'y'] }
    expect(chunkSelection(sel, 150_000)).toEqual([sel])
  })

  it('splits the largest variable until every chunk fits, covering every cell exactly once', () => {
    const chunks = chunkSelection(big, 150_000)
    for (const c of chunks) expect(cellCount(c)).toBeLessThanOrEqual(150_000)
    const total = chunks.reduce((n, c) => n + cellCount(c), 0)
    expect(total).toBe(cellCount(big))
    const seenYears = new Set(chunks.flatMap((c) => c.Tid ?? []))
    expect(seenYears.size).toBe(57)
  })
})

describe('RateLimiter', () => {
  it('allows maxCalls immediately then waits for the window', async () => {
    let now = 0
    const sleeps: number[] = []
    const limiter = new RateLimiter(
      3,
      10_000,
      () => now,
      async (ms) => {
        sleeps.push(ms)
        now += ms
      },
    )
    await limiter.acquire()
    await limiter.acquire()
    await limiter.acquire()
    expect(sleeps).toEqual([])
    await limiter.acquire()
    expect(sleeps).toEqual([10_000])
  })
})

describe('toRequestBody', () => {
  it('serialises a selection in v2 shape with sorted variable order', () => {
    expect(toRequestBody({ Tid: ['2024'], Region: ['0180'] })).toEqual({
      selection: [
        { variableCode: 'Region', valueCodes: ['0180'] },
        { variableCode: 'Tid', valueCodes: ['2024'] },
      ],
    })
  })
})

describe('fetch functions', () => {
  it('fetchMetadata parses variables from a JSON-stat2 dimension object', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            id: ['Region', 'Tid'],
            label: 'Folkmängd',
            dimension: {
              Region: {
                label: 'region',
                category: { index: { '0180': 0 }, label: { '0180': 'Stockholm' } },
              },
              Tid: { label: 'år', category: { index: { '2024': 0 }, label: { '2024': '2024' } } },
            },
          }),
          { status: 200 },
        ),
    ) as unknown as typeof fetch
    const meta = await fetchMetadata('TAB638', 'sv', { fetchImpl })
    expect(meta.variables).toEqual([
      { code: 'Region', label: 'region', values: [{ code: '0180', label: 'Stockholm' }] },
      { code: 'Tid', label: 'år', values: [{ code: '2024', label: '2024' }] },
    ])
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://statistikdatabasen.scb.se/api/v2/tables/TAB638/metadata?lang=sv',
      expect.anything(),
    )
  })

  it('fetchMetadataRaw returns the decoded JSON body unparsed', async () => {
    const rawBody = {
      id: ['Region'],
      label: 'Folkmängd',
      dimension: {
        Region: {
          label: 'region',
          category: { index: { '0180': 0 }, label: { '0180': 'Stockholm' } },
        },
      },
    }
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify(rawBody), { status: 200 }),
    ) as unknown as typeof fetch
    await expect(fetchMetadataRaw('TAB638', 'sv', { fetchImpl })).resolves.toEqual(rawBody)
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://statistikdatabasen.scb.se/api/v2/tables/TAB638/metadata?lang=sv',
      expect.anything(),
    )
  })

  it('fetchData POSTs the body and throws on non-2xx with the status in the message', async () => {
    const ok = vi.fn(
      async () => new Response('{"value":[1]}', { status: 200 }),
    ) as unknown as typeof fetch
    await expect(fetchData('TAB638', { Tid: ['2024'] }, 'sv', { fetchImpl: ok })).resolves.toEqual({
      value: [1],
    })
    const call = (ok as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit]
    expect(call[0]).toBe(
      'https://statistikdatabasen.scb.se/api/v2/tables/TAB638/data?lang=sv&outputFormat=json-stat2',
    )
    expect(call[1].method).toBe('POST')
    expect(JSON.parse(call[1].body as string)).toEqual({
      selection: [{ variableCode: 'Tid', valueCodes: ['2024'] }],
    })

    const tooMany = vi.fn(
      async () => new Response('slow down', { status: 429 }),
    ) as unknown as typeof fetch
    await expect(
      fetchData('TAB638', { Tid: ['2024'] }, 'sv', { fetchImpl: tooMany }),
    ).rejects.toThrow(/429/)
  })
})
