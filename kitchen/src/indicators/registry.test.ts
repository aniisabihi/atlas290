import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { Indicator, IndicatorSeries, Municipality } from '../../../shared/pantry'
import { buildAll, REGISTRY, type BuildContext, type IndicatorDefinition } from './registry'

/**
 * Minimal fake SCB backend covering exactly what the real REGISTRY (population, for now)
 * needs: TAB638 (sv+en metadata, data) and TAB5557 (sv metadata, data), for one municipality.
 * Adapted from population.test.ts's fetchPopulation fake — this proves buildAll() drives the
 * real registered definition(s) end to end, not a stand-in.
 */
const oldMetaSv = {
  id: ['Region', 'Civilstand', 'Alder', 'Kon', 'ContentsCode', 'Tid'],
  dimension: {
    Region: { category: { index: ['0180'] } },
    Civilstand: { category: { index: ['OG', 'G'] } },
    Alder: { category: { index: ['tot'] } },
    Kon: { category: { index: ['1', '2'] } },
    ContentsCode: {
      category: { index: ['BE0101N1'], label: { BE0101N1: 'Folkmängd' } },
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
      category: { index: ['000007ME'], label: { '000007ME': 'Folkmängd' } },
    },
    Tid: { category: { index: ['2025'] } },
  },
}

function fakeFetchImpl() {
  return vi.fn(async (url: string | URL, init?: RequestInit) => {
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
}

describe('buildAll (real REGISTRY)', () => {
  it('returns one series per registered indicator, each with one row per municipality, and unique ids', async () => {
    const rawDir = mkdtempSync(join(tmpdir(), 'registry-raw-'))
    const result = await buildAll({
      rawDir,
      deps: { fetchImpl: fakeFetchImpl() as unknown as typeof fetch },
      clock: () => '2026-09-13T10:00:00.000Z',
    })

    expect(result.series).toHaveLength(REGISTRY.length)
    expect(result.indicators).toHaveLength(REGISTRY.length)
    expect(result.municipalities).toHaveLength(1)

    for (const s of result.series) {
      expect(s.values).toHaveLength(result.municipalities.length)
      expect(s.status).toHaveLength(result.municipalities.length)
    }

    const ids = result.indicators.map((i) => i.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(result.series.map((s) => s.indicator).sort()).toEqual([...ids].sort())
  })
})

/** A fake registry lets us test the integrity guards without a network round trip. */
describe('buildAll (fake registries: integrity guards)', () => {
  const fakeMunicipalities: Municipality[] = [
    { code: '0001', name: { sv: 'A', en: 'A' }, county: '00' },
    { code: '0002', name: { sv: 'B', en: 'B' }, county: '00' },
  ]

  function fakeSeries(id: string, rows: number): IndicatorSeries {
    return {
      indicator: id,
      years: [2024],
      values: Array.from({ length: rows }, () => [1]),
      status: Array.from({ length: rows }, () => [0]),
    }
  }

  function fakeIndicator(id: string): Indicator {
    return {
      id,
      name: { sv: id, en: id },
      description: { sv: id, en: id },
      unit: 'count',
      priceBasis: 'none',
      scale: { kind: 'sequential', breaks: [] },
      coverage: { from: 2024, to: 2024 },
      caveat: { sv: '', en: '' },
      sensitivity: 'none',
      sources: [],
      derivation: '',
    }
  }

  /** Seeds ctx.municipalities the way the real population definition does. */
  const seed: IndicatorDefinition = {
    indicator: fakeIndicator('seed'),
    build: async (ctx: BuildContext) => {
      ctx.municipalities.push(...fakeMunicipalities)
      return fakeSeries('seed', fakeMunicipalities.length)
    },
  }

  it("throws, naming the offending indicator, when a definition's series has the wrong row count", async () => {
    const broken: IndicatorDefinition = {
      indicator: fakeIndicator('broken'),
      build: async () => fakeSeries('broken', 1), // wrong: 1 row for 2 municipalities
    }
    await expect(buildAll({}, [seed, broken])).rejects.toThrow(/broken/)
  })

  it('throws, naming the id, when two registered indicators share the same id', async () => {
    const dup: IndicatorDefinition = {
      indicator: fakeIndicator('dup'),
      build: async () => fakeSeries('dup', fakeMunicipalities.length),
    }
    const dupAgain: IndicatorDefinition = {
      indicator: fakeIndicator('dup'),
      build: async () => fakeSeries('dup', fakeMunicipalities.length),
    }
    await expect(buildAll({}, [seed, dup, dupAgain])).rejects.toThrow(/dup/)
  })

  it('does not throw when every definition reports the right row count with unique ids', async () => {
    const other: IndicatorDefinition = {
      indicator: fakeIndicator('other'),
      build: async () => fakeSeries('other', fakeMunicipalities.length),
    }
    const result = await buildAll({}, [seed, other])
    expect(result.series).toHaveLength(2)
    expect(result.indicators.map((i) => i.id)).toEqual(['seed', 'other'])
  })
})

describe('build order', () => {
  it('throws naming the indicator when one builds before municipalities exist', async () => {
    // A definition that publishes rows without ever establishing ctx.municipalities — the
    // shape of a REGISTRY where population is not first. The row-count check cannot catch
    // this on its own, because zero rows and zero municipalities agree.
    const premature: IndicatorDefinition = {
      indicator: {
        id: 'premature',
        name: { sv: 'För tidig', en: 'Premature' },
        unit: { sv: 'st', en: 'count' },
        description: { sv: 'test', en: 'test' },
        priceBasis: 'nominal',
        scale: 'sequential',
        sources: [],
        derivation: { sv: 'test', en: 'test' },
      } as unknown as Indicator,
      build: async () =>
        ({
          indicatorId: 'premature',
          years: [2000],
          values: [],
          status: [],
        }) as unknown as IndicatorSeries,
    }
    // Assert the ordering guard's own wording, not merely that *something* threw with this
    // indicator's name in it. Removing the guard still produces a throw — quantileBreaks
    // refuses an all-null column and names the same indicator — so a loose /premature/
    // matcher passes either way and cannot fail. Verified by mutation: with the guard
    // deleted, this expectation fails and the loose one does not.
    await expect(buildAll({}, [premature])).rejects.toThrow(/population must come first/)
  })
})
