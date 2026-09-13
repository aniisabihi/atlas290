import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { geoPath } from 'd3-geo'
import { feature } from 'topojson-client'
import type { GeoPermissibleObjects } from 'd3-geo'
import { FRAME, projection, type MunicipalityTopology } from '../../../shared/geometry'
import { municipalityProps } from './props'

export type { MunicipalityProps, MunicipalityTopology } from '../../../shared/geometry'
export { FRAME, projection } from '../../../shared/geometry'

export async function buildTopology(
  opts: { rawDir?: string; outFile?: string } = {},
): Promise<MunicipalityTopology> {
  const rawDir = opts.rawDir ?? 'kitchen/raw/geometry/shape'
  const outFile = opts.outFile ?? 'public/pantry/geometry/municipalities.topo.json'
  mkdirSync(dirname(outFile), { recursive: true })
  execFileSync(
    'yarn',
    [
      'mapshaper',
      '-i',
      `${rawDir}/Kommun_Sweref99TM.shp`,
      `${rawDir}/Lan_Sweref99TM_region.shp`,
      'combine-files',
      '-proj',
      'wgs84',
      // gap-width pinned explicitly rather than left on mapshaper's "automatic" default
      // (review finding 1): on the real SCB shapefile this removes 3 of 10 detected
      // slivers ("[clean] Removed 3 of 10 slivers using 1.5km width threshold"). 1.5km is
      // far below the size of any real municipality feature, so this is digitisation
      // noise cleanup, not a loss of real thematic boundary detail — but the value is
      // now a decision recorded in source control, not whatever mapshaper's heuristic
      // happens to compute from the data on a given run/version.
      '-clean',
      'gap-width=1.5km',
      '-rename-layers',
      'municipalities,counties',
      '-rename-fields',
      'target=municipalities',
      'code=KnKod,name=KnNamn',
      '-rename-fields',
      'target=counties',
      'code=LnKod,name=LnNamn',
      '-o',
      'target=municipalities,counties',
      outFile,
      'format=topojson',
      'quantization=1e5',
    ],
    { stdio: 'inherit' },
  )
  return JSON.parse(readFileSync(outFile, 'utf8')) as MunicipalityTopology
}

export function centroids(topology: MunicipalityTopology): Map<string, [number, number]> {
  const proj = projection(topology)
  const path = geoPath(proj)
  const out = new Map<string, [number, number]>()
  topology.objects.municipalities.geometries.forEach((g, i) => {
    const f = feature(topology, g) as unknown as GeoPermissibleObjects
    const [x, y] = path.centroid(f)
    const { code } = municipalityProps(g, i)
    out.set(code, [x / FRAME[0], y / FRAME[1]])
  })
  return out
}
