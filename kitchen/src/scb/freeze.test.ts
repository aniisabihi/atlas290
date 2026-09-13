import { mkdtempSync, readdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { freezeData, selectionKey } from './freeze'

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

    const second = await freezeData('TAB638', sel, 'sv', { ...opts, clock: () => 'later' })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(second[0]?.fetchedAt).toBe('2026-09-13T10:00:00.000Z')
  })

  it('selectionKey is stable across key order', () => {
    expect(selectionKey({ Tid: ['2024'], Region: ['0180'] })).toBe(
      selectionKey({ Region: ['0180'], Tid: ['2024'] }),
    )
  })
})
