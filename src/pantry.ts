import { PantryData } from '../shared/pantry'
import type { MunicipalityTopology } from '../shared/geometry'

/**
 * Loads the two pantry files the render check needs, straight from the public/pantry
 * directory (served at /pantry by Vite's publicDir). Both are validated against the
 * shared schemas so a malformed pantry fails loudly instead of rendering a broken map.
 *
 * Note: the topology has no zod schema (topojson-specification's shape is structural,
 * not a runtime contract the pipeline owns) so it is only checked to be present JSON;
 * shape errors will surface as path-drawing failures rather than a validation error.
 */
export async function loadPantry(): Promise<{ data: PantryData; topology: MunicipalityTopology }> {
  const [dataRes, topoRes] = await Promise.all([
    fetch('/pantry/data/indicators.json'),
    fetch('/pantry/geometry/municipalities.topo.json'),
  ])
  if (!dataRes.ok || !topoRes.ok) {
    throw new Error('pantry files missing; run yarn kitchen publish')
  }
  return {
    data: PantryData.parse(await dataRes.json()),
    topology: (await topoRes.json()) as MunicipalityTopology,
  }
}
