import { createHash } from 'node:crypto'
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import type { ZodType } from 'zod'
import {
  Adjacency,
  Facts,
  Manifest,
  PantryData,
  PantryIndex,
  PantryIndicator,
  Similar,
  assemblePantry,
  splitPantry,
} from '../../shared/pantry'
import type { Indicator, IndicatorSeries } from '../../shared/pantry'
import { check } from './check'
import { cmp } from './cmp'
import { roundIndicatorBreaks, roundSeriesValues } from './round'
import { buildAdjacency, curatedEdgePairs, type CuratedEdge } from './geometry/adjacency'
import { buildBubbleLayout } from './geometry/bubbles'
import { buildSimilar } from './similar/build'
import { buildFacts } from './facts/build'
import { buildTopology, centroids, GEOMETRY_SOURCE } from './geometry/build'
import { municipalityProps } from './geometry/props'
import { buildAll } from './indicators/registry'
import { fetchCpi, toPriceIndex } from './indicators/cpi'
import { selectionKey as computeSelectionKey } from './scb/freeze'
import type { FrozenData, FrozenMeta } from './scb/freeze'

export const DEFAULT_PANTRY_DIR = 'public/pantry'

/**
 * Follow-up to Task 13: rounds every indicator's own colour-scale breaks, and every value in
 * its own series, to the decimal precision its declared `unit` carries (`round.ts`) — applied
 * once, here, immediately before the pantry's numbers are written to `data/indicators.json`.
 * Never earlier: `buildAll()`'s own output — and `check()`'s validation of it, which runs
 * before this in `publish()` — keeps full precision, so a derived indicator that reads
 * another's already-built series (`net-migration-rate` reading population,
 * `population-change` and `share-65-plus` reading population) computes off the real,
 * unrounded value. Rounding twice, or rounding mid-build instead of once at the very end,
 * would let error compound in a way no reader could detect from the published file alone.
 */
export function roundPantryData(
  indicators: Indicator[],
  series: IndicatorSeries[],
): { indicators: Indicator[]; series: IndicatorSeries[] } {
  const unitById = new Map(indicators.map((i) => [i.id, i.unit]))
  return {
    indicators: indicators.map(roundIndicatorBreaks),
    series: series.map((s) => {
      const unit = unitById.get(s.indicator)
      if (!unit) {
        throw new Error(
          `roundPantryData: series '${s.indicator}' has no matching indicator — cannot tell ` +
            'what precision to round its values to',
        )
      }
      return roundSeriesValues(s, unit)
    }),
  }
}

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

/**
 * Sorted keys, minified (no indentation), trailing newline. Sorted keys stay — determinism
 * (byte-identical rebuilds) depends on stable key order, not on the file being readable.
 * Indentation does not: the pretty-printed 2-space form cost more than half of
 * indicators.json's bytes (measured: 4,962,191 B pretty vs 2.06 MB minified) for a file a
 * browser downloads, never a document a human reads directly — a diff review reads the
 * *values* that changed, not this file's own whitespace, and `git diff` still shows which
 * lines changed either way since this is one file per pantry artifact, not one line per value.
 */
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeys(value)) + '\n'
}

/** Validates against `schema` before writing — a schema failure must be a build failure. */
export function writePantryFile(path: string, schema: ZodType, value: unknown): void {
  const parsed = schema.parse(value)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, stableStringify(parsed))
}

/** Where the index lives inside a pantry directory, and where the per-indicator files live. */
export const INDEX_FILE = 'data/index.json'
export const INDICATOR_DIR = 'data/indicators'

/**
 * Writes the pantry as the files the site fetches: one index, and one file per indicator.
 *
 * Plan 13. The single `data/indicators.json` was 275,842 gzipped bytes fetched before first
 * paint, for an opening view that draws one indicator. Split, the index is 6,471 and a visitor
 * downloads one series beside it.
 *
 * Every file goes through `writePantryFile`, so each is schema-checked and stably stringified
 * exactly as the one file was — determinism is per file already, and needs nothing new here.
 */
export function writePantryParts(pantryDir: string, data: PantryData): void {
  const { index, parts } = splitPantry(data)
  writePantryFile(join(pantryDir, INDEX_FILE), PantryIndex, index)
  for (const part of parts) {
    writePantryFile(
      join(pantryDir, INDICATOR_DIR, `${part.indicator.id}.json`),
      PantryIndicator,
      part,
    )
  }
}

/**
 * Reads those files back into one pantry. The build-time tools and the test fixtures take this
 * path, all of which legitimately want everything; the SITE never does.
 *
 * Reads only the indicators the INDEX lists, rather than everything in the directory, so a
 * stale file left behind by an older publish cannot quietly rejoin the dataset.
 */
export function readPantryParts(pantryDir: string): PantryData {
  const index = PantryIndex.parse(
    JSON.parse(readFileSync(join(pantryDir, INDEX_FILE), 'utf8')) as unknown,
  )
  const parts = index.indicators.map((meta) => {
    const file = join(pantryDir, INDICATOR_DIR, `${meta.id}.json`)
    let text: string
    try {
      text = readFileSync(file, 'utf8')
    } catch {
      throw new Error(
        `readPantryParts: the index lists "${meta.id}" but ${file} is missing; run yarn kitchen publish`,
      )
    }
    return PantryIndicator.parse(JSON.parse(text) as unknown)
  })
  return assemblePantry(index, parts)
}

/**
 * Deletes indicator files the index no longer lists.
 *
 * Without this, dropping or renaming an indicator would leave its file in `public/pantry/`
 * for ever: the publish would simply stop writing it, and nothing would remove it. It would
 * still be served, still be committed, and `readPantryParts` would ignore it — the worst kind
 * of stale, because every check would pass.
 */
function pruneIndicatorFiles(pantryDir: string, keep: readonly string[]): void {
  const dir = join(pantryDir, INDICATOR_DIR)
  let present: string[]
  try {
    present = readdirSync(dir)
  } catch {
    return
  }
  const wanted = new Set(keep.map((id) => `${id}.json`))
  for (const file of present) {
    if (file.endsWith('.json') && !wanted.has(file)) rmSync(join(dir, file))
  }
}

/**
 * The ContentsCodes a frozen chunk's selection actually resolved to (review finding 3):
 * read off the frozen `selection` itself, which `resolveContentCode`
 * (kitchen/src/indicators/source.ts) resolved by label at fetch time — never a literal
 * hardcoded here — so the manifest tracks a codelist change the same way the fetch does.
 *
 * A set rather than one code, since plan 17. `out-commuter-share` fetches its numerator and its
 * denominator together — two content codes in one selection — because they are two codes of one
 * table and fetching them separately would be two requests where one answers. The guard that
 * matters is unchanged: a data chunk with NO ContentsCode cannot be attributed to a source at
 * all, and still throws.
 */
function sourceContentCodes(f: FrozenData): readonly string[] {
  const codes = f.selection['ContentsCode']
  if (!codes || codes.length === 0) {
    throw new Error(
      `${f.table} ${f.lang}: the frozen selection names no ContentsCode, so this chunk cannot ` +
        'be attributed to an indicator source for provenance',
    )
  }
  return codes
}

/**
 * Task 13: more than one indicator can fetch the exact same table+lang+selection — median
 * income and house prices each call `cpi.ts`'s `fetchCpi` independently (cpi.ts is
 * deliberately independent of the registry, per its own module comment), so `ctx.frozen` ends
 * up holding two byte-identical copies of every CPI chunk once both indicators have built.
 * Deduping here, keyed on the one thing that actually identifies "the same frozen chunk"
 * (table + lang + the selection's own hash), keeps the flat `sources` list one entry per real
 * fetch rather than silently doubling every shared source — a wrong indicator/chunk pairing
 * would still be a manifest bug, but a harmless duplicate listing would just be noise a human
 * has to read past.
 */
function dedupeBy<T>(items: T[], keyOf: (item: T) => string): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const item of items) {
    const key = keyOf(item)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(item)
  }
  return out
}

/**
 * Task 13: which of an indicator's OWN frozen chunks actually back its published values,
 * keyed by indicator id — populates `Manifest.indicatorSources`. Takes each indicator's own
 * slice of chunks (`buildAll`'s `sourcesByIndicator`, exactly what THAT definition's own
 * `build(ctx)` call pushed — never the flat, shared `frozen` array), then keeps only the ones
 * matching one of the indicator's own DECLARED `sources` (table + contentCode pairs, set by
 * that indicator's own module — e.g. `POPULATION.sources`, `TAX.sources`), resolved via
 * `sourceContentCode` above rather than a literal hardcoded here, so this tracks a codelist
 * change the same way the fetch itself does.
 *
 * Matching on (table, contentCode) against the per-indicator slice — not against the shared
 * `frozen` array — matters concretely: population and share-65-plus both declare
 * TAB638/`BE0101N1` as one of their own sources (a real fact — population fetches the age
 * TOTAL from it, share-65-plus fetches ages 65+ from the very same table and content code, via
 * a different `Alder` selection). Matching against the shared array first, before this was
 * corrected, attributed share-65-plus's ~50 chunked requests to population too, and vice
 * versa — caught by checking the two indicators' resulting chunk lists against each other,
 * not by the code merely compiling and the row counts looking plausible.
 *
 * A declared pair can still match more than one physical chunk within an indicator's own
 * slice (SCB's 150,000-cell limit can force `chunkSelection` to split one logical fetch into
 * several requests, each its own frozen file with its own selectionKey) — every match is
 * included, not just the first. An indicator with no declared sources at all
 * (population-change, which fetches nothing) still gets its own key, with an empty array,
 * rather than being silently omitted.
 */
export function buildIndicatorSources(
  indicators: Indicator[],
  sourcesByIndicator: Record<string, Array<FrozenData | FrozenMeta>>,
): Record<string, Array<{ table: string; contentCode: string; selectionKey: string }>> {
  const result: Record<
    string,
    Array<{ table: string; contentCode: string; selectionKey: string }>
  > = {}
  for (const indicator of indicators) {
    const ownChunks = (sourcesByIndicator[indicator.id] ?? []).filter(
      (f): f is FrozenData => f.kind === 'data',
    )
    const rows: Array<{ table: string; contentCode: string; selectionKey: string }> = []
    for (const source of indicator.sources) {
      for (const f of ownChunks) {
        if (f.table !== source.table || !sourceContentCodes(f).includes(source.contentCode))
          continue
        rows.push({
          table: f.table,
          contentCode: source.contentCode,
          selectionKey: computeSelectionKey(f.selection),
        })
      }
    }
    result[indicator.id] = rows
  }
  return result
}

export function buildManifest(
  frozen: Array<FrozenData | FrozenMeta>,
  geometry: Manifest['geometry'],
  indicators: Indicator[] = [],
  sourcesByIndicator: Record<string, Array<FrozenData | FrozenMeta>> = {},
): Manifest {
  const dataChunks = dedupeBy(
    frozen.filter((f): f is FrozenData => f.kind === 'data'),
    (f) => `${f.table}|${f.lang}|${computeSelectionKey(f.selection)}`,
  )
  return Manifest.parse({
    schemaVersion: 2,
    license: 'CC0-1.0',
    sources: dataChunks
      .map((f) => ({
        table: f.table,
        lang: f.lang,
        url: f.url,
        selectionKey: computeSelectionKey(f.selection),
        contentCodes: sourceContentCodes(f) as [string, ...string[]],
        fetchedAt: f.fetchedAt,
        sha256: createHash('sha256').update(JSON.stringify(f.response)).digest('hex'),
        cells: f.response.value.length,
      }))
      .sort((a, b) => cmp(a.table, b.table) || cmp(a.sha256, b.sha256)),
    indicatorSources: buildIndicatorSources(indicators, sourcesByIndicator),
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

/** Proves publish() never touches the network: any attempted fetch throws, naming the fix. */
const offline: typeof fetch = async (input) => {
  throw new Error(
    `publish must be offline but tried to fetch ${String(input)}; run 'yarn kitchen fetch' first`,
  )
}

export type PublishDeps = {
  buildAll?: typeof buildAll
  buildTopology?: typeof buildTopology
}

export async function publish(
  opts: { pantryDir?: string; rawDir?: string; deps?: PublishDeps } = {},
): Promise<void> {
  const pantryDir = opts.pantryDir ?? DEFAULT_PANTRY_DIR
  const doBuildAll = opts.deps?.buildAll ?? buildAll
  const doBuildTopology = opts.deps?.buildTopology ?? buildTopology

  // Task 13: every registered indicator (population, tax rate, density, net migration,
  // median income, house prices, post-secondary education, population change, mean age,
  // share aged 65 and over), built through the shared registry path — not just population,
  // the only indicator this pipeline published before this task.
  const { municipalities, indicators, series, frozen, sourcesByIndicator } = await doBuildAll({
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

    // Task 13: the check stage runs here — after buildAll() and after assertCodesMatch, but
    // strictly before the FIRST write into `pantryDir` (the topology copy immediately below
    // is that first write; everything above this point only touches `scratchDir`, a temp
    // directory outside the pantry). A code mismatch above already throws before reaching
    // this line, so check() never has to run against fabricated/mismatched fixtures used only
    // to exercise assertCodesMatch (kitchen/src/publish.test.ts's R22 test uses a deliberately
    // tiny two-municipality fake that would otherwise fail check()'s own 290-municipality
    // rule for an unrelated reason). Either ordering satisfies "refuses to write anything on
    // a failure" equally — nothing has touched `pantryDir` yet either way — so this placement
    // is chosen to keep that existing, unrelated test coverage intact rather than to assert
    // any priority between the two guards.
    check({ municipalities, indicators, series })

    mkdirSync(dirname(topoOutFile), { recursive: true })
    copyFileSync(scratchTopoFile, topoOutFile)

    const c = centroids(topology)
    const curated = curatedEdgePairs(
      loadCuratedEdges(join(import.meta.dirname, 'geometry/curated-edges.json')),
    )
    const adjacency = buildAdjacency(topology, c, curated)
    writePantryFile(join(pantryDir, 'geometry/adjacency.json'), Adjacency, adjacency)

    // Read back through the freeze layer, so this is the same already-frozen TAB4352 the two
    // money indicators used during their own build — no second request, and offline like
    // everything else at this stage.
    const { index: cpiIndex } = await fetchCpi({
      rawDir: opts.rawDir,
      deps: { fetchImpl: offline },
    })

    const rounded = roundPantryData(indicators, series)

    /**
     * Plan 21: one bubble layout per indicator, sized from the PUBLISHED values.
     *
     * From the rounded series rather than the full-precision build output, for the reason the
     * similarity and facts files give below: a layout is a claim about the file a reader has —
     * "this slot is the largest bubble Kiruna takes in any year" — and the site sizes each year's
     * bubble from the same published values, so the two have to agree to the digit. Built here,
     * before `PantryData.parse`, because the layout is part of what each indicator's file carries
     * and the cross-reference check joins every layout's codes to the municipalities.
     *
     * `buildBubbleLayout` throws, naming the indicator, when it cannot prove a layout reachable
     * with the arrow keys — so this is a gate as well as a build step.
     */
    const seriesById = new Map(rounded.series.map((s) => [s.indicator, s]))
    const layouts = rounded.indicators.map((indicator) => {
      const own = seriesById.get(indicator.id)
      if (!own) throw new Error(`publish: no series for indicator "${indicator.id}"`)
      return {
        indicator: indicator.id,
        ...buildBubbleLayout({
          indicator: indicator.id,
          kind: indicator.scale.kind,
          centroids: c,
          municipalities,
          series: own,
          neighbours: adjacency.neighbours,
        }),
      }
    })

    const published = PantryData.parse({
      schemaVersion: 1,
      municipalities,
      indicators: rounded.indicators,
      series: rounded.series,
      priceIndex: toPriceIndex(cpiIndex),
      layouts,
    })
    writePantryParts(pantryDir, published)
    pruneIndicatorFiles(
      pantryDir,
      published.indicators.map((i) => i.id),
    )

    /**
     * Plan 6: "places like this", computed from the PUBLISHED data rather than the full-
     * precision build output — the opposite of the rule `roundPantryData`'s own comment sets
     * out for derived indicators, and deliberately so.
     *
     * A derived INDICATOR is a number the site displays, so it must be computed off the real
     * value before rounding or the error compounds invisibly. This is not that. It is a claim
     * ABOUT the published file — "of the 290, these five are closest to Lund" — and a reader
     * who wants to check it has only the published file to check it against. Computing it off
     * numbers nobody can see would make it unverifiable for a difference far below the
     * measured 0.032 median gap between the fifth and sixth nearest.
     */
    writePantryFile(join(pantryDir, 'data/similar.json'), Similar, buildSimilar(published))

    /**
     * Plan 7: the facts strip, found rather than written. Computed from the published data for
     * the same reason the similarity file is — it is a claim ABOUT `indicators.json`, and a
     * reader checking "288 of 289" has only the published file to check it against.
     *
     * It is written last of the data files because it is the only one built on top of another:
     * the `unusual` family reuses Plan 6's windowed features, so a change to the similarity
     * metric changes a sentence on the front page.
     */
    writePantryFile(join(pantryDir, 'data/facts.json'), Facts, buildFacts(published))
    writePantryFile(
      join(pantryDir, 'manifest.json'),
      Manifest,
      buildManifest(frozen, GEOMETRY_SOURCE, indicators, sourcesByIndicator),
    )
  } finally {
    rmSync(scratchDir, { recursive: true, force: true })
  }
}
