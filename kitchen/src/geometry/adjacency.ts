import { neighbors } from 'topojson-client'
import type { GeometryCollection, Topology } from 'topojson-specification'
import { Adjacency } from '../../../shared/pantry'
import { municipalityProps } from './props'

type Topo = Topology<{ municipalities: GeometryCollection<{ code: string; name: string }> }>

/**
 * One entry of `curated-edges.json` (review finding 3): carries both codes, both
 * municipality names, and the reason the pair was chosen, so a future maintainer can
 * judge whether an entry is still right by reading the file itself, without needing this
 * task's report.
 */
export type CuratedEdge = {
  from: string
  fromName: string
  to: string
  toName: string
  reason: string
}

/** Converts the annotated curated-edges.json records into the plain [from, to] code pairs `buildAdjacency` expects. */
export function curatedEdgePairs(edges: CuratedEdge[]): Array<[string, string]> {
  return edges.map((e) => [e.from, e.to])
}

/**
 * Connected components of the graph, largest first, each sorted for determinism. The single
 * traversal both `isConnected` and `buildAdjacency`'s joining loop need — collapsed into one
 * so the graph is never walked twice to answer what is really the same question ("how many
 * pieces is this in?").
 */
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

/** A graph is connected iff it has at most one component (an empty graph trivially is). */
export function isConnected(neighbours: Record<string, string[]>): boolean {
  return components(neighbours).length <= 1
}

/**
 * Straight-line distance between two municipalities' centroids. `centroids.get(a)!` on a code
 * missing from the map used to yield `undefined`, so the subtraction produced `NaN` — and
 * because every `NaN < x` comparison is false, the `best` candidate in buildAdjacency's
 * nearest-centroid search would silently keep whatever pair it first considered instead of
 * failing, picking an arbitrary (and wrong) join rather than erroring. This throws instead,
 * naming the missing code.
 */
function dist(centroids: Map<string, [number, number]>, a: string, b: string): number {
  const pa = centroids.get(a)
  if (!pa) throw new Error(`dist: no centroid for municipality code '${a}'`)
  const pb = centroids.get(b)
  if (!pb) throw new Error(`dist: no centroid for municipality code '${b}'`)
  return Math.hypot(pa[0] - pb[0], pa[1] - pb[1])
}

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
  const codes = geoms.map((g, i) => municipalityProps(g, i).code)
  const codeSet = new Set(codes)
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
    // Review finding 2: `nb[a]?.add(...)` on a typo'd code used to be a silent no-op. A
    // curated edge naming a code that isn't a real municipality in this topology now
    // fails loudly, naming both the offending code and the pair it came from, instead of
    // quietly dropping a keyboard-navigation edge or crashing later with a confusing
    // "reading properties of undefined" when the synthetic-join step looks it up.
    if (!codeSet.has(a)) {
      throw new Error(`curated edge ['${a}', '${b}']: '${a}' is not a real municipality code`)
    }
    if (!codeSet.has(b)) {
      throw new Error(`curated edge ['${a}', '${b}']: '${b}' is not a real municipality code`)
    }
    nb[a]!.add(b)
    nb[b]!.add(a)
  }
  const synthetic: Array<[string, string]> = []
  const plain = () => Object.fromEntries(Object.entries(nb).map(([k, v]) => [k, [...v].sort()]))
  for (let comps = components(plain()); comps.length > 1; comps = components(plain())) {
    const [main, ...rest] = comps
    const island = rest[0]!
    let best: [string, string, number] | null = null
    for (const a of island) {
      for (const b of main!) {
        const d = dist(centroids, a, b)
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
