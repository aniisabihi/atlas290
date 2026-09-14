import { describe, expect, it } from 'vitest'
import type { GeometryCollection, Topology } from 'topojson-specification'
import { buildAdjacency, curatedEdgePairs, isConnected, type CuratedEdge } from './adjacency'

// Three squares, each with its own arc: A and B are coincident in space but share no arc
// index, so topojson.neighbors (which detects neighbours by shared arc index, not by
// coincident coordinates) does not consider them topological neighbours. C is an island,
// far from both. This fixture can only support assertions about automatic island-joining
// and curated-edge preference — see ruling R5 for why the brief's "A and B are neighbours"
// assertion does not hold here. Real shared-arc behaviour is verified against the genuine
// 290-municipality topology in Step 6.
const topo = {
  type: 'Topology',
  arcs: [
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0],
    ],
    [
      [1, 0],
      [2, 0],
      [2, 1],
      [1, 1],
      [1, 0],
    ],
    [
      [5, 5],
      [6, 5],
      [6, 6],
      [5, 6],
      [5, 5],
    ],
  ],
  objects: {
    municipalities: {
      type: 'GeometryCollection',
      geometries: [
        { type: 'Polygon', arcs: [[0]], properties: { code: '0001', name: 'A' } },
        { type: 'Polygon', arcs: [[1]], properties: { code: '0002', name: 'B' } },
        { type: 'Polygon', arcs: [[2]], properties: { code: '0003', name: 'C' } },
      ],
    },
  },
} as unknown as Topology<{ municipalities: GeometryCollection<{ code: string; name: string }> }>

const centroids = new Map<string, [number, number]>([
  ['0001', [0.05, 0.05]],
  ['0002', [0.15, 0.05]],
  ['0003', [0.55, 0.55]],
])

describe('buildAdjacency', () => {
  it('connects the island to the graph and records the edge as synthetic', () => {
    const adj = buildAdjacency(topo, centroids, [])
    expect(adj.synthetic.length).toBeGreaterThan(0)
    expect(isConnected(adj.neighbours)).toBe(true)
  })

  it('prefers curated edges over automatic ones', () => {
    // A curated edge alone from the island (0003) to 0001 is not enough to make `synthetic`
    // empty: 0001 and 0002 share no arc either (each has its own, per the note above), so
    // without a second curated edge the "join until connected" loop would still add an
    // automatic edge for 0002. Curating both edges fully connects the graph with no
    // automatic edges needed, which is what proves curation is preferred over automatic
    // joining.
    const adj = buildAdjacency(topo, centroids, [
      ['0003', '0001'],
      ['0001', '0002'],
    ])
    expect(adj.neighbours['0003']).toContain('0001')
    expect(adj.synthetic).toEqual([])
  })

  it('throws naming the pair and the unknown code when a curated edge is not a real municipality', () => {
    expect(() => buildAdjacency(topo, centroids, [['0003', '9999']])).toThrow(/9999/)
    expect(() => buildAdjacency(topo, centroids, [['0003', '9999']])).toThrow(/0003/)
    expect(() => buildAdjacency(topo, centroids, [['8888', '0001']])).toThrow(/8888/)
  })
})

describe('curatedEdgePairs', () => {
  it('extracts plain [from, to] code pairs from the annotated curated-edges.json records', () => {
    const edges: CuratedEdge[] = [
      { from: '0980', fromName: 'Gotland', to: '0192', toName: 'Nynäshamn', reason: 'ferry' },
      { from: '1407', fromName: 'Öckerö', to: '1480', toName: 'Göteborg', reason: 'ferry' },
    ]
    expect(curatedEdgePairs(edges)).toEqual([
      ['0980', '0192'],
      ['1407', '1480'],
    ])
  })
})
