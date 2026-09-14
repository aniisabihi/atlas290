import { geoPath, type GeoPermissibleObjects } from 'd3-geo'
import { feature } from 'topojson-client'
import { FRAME, projection, type MunicipalityTopology } from '../../shared/geometry'

/**
 * Projected shapes and centroids, computed once per topology.
 *
 * The map draws 290 paths and the year slider moves 59 times. Reprojecting on every render
 * would redo the whole country's geometry for a change that only ever alters a fill colour, so
 * these are memoised by topology identity — the topology is loaded once and never replaced.
 */

export type MunicipalityShape = {
  code: string
  /** SVG path data in the shared render frame. */
  d: string
  /** Centroid in the same frame. Screen coordinates: y grows downwards, so north is smaller y. */
  centroid: [number, number]
}

const cache = new WeakMap<MunicipalityTopology, MunicipalityShape[]>()

export function shapesFor(topology: MunicipalityTopology): MunicipalityShape[] {
  const cached = cache.get(topology)
  if (cached) return cached

  const collection = feature(topology, topology.objects.municipalities)
  const path = geoPath(projection(topology))
  const shapes = collection.features.map((f) => {
    const code = f.properties?.code
    if (!code) throw new Error('a municipality in the topology has no code property')
    const d = path(f as GeoPermissibleObjects)
    if (!d) throw new Error(`${code}: projected to an empty path`)
    const [x, y] = path.centroid(f as GeoPermissibleObjects)
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new Error(`${code}: centroid is not a finite point`)
    }
    return { code, d, centroid: [x, y] satisfies [number, number] }
  })

  cache.set(topology, shapes)
  return shapes
}

export { FRAME }
