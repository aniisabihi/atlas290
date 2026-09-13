import { geoPath, type GeoPermissibleObjects } from 'd3-geo'
import { scaleThreshold } from 'd3-scale'
import { schemeBlues } from 'd3-scale-chromatic'
import { feature } from 'topojson-client'
import type { Indicator, PantryData } from '../shared/pantry'
import { FRAME, projection, type MunicipalityTopology } from '../shared/geometry'

/** Absence is not zero: null values get a neutral grey, never a slot in the blue scale. */
const NO_DATA_COLOUR = '#ddd'

export function pathsFor(topology: MunicipalityTopology): Array<{ code: string; d: string }> {
  const fc = feature(topology, topology.objects.municipalities)
  const path = geoPath(projection(topology))
  return fc.features.map((f) => ({
    code: f.properties!.code,
    d: path(f as GeoPermissibleObjects) ?? '',
  }))
}

export function colourFor(indicator: Indicator, value: number | null): string {
  if (value === null) return NO_DATA_COLOUR
  const n = indicator.scale.breaks.length + 1
  const scale = scaleThreshold<number, string>()
    .domain(indicator.scale.breaks)
    .range(schemeBlues[n] ?? schemeBlues[9]!)
  return scale(value)
}

export function RenderCheck({
  data,
  topology,
  year,
}: {
  data: PantryData
  topology: MunicipalityTopology
  year: number
}) {
  const indicator = data.indicators[0]!
  const series = data.series.find((s) => s.indicator === indicator.id)!
  const yi = series.years.indexOf(year)
  const names = new Map(data.municipalities.map((m) => [m.code, m.name]))
  const values = new Map(
    data.municipalities.map((m, i) => [m.code, series.values[i]?.[yi] ?? null]),
  )

  return (
    <svg
      viewBox={`0 0 ${FRAME[0]} ${FRAME[1]}`}
      style={{ height: '100vh' }}
      role="img"
      aria-label={`${indicator.name.en} ${year}`}
    >
      {pathsFor(topology).map((p) => {
        const value = values.get(p.code) ?? null
        const name = names.get(p.code)?.en ?? p.code
        return (
          <path
            key={p.code}
            d={p.d}
            fill={colourFor(indicator, value)}
            stroke="#fff"
            strokeWidth={0.5}
          >
            <title>{`${name}: ${value === null ? 'no data' : value.toLocaleString('en-US')}`}</title>
          </path>
        )
      })}
    </svg>
  )
}
