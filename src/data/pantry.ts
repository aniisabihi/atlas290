import { Adjacency, Bubbles, Facts, PantryData, Similar } from '../../shared/pantry'
import type { MunicipalityTopology } from '../../shared/geometry'

/**
 * Loads the six pantry files the site needs, straight from the public/pantry
 * directory (served at /pantry by Vite's publicDir).
 *
 * The indicator data is validated against the shared `PantryData` zod schema, so a
 * malformed data file fails loudly instead of rendering a broken map. The topology has
 * no schema of its own — there is no runtime TopoJSON schema anywhere in this repo, and
 * writing a full recursive one would be disproportionate for a file our own deterministic
 * pipeline generates, validates by municipality count, and commits. Instead it gets a
 * lightweight structural check: this loader only trusts that
 * `objects.municipalities.geometries` exists and is an array, and fails loudly, by name,
 * if it does not.
 */
export async function loadPantry(): Promise<{
  data: PantryData
  topology: MunicipalityTopology
  adjacency: Adjacency
  bubbles: Bubbles
  similar: Similar
  facts: Facts
}> {
  const [dataRes, topoRes, adjRes, bubbleRes, similarRes, factsRes] = await Promise.all([
    fetch('/pantry/data/indicators.json'),
    fetch('/pantry/geometry/municipalities.topo.json'),
    fetch('/pantry/geometry/adjacency.json'),
    fetch('/pantry/layout/bubbles.json'),
    fetch('/pantry/data/similar.json'),
    fetch('/pantry/data/facts.json'),
  ])
  if (!dataRes.ok || !topoRes.ok || !adjRes.ok || !bubbleRes.ok || !similarRes.ok || !factsRes.ok) {
    throw new Error('pantry files missing; run yarn kitchen publish')
  }
  const data = PantryData.parse(await dataRes.json())
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
  return { data, topology, adjacency, bubbles, similar, facts }
}
