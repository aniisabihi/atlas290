import { createHash } from 'node:crypto'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import type { ZodType } from 'zod'
import { Adjacency, Bubbles, Manifest, PantryData } from '../../shared/pantry'
import type { IndicatorSeries, Municipality } from '../../shared/pantry'
import { cmp } from './cmp'
import { buildAdjacency, curatedEdgePairs, type CuratedEdge } from './geometry/adjacency'
import { buildBubbles } from './geometry/bubbles'
import { buildTopology, centroids, GEOMETRY_SOURCE } from './geometry/build'
import { municipalityProps } from './geometry/props'
import { CKM_FROM, fetchPopulation } from './indicators/population'
import { selectionKey as computeSelectionKey } from './scb/freeze'
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

/**
 * The ContentsCode a frozen chunk's selection actually resolved to (review finding 3):
 * read off the frozen `selection` itself, which `resolveContentCode`
 * (kitchen/src/indicators/population.ts) resolved by label at fetch time — never a literal
 * hardcoded here — so the manifest tracks a codelist change the same way the fetch does.
 */
function sourceContentCode(f: FrozenData): string {
  const codes = f.selection['ContentsCode']
  if (!codes || codes.length !== 1) {
    throw new Error(
      `${f.table} ${f.lang}: expected exactly one ContentsCode in the frozen selection for ` +
        `provenance, got ${JSON.stringify(codes)}`,
    )
  }
  return codes[0]!
}

export function buildManifest(
  frozen: Array<FrozenData | FrozenMeta>,
  geometry: Manifest['geometry'],
): Manifest {
  return Manifest.parse({
    schemaVersion: 1,
    license: 'CC0-1.0',
    sources: frozen
      .filter((f): f is FrozenData => f.kind === 'data')
      .map((f) => ({
        table: f.table,
        lang: f.lang,
        url: f.url,
        selectionKey: computeSelectionKey(f.selection),
        contentCode: sourceContentCode(f),
        fetchedAt: f.fetchedAt,
        sha256: createHash('sha256').update(JSON.stringify(f.response)).digest('hex'),
        cells: f.response.value.length,
      }))
      .sort((a, b) => cmp(a.table, b.table) || cmp(a.sha256, b.sha256)),
    geometry,
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

/**
 * Population for every municipality in `year`, for the bubble layout (review finding 4).
 * `series.values[i]?.[yi] ?? 0` used to substitute zero both when the year was not found
 * (yi === -1, never checked) and when a municipality's value was genuinely null — violating
 * the project's rule that absence is never zero. If the reference year ever fell outside the
 * series, every bubble would silently get radius zero and publish as 290 invisible points. Now
 * both cases throw, naming the year, the available range, or the offending municipality.
 */
export function bubblePopulation(
  municipalities: Municipality[],
  series: IndicatorSeries,
  year: number,
): Map<string, number> {
  const yi = series.years.indexOf(year)
  if (yi === -1) {
    throw new Error(
      `bubble layout: reference year ${year} not found in population series; available ` +
        `years are ${series.years[0]}–${series.years[series.years.length - 1]}`,
    )
  }
  return new Map(
    municipalities.map((m, i) => {
      const v = series.values[i]?.[yi]
      if (v == null) {
        throw new Error(
          `bubble layout: population for ${m.code} in ${year} is null; cannot size a bubble ` +
            'without a real value',
        )
      }
      return [m.code, v]
    }),
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
    // reference year for the bubble layout, rather than always the newest one. Deliberately
    // named apart from population.ts's LATEST_YEAR (review finding 2): this is "the last
    // unperturbed year", tied to CKM_FROM, not "the newest published year".
    const bubbleReferenceYear = CKM_FROM - 1
    const population = bubblePopulation(municipalities, series, bubbleReferenceYear)
    writePantryFile(
      join(pantryDir, 'layout/bubbles.json'),
      Bubbles,
      buildBubbles(c, population, bubbleReferenceYear),
    )

    writePantryFile(join(pantryDir, 'data/indicators.json'), PantryData, {
      schemaVersion: 1,
      municipalities,
      indicators: [indicator],
      series: [series],
    })
    writePantryFile(
      join(pantryDir, 'manifest.json'),
      Manifest,
      buildManifest(frozen, GEOMETRY_SOURCE),
    )
  } finally {
    rmSync(scratchDir, { recursive: true, force: true })
  }
}
