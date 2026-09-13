import { neighbors } from 'topojson-client'
import type { GeometryCollection, Topology } from 'topojson-specification'
import { Adjacency } from '../../../shared/pantry'

type Topo = Topology<{ municipalities: GeometryCollection<{ code: string; name: string }> }>

export function isConnected(neighbours: Record<string, string[]>): boolean {
  const codes = Object.keys(neighbours)
  if (codes.length === 0) return true
  const seen = new Set<string>([codes[0]!])
  const stack = [codes[0]!]
  while (stack.length) {
    for (const n of neighbours[stack.pop()!] ?? []) {
      if (!seen.has(n)) {
        seen.add(n)
        stack.push(n)
      }
    }
  }
  return seen.size === codes.length
}

function components(neighbours: Record<string, string[]>): string[][] {
  const seen = new Set<string>()
  const out: string[][] = []
  for (const start of Object.keys(neighbours)) {
    if (seen.has(start)) continue
    const comp: string[] = []
    const stack = [start]
    seen.add(start)
    while (stack.length) {
      const c = stack.pop()!
      comp.push(c)
      for (const n of neighbours[c] ?? []) {
        if (!seen.has(n)) {
          seen.add(n)
          stack.push(n)
        }
      }
    }
    out.push(comp.sort())
  }
  return out.sort((a, b) => b.length - a.length)
}

const dist = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1])

/**
 * Topology neighbours, plus curated edges, plus automatic nearest-centroid edges from every
 * disconnected component to the main component until the graph is connected.
 */
export function buildAdjacency(
  topology: Topo,
  centroids: Map<string, [number, number]>,
  curated: Array<[string, string]>,
): Adjacency {
  const geoms = topology.objects.municipalities.geometries
  // Every real municipality geometry carries { code, name }; only a topojson NullObject
  // (never produced by our build) would leave `properties` untyped, hence the assertion.
  const codes = geoms.map((g) => (g.properties as { code: string; name: string }).code)
  const nb: Record<string, Set<string>> = Object.fromEntries(
    codes.map((c) => [c, new Set<string>()]),
  )
  neighbors(geoms).forEach((idxs, i) => {
    for (const j of idxs) {
      nb[codes[i]!]!.add(codes[j]!)
      nb[codes[j]!]!.add(codes[i]!)
    }
  })
  for (const [a, b] of curated) {
    nb[a]?.add(b)
    nb[b]?.add(a)
  }
  const synthetic: Array<[string, string]> = []
  const plain = () => Object.fromEntries(Object.entries(nb).map(([k, v]) => [k, [...v].sort()]))
  while (!isConnected(plain())) {
    const [main, ...rest] = components(plain())
    const island = rest[0]!
    let best: [string, string, number] | null = null
    for (const a of island) {
      for (const b of main!) {
        const d = dist(centroids.get(a)!, centroids.get(b)!)
        if (!best || d < best[2]) best = [a, b, d]
      }
    }
    const [a, b] = best!
    nb[a]!.add(b)
    nb[b]!.add(a)
    synthetic.push([a, b])
  }
  return Adjacency.parse({ schemaVersion: 1, neighbours: plain(), synthetic })
}
