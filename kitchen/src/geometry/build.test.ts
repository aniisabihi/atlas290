import { geoPath } from 'd3-geo'
import type { GeoPermissibleObjects } from 'd3-geo'
import { feature } from 'topojson-client'
import { describe, expect, it } from 'vitest'
import { FRAME, projection } from '../../../shared/geometry'
import type { MunicipalityTopology } from '../../../shared/geometry'
import { centroids } from './build'

/**
 * Two 1x1 squares placed far apart in BOTH longitude and latitude — one south-west, one
 * north-east — so a transposed x/y axis, or a wrong divisor, changes both coordinates
 * measurably instead of cancelling out by coincidence. Coordinates are plausible lon/lat
 * degrees (not arbitrary numbers) since `projection()` runs a real transverse Mercator.
 */
// Ring winding matters here (unlike the plain-adjacency fixtures elsewhere, which never go
// through a real geographic projection): d3-geo needs the exterior ring wound so the small
// square is "inside", or `path.centroid`/`path.area` treat it as the complement of the square
// covering the whole map instead. Verified empirically against d3-geo's own output.
const topology: MunicipalityTopology = {
  type: 'Topology',
  arcs: [
    [
      [10, 55],
      [10, 56],
      [11, 56],
      [11, 55],
      [10, 55],
    ],
    [
      [20, 65],
      [20, 68],
      [21, 68],
      [21, 65],
      [20, 65],
    ],
  ],
  objects: {
    municipalities: {
      type: 'GeometryCollection',
      geometries: [
        { type: 'Polygon', arcs: [[0]], properties: { code: '0001', name: 'South-west' } },
        { type: 'Polygon', arcs: [[1]], properties: { code: '0002', name: 'North-east' } },
      ],
    },
    counties: { type: 'GeometryCollection', geometries: [] },
  },
} as unknown as MunicipalityTopology

describe('centroids', () => {
  it('normalises each projected centroid by FRAME width for x and FRAME height for y', () => {
    // Computed independently of centroids()'s internals, from the same primitives (the
    // shared `projection` and `FRAME`) it is built from — a stand-in for "known centroid
    // positions" since the true SWEREF-projected pixel values are otherwise only knowable
    // by running exactly this code.
    const proj = projection(topology)
    const path = geoPath(proj)
    const result = centroids(topology)
    expect(result.size).toBe(2)

    for (const g of topology.objects.municipalities.geometries) {
      const f = feature(topology, g) as unknown as GeoPermissibleObjects
      const [px, py] = path.centroid(f)
      const code = (g.properties as { code: string }).code
      const [x, y] = result.get(code)!
      expect(x).toBeCloseTo(px / FRAME[0], 9)
      expect(y).toBeCloseTo(py / FRAME[1], 9)
    }
  })

  it('places the south-west municipality left of and below the north-east one on screen (known relative position)', () => {
    const result = centroids(topology)
    const [xSW, ySW] = result.get('0001')!
    const [xNE, yNE] = result.get('0002')!
    expect(xSW).toBeLessThan(xNE) // west of
    expect(ySW).toBeGreaterThan(yNE) // south of (screen y grows downward)
  })

  it('would fail if the x and y divisors were swapped — FRAME is not square (1000×2000)', () => {
    expect(FRAME[0]).not.toBe(FRAME[1])
    const proj = projection(topology)
    const path = geoPath(proj)
    const result = centroids(topology)

    for (const g of topology.objects.municipalities.geometries) {
      const f = feature(topology, g) as unknown as GeoPermissibleObjects
      const [px, py] = path.centroid(f)
      const code = (g.properties as { code: string }).code
      const [x, y] = result.get(code)!
      const swappedX = px / FRAME[1]
      const swappedY = py / FRAME[0]
      expect(x).not.toBeCloseTo(swappedX, 6)
      expect(y).not.toBeCloseTo(swappedY, 6)
    }
  })
})
