import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { geoPath } from 'd3-geo'
import { feature } from 'topojson-client'
import type { GeoPermissibleObjects } from 'd3-geo'
import { FRAME, projection, type MunicipalityTopology } from '../../../shared/geometry'

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
      '-clean',
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
  for (const g of topology.objects.municipalities.geometries) {
    const f = feature(topology, g) as unknown as GeoPermissibleObjects
    const [x, y] = path.centroid(f)
    // Every real municipality geometry carries { code, name }; only a topojson NullObject
    // (never produced by our build) would leave `properties` untyped, hence the assertion.
    const props = g.properties as { code: string; name: string }
    out.set(props.code, [x / FRAME[0], y / FRAME[1]])
  }
  return out
}
