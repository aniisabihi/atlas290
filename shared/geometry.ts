import { geoTransverseMercator, type GeoPermissibleObjects } from 'd3-geo'
import { feature } from 'topojson-client'
import type { GeometryCollection, Topology } from 'topojson-specification'

/**
 * Shared between kitchen (build.ts) and site: the render frame and projection must be
 * byte-identical on both sides, so this module may import only from d3-geo and
 * topojson-client — never from node:* — and stays usable in a browser. src/ must never
 * import from kitchen/; kitchen/ imports this file instead of the other way around.
 */

export type MunicipalityProps = { code: string; name: string }
export type MunicipalityTopology = Topology<{
  municipalities: GeometryCollection<MunicipalityProps>
  counties: GeometryCollection<{ code: string; name: string }>
}>

/** Render frame in pixels: 1000 wide, 2000 tall, matching Sweden's north-south extent. */
export const FRAME: [number, number] = [1000, 2000]

/** SWEREF 99 TM look-alike: transverse Mercator on the 15°E meridian. Used by kitchen and site. */
export function projection(topology: MunicipalityTopology) {
  const fc = feature(topology, topology.objects.municipalities) as unknown as GeoPermissibleObjects
  return geoTransverseMercator().rotate([-15, 0]).fitSize(FRAME, fc)
}
