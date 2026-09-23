import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchIndicatorPart, loadPantry, withPart } from './pantry'

/**
 * Plan 13: the loader fetches an index, then the one series the URL asks for.
 *
 * The shape under test changed; the promises did not. A missing or malformed file still fails
 * loudly and by name rather than rendering a broken map, which is what most of this file is about.
 */

const indicator = {
  id: 'population',
  name: { sv: 'Folkmängd', en: 'Population' },
  description: { sv: 'Antal invånare.', en: 'Residents.' },
  unit: 'count',
  priceBasis: 'none',
  scale: { kind: 'sequential', breaks: [1, 2, 3, 4, 5, 6] },
  coverage: { from: 2024, to: 2025 },
  caveat: { sv: '', en: '' },
  sensitivity: 'none',
  sources: [{ table: 'TAB638', contentCode: 'BE0101N1', note: { sv: '', en: '' } }],
  derivation: { sv: 'Sum over sex and marital status.', en: 'Sum over sex and marital status.' },
}

const second = { ...indicator, id: 'tax-rate', unit: 'percent' }

/** Smallest index the schema accepts: no municipalities, so every series has no rows. */
const validIndex = {
  schemaVersion: 2,
  municipalities: [],
  indicators: [indicator, second],
  priceIndex: { base: 2025, values: { '2025': 100 } },
}

const partFor = (id: string) => ({
  indicator: id === 'tax-rate' ? second : indicator,
  series: { indicator: id, years: [2024, 2025], values: [], status: [] },
  // No municipalities, so no circles: a layout is one circle per row, and there are no rows.
  layout: { minR: 8, maxR: 40, cone: 45, circles: [] },
})

const validAdjacency = { schemaVersion: 1, neighbours: {}, synthetic: [] }
const validFacts = {
  schemaVersion: 1,
  facts: [
    {
      id: 'country-population-lower',
      family: 'country',
      text: { sv: '128 av 284 kommuner…', en: '128 of 284 municipalities…' },
      href: '/?i=population&y=2025',
      claim: '128 of 284',
    },
  ],
}
const validSimilar = {
  schemaVersion: 1,
  method: {
    indicators: ['population'],
    logged: ['population'],
    window: { from: 2015, to: 2024 },
    neighbours: 5,
  },
  nearest: {},
}
const validTopology = {
  type: 'Topology',
  objects: {
    municipalities: { type: 'GeometryCollection', geometries: [] },
    counties: { type: 'GeometryCollection', geometries: [] },
  },
  arcs: [],
}

function okResponse(body: unknown): Response {
  return { ok: true, json: () => Promise.resolve(body) } as Response
}

function notOkResponse(status = 404): Response {
  return { ok: false, status, json: () => Promise.resolve(undefined) } as Response
}

/** Routes each pantry fetch to its own stub, and records every URL asked for. */
function stubFetch(
  overrides: {
    index?: Response
    part?: (id: string) => Response
    topology?: Response
    adjacency?: Response
    similar?: Response
    facts?: Response
  } = {},
) {
  const asked: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      asked.push(url)
      if (url.includes('data/index.json'))
        return Promise.resolve(overrides.index ?? okResponse(validIndex))
      if (url.includes('data/indicators/')) {
        const id = url.split('/').pop()!.replace('.json', '')
        return Promise.resolve(overrides.part ? overrides.part(id) : okResponse(partFor(id)))
      }
      if (url.includes('adjacency'))
        return Promise.resolve(overrides.adjacency ?? okResponse(validAdjacency))
      if (url.includes('similar'))
        return Promise.resolve(overrides.similar ?? okResponse(validSimilar))
      if (url.includes('facts')) return Promise.resolve(overrides.facts ?? okResponse(validFacts))
      return Promise.resolve(overrides.topology ?? okResponse(validTopology))
    }),
  )
  return asked
}

afterEach(() => {
  vi.unstubAllGlobals()
  window.history.replaceState(null, '', '/sv/')
})

describe('loadPantry', () => {
  it.each([
    ['the index', { index: notOkResponse() }],
    ['the topology', { topology: notOkResponse() }],
    ['the adjacency graph', { adjacency: notOkResponse() }],
    ['the similar file', { similar: notOkResponse() }],
    ['the facts file', { facts: notOkResponse() }],
  ])('throws the pantry-files-missing message when %s is not ok', async (_what, overrides) => {
    stubFetch(overrides)
    await expect(loadPantry()).rejects.toThrow(/pantry files missing/)
  })

  it('names the indicator when its own file is missing', async () => {
    // A 404 on one indicator is a different failure from a missing pantry, and says so: the
    // index listed it, so either the publish is half-finished or the file was deleted by hand.
    stubFetch({ part: () => notOkResponse(404) })
    await expect(loadPantry()).rejects.toThrow(/no file for indicator "population"/)
  })

  it.each([
    ['has no objects.municipalities.geometries array', { type: 'Topology', objects: {}, arcs: [] }],
    [
      'has municipalities but geometries is not an array',
      {
        type: 'Topology',
        objects: { municipalities: { type: 'GeometryCollection', geometries: {} } },
        arcs: [],
      },
    ],
  ])('throws a named error when the topology %s', async (_what, topology) => {
    stubFetch({ topology: okResponse(topology) })
    await expect(loadPantry()).rejects.toThrow(/objects\.municipalities\.geometries/)
  })

  it('validates the adjacency graph rather than trusting it', async () => {
    stubFetch({ adjacency: okResponse({ schemaVersion: 1, neighbours: 'nope', synthetic: [] }) })
    await expect(loadPantry()).rejects.toThrow()
  })

  it('validates the similar file rather than trusting it', async () => {
    stubFetch({ similar: okResponse({ schemaVersion: 1, nearest: {} }) })
    await expect(loadPantry()).rejects.toThrow()
  })

  it('fetches exactly one indicator file: the one the URL asks for', async () => {
    window.history.replaceState(null, '', '/sv/?i=tax-rate&y=2025')
    const asked = stubFetch()
    const loaded = await loadPantry()

    const indicatorRequests = asked.filter((u) => u.includes('data/indicators/'))
    expect(indicatorRequests).toEqual(['/pantry/data/indicators/tax-rate.json'])
    expect([...loaded.parts.keys()]).toEqual(['tax-rate'])
  })

  it('falls back to the default indicator when the URL names one that does not exist', async () => {
    window.history.replaceState(null, '', '/sv/?i=not-an-indicator')
    const asked = stubFetch()
    await loadPantry()
    expect(asked.filter((u) => u.includes('data/indicators/'))).toEqual([
      '/pantry/data/indicators/population.json',
    ])
  })

  it('knows every indicator, and holds the series for one', async () => {
    const loaded = await (async () => {
      stubFetch()
      return loadPantry()
    })()
    expect(loaded.view.indicators.map((i) => i.id)).toEqual(['population', 'tax-rate'])
    expect(loaded.view.series.map((s) => s.indicator)).toEqual(['population'])
    expect(loaded.index.indicators).toHaveLength(2)
  })
})

describe('fetchIndicatorPart', () => {
  it('reads one indicator file and validates it', async () => {
    stubFetch()
    const part = await fetchIndicatorPart('tax-rate')
    expect(part.indicator.id).toBe('tax-rate')
    expect(part.series.indicator).toBe('tax-rate')
  })

  it('refuses a file whose series is not the indicator it claims to be', async () => {
    stubFetch({
      part: () => okResponse({ indicator, series: { ...partFor('tax-rate').series } }),
    })
    await expect(fetchIndicatorPart('population')).rejects.toThrow()
  })

  it('refuses a cell-level fault here, which is the only place that still looks', async () => {
    // Plan 18: viewOf stopped re-parsing the series it is handed, so THIS parse is the only
    // thing between a corrupt published cell and the site rendering it. A null value at status
    // 0 means 'present, and the number is null', which is not a thing.
    stubFetch({
      part: () =>
        okResponse({
          indicator,
          series: {
            indicator: 'population',
            years: [2024, 2025],
            values: [[null, 2]],
            status: [[0, 0]],
          },
        }),
    })
    await expect(fetchIndicatorPart('population')).rejects.toThrow(/cannot be 'present'/)
  })
})

describe('withPart', () => {
  it('returns a new pantry with the series added, leaving the old one alone', async () => {
    stubFetch()
    const loaded = await loadPantry()
    const grown = withPart(loaded, await fetchIndicatorPart('tax-rate'))

    expect(grown).not.toBe(loaded)
    expect(loaded.view.series.map((s) => s.indicator)).toEqual(['population'])
    expect(grown.view.series.map((s) => s.indicator)).toEqual(['population', 'tax-rate'])
  })

  it('orders series by the index, not by arrival', async () => {
    // url.ts opens on the first indicator, and the table twin reads them in order; a pantry that
    // reordered itself by whichever fetch landed first would shuffle under the visitor.
    window.history.replaceState(null, '', '/sv/?i=tax-rate')
    stubFetch()
    const loaded = await loadPantry()
    const grown = withPart(loaded, await fetchIndicatorPart('population'))
    expect(grown.view.series.map((s) => s.indicator)).toEqual(['population', 'tax-rate'])
  })

  it('is a no-op for a series already held, so a repeat fetch cannot churn identity', async () => {
    stubFetch()
    const loaded = await loadPantry()
    expect(withPart(loaded, await fetchIndicatorPart('population'))).toBe(loaded)
  })
})
