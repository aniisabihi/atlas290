import {
  Adjacency,
  Bubbles,
  Facts,
  PantryIndex,
  PantryIndicator,
  Similar,
  viewOf,
  type PantryView,
} from '../../shared/pantry'
import type { MunicipalityTopology } from '../../shared/geometry'
import { metaFrom, parseState } from '../state/url'

/**
 * Where the published pantry lives, served by Vite's publicDir and by the static host.
 */
const PANTRY = '/pantry'

export type LoadedPantry = {
  /** What the site renders from: every indicator's metadata, and the series fetched so far. */
  view: PantryView
  /** The index as published, kept so a later fetch can rebuild the view from it. */
  index: PantryIndex
  /** The full indicators, keyed by id, for the ones fetched — the only source of prose. */
  parts: ReadonlyMap<string, PantryIndicator>
  topology: MunicipalityTopology
  adjacency: Adjacency
  bubbles: Bubbles
  similar: Similar
  facts: Facts
}

/**
 * Fetches one indicator's file: its full definition, including the prose only `AboutIndicator`
 * reads, and its series.
 *
 * Between 6,138 and 49,103 gzipped bytes each, against 272,475 for the single file this replaced.
 */
export async function fetchIndicatorPart(id: string): Promise<PantryIndicator> {
  const res = await fetch(`${PANTRY}/data/indicators/${encodeURIComponent(id)}.json`)
  if (!res.ok) {
    throw new Error(
      `pantry: no file for indicator "${id}" (HTTP ${res.status}); run yarn kitchen publish`,
    )
  }
  return PantryIndicator.parse(await res.json())
}

/**
 * Adds a fetched indicator to a loaded pantry, returning a NEW one — the old is left untouched.
 *
 * The new object identity is the point, not an accident of style: `App` memoises `lookup` on it,
 * and `ranksFor` caches into a WeakMap keyed on the Lookup object. Mutating in place would leave
 * both holding a view that no longer matches what was fetched.
 */
export function withPart(loaded: LoadedPantry, part: PantryIndicator): LoadedPantry {
  if (loaded.parts.has(part.indicator.id)) return loaded
  const parts = new Map(loaded.parts)
  parts.set(part.indicator.id, part)
  return { ...loaded, parts, view: viewOf(loaded.index, [...parts.values()]) }
}

/**
 * Loads the index, the geometry and the derived files, then the one series the URL asks for.
 *
 * Plan 13. Before the split this fetched every series — 272,475 gzipped bytes — before React
 * rendered anything, for an opening view that draws one indicator. Now it fetches the 6,433-byte
 * index alongside the geometry, works out from the URL which indicator is actually being shown,
 * and fetches that one: about 35,000 bytes to first paint.
 *
 * The indicator's own fetch cannot start until the index has arrived, because the index is what
 * says which indicator ids exist and which one is the default. That is one extra round trip on a
 * cold load, spent while the 36 kB topology is still in flight.
 */
export async function loadPantry(): Promise<LoadedPantry> {
  const [indexRes, topoRes, adjRes, bubbleRes, similarRes, factsRes] = await Promise.all([
    fetch(`${PANTRY}/data/index.json`),
    fetch(`${PANTRY}/geometry/municipalities.topo.json`),
    fetch(`${PANTRY}/geometry/adjacency.json`),
    fetch(`${PANTRY}/layout/bubbles.json`),
    fetch(`${PANTRY}/data/similar.json`),
    fetch(`${PANTRY}/data/facts.json`),
  ])
  if (
    !indexRes.ok ||
    !topoRes.ok ||
    !adjRes.ok ||
    !bubbleRes.ok ||
    !similarRes.ok ||
    !factsRes.ok
  ) {
    throw new Error('pantry files missing; run yarn kitchen publish')
  }
  const index = PantryIndex.parse(await indexRes.json())
  const adjacency = Adjacency.parse(await adjRes.json())
  const bubbles = Bubbles.parse(await bubbleRes.json())
  const similar = Similar.parse(await similarRes.json())
  const facts = Facts.parse(await factsRes.json())
  const topology = (await topoRes.json()) as MunicipalityTopology
  if (!Array.isArray(topology?.objects?.municipalities?.geometries)) {
    throw new Error(
      'public/pantry/geometry/municipalities.topo.json has no objects.municipalities.geometries array; run yarn kitchen publish',
    )
  }

  // The URL decides what to fetch, so it is read here rather than after the first render: the
  // alternative is rendering a map with no series in it and then replacing it.
  const meta = metaFrom(index)
  const opening = parseState(window.location.pathname, window.location.search, meta)
  const part = await fetchIndicatorPart(opening.indicator)
  const parts = new Map([[part.indicator.id, part]])

  return {
    view: viewOf(index, [part]),
    index,
    parts,
    topology,
    adjacency,
    bubbles,
    similar,
    facts,
  }
}
