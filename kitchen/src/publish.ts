import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { ZodType } from 'zod'
import { Adjacency, Bubbles, Manifest, PantryData } from '../../shared/pantry'
import { buildAdjacency, curatedEdgePairs, type CuratedEdge } from './geometry/adjacency'
import { buildBubbles } from './geometry/bubbles'
import { buildTopology, centroids } from './geometry/build'
import { municipalityProps } from './geometry/props'
import { CKM_FROM, fetchPopulation } from './indicators/population'
import type { FrozenData, FrozenMeta } from './scb/freeze'

export const DEFAULT_PANTRY_DIR = 'public/pantry'

/**
 * Ruling R7: the annotated curated-edges.json is read here with plain fs + JSON.parse, never
 * with an ESM JSON import (`import curated from './geometry/curated-edges.json'`) — Node
 * requires import attributes for that and tsx's support is inconsistent. `curatedEdgePairs`
 * (kitchen/src/geometry/adjacency.ts) still owns turning the annotated records into plain
 * [from, to] pairs; this function only owns getting the file's bytes off disk.
 */
function loadCuratedEdges(path: string): CuratedEdge[] {
  return JSON.parse(readFileSync(path, 'utf8')) as CuratedEdge[]
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((k) => [k, sortKeys((value as Record<string, unknown>)[k])]),
    )
  }
  return value
}

/** Sorted keys, 2-space indent, trailing newline — so a data refresh is a readable diff. */
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeys(value), null, 2) + '\n'
}

/** Validates against `schema` before writing — a schema failure must be a build failure. */
export function writePantryFile(path: string, schema: ZodType, value: unknown): void {
  const parsed = schema.parse(value)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, stableStringify(parsed))
}

export function buildManifest(frozen: Array<FrozenData | FrozenMeta>): Manifest {
  return Manifest.parse({
    schemaVersion: 1,
    license: 'CC0-1.0',
    sources: frozen
      .filter((f): f is FrozenData => f.kind === 'data')
      .map((f) => ({
        table: f.table,
        lang: f.lang,
        url: f.url,
        fetchedAt: f.fetchedAt,
        sha256: createHash('sha256').update(JSON.stringify(f.response)).digest('hex'),
        cells: f.response.value.length,
      }))
      .sort((a, b) => a.table.localeCompare(b.table) || a.sha256.localeCompare(b.sha256)),
  })
}

/**
 * Ruling R22: the map (geometry codes) and the numbers (statistics codes) are joined only by
 * four-digit municipality code. A silent mismatch means a municipality is drawn with another's
 * data, or drawn with none — so this must throw, before anything is written, unless the two
 * sets are exactly equal (same size, same members), and the message must name the counts on
 * both sides plus the codes present in one and missing from the other, in both directions, so
 * a human can act on it.
 */
export function assertCodesMatch(
  geometryCodes: readonly string[],
  statisticsCodes: readonly string[],
): void {
  const geoSet = new Set(geometryCodes)
  const statSet = new Set(statisticsCodes)
  const onlyInGeometry = [...geoSet].filter((c) => !statSet.has(c)).sort()
  const onlyInStatistics = [...statSet].filter((c) => !geoSet.has(c)).sort()
  if (onlyInGeometry.length === 0 && onlyInStatistics.length === 0 && geoSet.size === statSet.size)
    return
  throw new Error(
    `geometry/statistics municipality-code mismatch: ${geoSet.size} geometry codes vs ` +
      `${statSet.size} statistics codes. Only in geometry (${onlyInGeometry.length}): ` +
      `${onlyInGeometry.join(', ') || '(none)'}. Only in statistics (${onlyInStatistics.length}): ` +
      `${onlyInStatistics.join(', ') || '(none)'}.`,
  )
}

/** Proves publish() never touches the network: any attempted fetch throws, naming the fix. */
const offline: typeof fetch = async (input) => {
  throw new Error(
    `publish must be offline but tried to fetch ${String(input)}; run 'yarn kitchen fetch' first`,
  )
}

export async function publish(opts: { pantryDir?: string; rawDir?: string } = {}): Promise<void> {
  const pantryDir = opts.pantryDir ?? DEFAULT_PANTRY_DIR
  const { municipalities, indicator, series, frozen } = await fetchPopulation({
    rawDir: opts.rawDir,
    deps: { fetchImpl: offline },
  })

  const topology = await buildTopology({
    outFile: join(pantryDir, 'geometry/municipalities.topo.json'),
  })
  const geoCodes = topology.objects.municipalities.geometries.map(
    (g, i) => municipalityProps(g, i).code,
  )
  assertCodesMatch(
    geoCodes,
    municipalities.map((m) => m.code),
  )

  const c = centroids(topology)
  const curated = curatedEdgePairs(
    loadCuratedEdges(join(import.meta.dirname, 'geometry/curated-edges.json')),
  )
  writePantryFile(
    join(pantryDir, 'geometry/adjacency.json'),
    Adjacency,
    buildAdjacency(topology, c, curated),
  )

  // Last year before SCB's Cell Key Method perturbation begins: a stable, unperturbed
  // reference year for the bubble layout, rather than always the newest one.
  const latestYear = CKM_FROM - 1
  const yi = series.years.indexOf(latestYear)
  const population = new Map(municipalities.map((m, i) => [m.code, series.values[i]?.[yi] ?? 0]))
  writePantryFile(
    join(pantryDir, 'layout/bubbles.json'),
    Bubbles,
    buildBubbles(c, population, latestYear),
  )

  writePantryFile(join(pantryDir, 'data/indicators.json'), PantryData, {
    schemaVersion: 1,
    municipalities,
    indicators: [indicator],
    series: [series],
  })
  writePantryFile(join(pantryDir, 'manifest.json'), Manifest, buildManifest(frozen))
}
