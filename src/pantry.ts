import { PantryData } from '../shared/pantry'
import type { MunicipalityTopology } from '../shared/geometry'

/**
 * Loads the two pantry files the render check needs, straight from the public/pantry
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
export async function loadPantry(): Promise<{ data: PantryData; topology: MunicipalityTopology }> {
  const [dataRes, topoRes] = await Promise.all([
    fetch('/pantry/data/indicators.json'),
    fetch('/pantry/geometry/municipalities.topo.json'),
  ])
  if (!dataRes.ok || !topoRes.ok) {
    throw new Error('pantry files missing; run yarn kitchen publish')
  }
  const data = PantryData.parse(await dataRes.json())
  const topology = (await topoRes.json()) as MunicipalityTopology
  if (!Array.isArray(topology?.objects?.municipalities?.geometries)) {
    throw new Error(
      'public/pantry/geometry/municipalities.topo.json has no objects.municipalities.geometries array; run yarn kitchen publish',
    )
  }
  return { data, topology }
}
