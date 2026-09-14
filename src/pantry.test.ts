import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadPantry } from './pantry'

/** Smallest object that satisfies the PantryData zod schema: empty arrays are valid. */
const validData = {
  schemaVersion: 1,
  municipalities: [],
  indicators: [],
  series: [],
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

/** Routes the data-file fetch and the topology-file fetch to different stub responses. */
function stubFetch(dataRes: Response, topoRes: Response) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => Promise.resolve(url.includes('indicators') ? dataRes : topoRes)),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('loadPantry', () => {
  it('throws the pantry-files-missing message when either response is not ok', async () => {
    stubFetch(notOkResponse(), notOkResponse())
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

  it('resolves with the validated data and the topology on the happy path', async () => {
    stubFetch(okResponse(validData), okResponse(validTopology))
    await expect(loadPantry()).resolves.toEqual({ data: validData, topology: validTopology })
  })
})
