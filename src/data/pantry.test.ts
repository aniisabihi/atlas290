import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadPantry } from './pantry'

/** Smallest object that satisfies the PantryData zod schema: empty arrays are valid. */
const validData = {
  schemaVersion: 1,
  municipalities: [],
  indicators: [],
  series: [],
  priceIndex: { base: 2025, values: { '2025': 100 } },
}

const validAdjacency = { schemaVersion: 1, neighbours: {}, synthetic: [] }
const validBubbles = {
  schemaVersion: 1,
  basedOn: { indicator: 'population', year: 2024 },
  circles: [],
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

function notOkResponse(): Response {
  return { ok: false, json: () => Promise.resolve(undefined) } as Response
}

/** Routes each of the three pantry fetches to its own stub response. */
function stubFetch(
  dataRes: Response,
  topoRes: Response,
  adjRes = okResponse(validAdjacency),
  bubbleRes = okResponse(validBubbles),
  similarRes = okResponse(validSimilar),
) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) =>
      Promise.resolve(
        url.includes('indicators')
          ? dataRes
          : url.includes('adjacency')
            ? adjRes
            : url.includes('bubbles')
              ? bubbleRes
              : url.includes('similar')
                ? similarRes
                : topoRes,
      ),
    ),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('loadPantry', () => {
  it.each([
    ['the data file', () => stubFetch(notOkResponse(), okResponse(validTopology))],
    ['the topology', () => stubFetch(okResponse(validData), notOkResponse())],
    [
      'the adjacency graph',
      () => stubFetch(okResponse(validData), okResponse(validTopology), notOkResponse()),
    ],
    [
      'the bubble layout',
      () =>
        stubFetch(
          okResponse(validData),
          okResponse(validTopology),
          okResponse(validAdjacency),
          notOkResponse(),
        ),
    ],
    [
      'the similar-municipalities file',
      () =>
        stubFetch(
          okResponse(validData),
          okResponse(validTopology),
          okResponse(validAdjacency),
          okResponse(validBubbles),
          notOkResponse(),
        ),
    ],
  ])('throws the pantry-files-missing message when %s is not ok', async (_label, stub) => {
    stub()
    await expect(loadPantry()).rejects.toThrow('pantry files missing')
  })

  it('throws a named error when the topology has no objects.municipalities.geometries array', async () => {
    stubFetch(okResponse(validData), okResponse({ type: 'Topology', objects: {}, arcs: [] }))
    await expect(loadPantry()).rejects.toThrow('has no objects.municipalities.geometries array')
  })

  it('throws the same named error when municipalities exists but geometries is not an array', async () => {
    // The case a shallower check (one that only tests objects.municipalities for
    // existence) would miss: the collection is present, but its geometries is an
    // object, not an array.
    stubFetch(
      okResponse(validData),
      okResponse({
        type: 'Topology',
        objects: { municipalities: { type: 'GeometryCollection', geometries: {} } },
        arcs: [],
      }),
    )
    await expect(loadPantry()).rejects.toThrow('has no objects.municipalities.geometries array')
  })

  it('validates the adjacency graph rather than trusting it', async () => {
    stubFetch(
      okResponse(validData),
      okResponse(validTopology),
      okResponse({ schemaVersion: 1, neighbours: { '180': ['0184'] }, synthetic: [] }),
    )
    // A three-digit key is not a municipality code, and arrow-key navigation reading it would
    // silently find no neighbours rather than failing.
    await expect(loadPantry()).rejects.toThrow(/four digits/)
  })

  it('validates the similar file rather than trusting it', async () => {
    stubFetch(
      okResponse(validData),
      okResponse(validTopology),
      okResponse(validAdjacency),
      okResponse(validBubbles),
      // A municipality listed as its own neighbour. The panel would render it as a link
      // back to the page it is already on, which looks like a styling bug rather than a
      // broken pantry — so the loader has to refuse it here.
      okResponse({ ...validSimilar, nearest: { '0180': ['0180'] } }),
    )
    await expect(loadPantry()).rejects.toThrow(/is listed as its own neighbour/)
  })

  it('resolves with the validated data, the topology, the adjacency graph and the neighbours', async () => {
    stubFetch(okResponse(validData), okResponse(validTopology))
    await expect(loadPantry()).resolves.toEqual({
      data: validData,
      topology: validTopology,
      adjacency: validAdjacency,
      bubbles: validBubbles,
      similar: validSimilar,
    })
  })
})
