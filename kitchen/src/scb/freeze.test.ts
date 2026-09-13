import { mkdtempSync, readdirSync, readFileSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { freezeData, freezeMetadata, selectionKey } from './freeze'

const dataset = {
  id: ['Region', 'Tid'],
  size: [1, 1],
  dimension: { Region: { category: { index: ['0180'] } }, Tid: { category: { index: ['2024'] } } },
  value: [984748],
}

describe('freezeData', () => {
  it('fetches once, writes one file per chunk, and reuses files on the second run', async () => {
    const rawDir = mkdtempSync(join(tmpdir(), 'raw-'))
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(dataset), { status: 200 }))
    const opts = {
      rawDir,
      deps: { fetchImpl: fetchImpl as unknown as typeof fetch },
      clock: () => '2026-09-13T10:00:00.000Z',
    }
    const sel = { Region: ['0180'], Tid: ['2024'] }

    const first = await freezeData('TAB638', sel, 'sv', opts)
    expect(first).toHaveLength(1)
    expect(first[0]?.fetchedAt).toBe('2026-09-13T10:00:00.000Z')
    expect(first[0]?.response.value).toEqual([984748])
    expect(fetchImpl).toHaveBeenCalledTimes(1)

    const files = readdirSync(join(rawDir, 'TAB638', 'sv'))
    expect(files).toEqual([`${selectionKey(sel)}.json`])
    const onDisk = JSON.parse(readFileSync(join(rawDir, 'TAB638', 'sv', files[0]!), 'utf8'))
    expect(onDisk.kind).toBe('data')
    expect(onDisk.url).toContain('/tables/TAB638/data')
    // The bytes on disk must be the exact raw body the fetch returned, not a filtered
    // or reshaped subset of it.
    expect(onDisk.response).toEqual(dataset)

    const second = await freezeData('TAB638', sel, 'sv', { ...opts, clock: () => 'later' })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(second[0]?.fetchedAt).toBe('2026-09-13T10:00:00.000Z')
  })

  it('selectionKey is stable across key order', () => {
    expect(selectionKey({ Tid: ['2024'], Region: ['0180'] })).toBe(
      selectionKey({ Region: ['0180'], Tid: ['2024'] }),
    )
  })

  it('re-fetches only the chunk whose cached file is missing, not every chunk', async () => {
    const rawDir = mkdtempSync(join(tmpdir(), 'raw-'))
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(dataset), { status: 200 }))
    const opts = {
      rawDir,
      deps: { fetchImpl: fetchImpl as unknown as typeof fetch },
      clock: () => '2026-09-13T10:00:00.000Z',
    }
    // 400 x 400 = 160,000 cells, over SCB_MAX_CELLS (150,000), so chunkSelection must
    // split this into more than one chunk.
    const bigSel = {
      Region: Array.from({ length: 400 }, (_, i) => String(i).padStart(4, '0')),
      Tid: Array.from({ length: 400 }, (_, i) => String(2000 + i)),
    }

    const first = await freezeData('TAB999', bigSel, 'sv', opts)
    expect(first.length).toBeGreaterThan(1)
    expect(fetchImpl).toHaveBeenCalledTimes(first.length)

    const dir = join(rawDir, 'TAB999', 'sv')
    const files = readdirSync(dir)
    expect(files).toHaveLength(first.length)
    unlinkSync(join(dir, files[0]!))

    const before = fetchImpl.mock.calls.length
    await freezeData('TAB999', bigSel, 'sv', opts)
    const additionalFetches = fetchImpl.mock.calls.length - before

    expect(
      additionalFetches,
      `expected exactly 1 additional fetch after deleting 1 of ${first.length} cached files, got ${additionalFetches}`,
    ).toBe(1)
  })
})

describe('freezeMetadata', () => {
  const metadataBody = {
    id: ['Region'],
    label: 'Fake table',
    dimension: {
      Region: { label: 'Region', category: { index: ['0180'], label: { '0180': 'Stockholm' } } },
    },
  }

  it('calls fetchMetadataRaw once, stores the raw body unparsed, and reuses the file on a second run', async () => {
    const rawDir = mkdtempSync(join(tmpdir(), 'raw-'))
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(metadataBody), { status: 200 }))
    const opts = {
      rawDir,
      deps: { fetchImpl: fetchImpl as unknown as typeof fetch },
      clock: () => '2026-09-13T10:00:00.000Z',
    }

    const first = await freezeMetadata('TAB638', 'sv', opts)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(first.kind).toBe('metadata')
    expect(first.fetchedAt).toBe('2026-09-13T10:00:00.000Z')
    // The stored response must be the raw JSON-stat2 body (it still has `dimension`),
    // not the parsed TableMeta shape that `fetchMetadata`/`parseMetadata` would produce
    // (which has `variables` instead of `dimension`).
    expect(first.response).toEqual(metadataBody)
    expect(first.response).toHaveProperty('dimension')
    expect(first.response).not.toHaveProperty('variables')

    const path = join(rawDir, 'TAB638', 'sv', 'metadata.json')
    const onDisk = JSON.parse(readFileSync(path, 'utf8'))
    expect(onDisk.response).toEqual(metadataBody)

    const second = await freezeMetadata('TAB638', 'sv', { ...opts, clock: () => 'later' })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(second.fetchedAt).toBe('2026-09-13T10:00:00.000Z')
  })
})
