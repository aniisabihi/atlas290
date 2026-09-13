import { createHash } from 'node:crypto'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import type { ZodType } from 'zod'
import { Adjacency, Bubbles, Manifest, PantryData } from '../../shared/pantry'
import { buildAdjacency, curatedEdgePairs, type CuratedEdge } from './geometry/adjacency'
import { buildBubbles } from './geometry/bubbles'
import { buildTopology, centroids } from './geometry/build'
import { municipalityProps } from './geometry/props'
import { CKM_FROM, fetchPopulation } from './indicators/population'
import type { FrozenData, FrozenMeta } from './scb/freeze'

/**
 * Plain, structural ordering — never `String.prototype.localeCompare` — for anything whose
 * order ends up in a committed pantry file. Municipality codes and SCB table ids happen to be
 * ASCII digits/letters, so no locale's collation actually reorders them today; but a
 * determinism guarantee that holds only because of what the data happens to look like is
 * weaker than one that holds structurally regardless of the machine's locale. This is
 * hardening, not a fix for a live bug.
 */
function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

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
      .sort((a, b) => cmp(a.table, b.table) || cmp(a.sha256, b.sha256)),
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

export type PublishDeps = {
  fetchPopulation?: typeof fetchPopulation
  buildTopology?: typeof buildTopology
}

export async function publish(
  opts: { pantryDir?: string; rawDir?: string; deps?: PublishDeps } = {},
): Promise<void> {
  const pantryDir = opts.pantryDir ?? DEFAULT_PANTRY_DIR
  const doFetchPopulation = opts.deps?.fetchPopulation ?? fetchPopulation
  const doBuildTopology = opts.deps?.buildTopology ?? buildTopology

  const { municipalities, indicator, series, frozen } = await doFetchPopulation({
    rawDir: opts.rawDir,
    deps: { fetchImpl: offline },
  })

  const topoOutFile = join(pantryDir, 'geometry/municipalities.topo.json')
  // Review finding 1: buildTopology() writes its output file as a side effect of running
  // mapshaper, and that used to happen before assertCodesMatch ran — so a genuine code
  // mismatch threw *after* the topology file already existed on disk, leaving a stale file
  // behind and contradicting both R22 and docs/kitchen.md's "refuses to write anything"
  // claim. Building into a scratch directory outside the pantry first, and only copying into
  // the pantry once the codes are proven to match, makes "throws before writing anything"
  // actually true rather than true only for the files publish() itself writes via
  // writePantryFile.
  const scratchDir = mkdtempSync(join(tmpdir(), 'sde-publish-'))
  try {
    const scratchTopoFile = join(scratchDir, 'municipalities.topo.json')
    const topology = await doBuildTopology({ outFile: scratchTopoFile })
    const geoCodes = topology.objects.municipalities.geometries.map(
      (g, i) => municipalityProps(g, i).code,
    )
    assertCodesMatch(
      geoCodes,
      municipalities.map((m) => m.code),
    )

    mkdirSync(dirname(topoOutFile), { recursive: true })
    copyFileSync(scratchTopoFile, topoOutFile)

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
  } finally {
    rmSync(scratchDir, { recursive: true, force: true })
  }
}
