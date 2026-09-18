import {
  Indicator,
  type IndicatorSeries,
  type Municipality,
  statusCode,
} from '../../../shared/pantry'
import { existed } from '../municipalities'
import { parseMetadata, type Selection, type TableMeta } from '../scb/client'
import { freezeData, freezeMetadata, type FrozenData } from '../scb/freeze'
import { toRows } from '../scb/jsonstat'
import {
  buildRows,
  resolveContentCode,
  totalOrDeclaredSum,
  values,
  type BuildContext,
  type IndicatorDefinition,
} from './registry'
// A plain `const` read (CKM_FROM), used only inside buildDensitySeries's default parameter and
// buildDensity's body — never at this module's own top level — so this is safe under the same
// circular-import reasoning registry.ts documents for populationDefinition: the read happens at
// call time, once every module has finished loading, not while population.ts and density.ts are
// still being linked.
import { CKM_FROM } from './population'
import { buildDefined, type Definition } from './define'

export const DENSITY_TABLE = 'TAB628'

/**
 * Density's own year range: 1991-2025, per the plan's verified-facts table. Distinct from
 * population's 1968-2025 (`ctx.years`) — defined locally, exactly as population.ts and tax.ts
 * define their own, rather than borrowed from ctx.years by analogy.
 */
export const DENSITY_YEARS = Array.from({ length: 2025 - 1991 + 1 }, (_, i) => 1991 + i)

/**
 * Swedish labels SCB uses for TAB628's two content codes this indicator needs. TAB628 also
 * carries a third, "Folkmängd" (population), which must never be picked by accident — resolving
 * by label rather than array position or "the first code" is what prevents that.
 */
const DENSITY_CONTENT_LABEL = 'Invånare per kvadratkilometer'
const LAND_AREA_CONTENT_LABEL = 'Landareal i kvadratkilometer'

export const DENSITY: Indicator = Indicator.parse({
  id: 'density',
  name: { sv: 'Befolkningstäthet', en: 'Population density' },
  description: {
    sv: 'Antal invånare per kvadratkilometer landareal.',
    en: 'Number of residents per square kilometre of land area.',
  },
  unit: 'per-km2',
  priceBasis: 'none',
  scale: { kind: 'sequential', breaks: [] },
  coverage: { from: DENSITY_YEARS[0]!, to: DENSITY_YEARS[DENSITY_YEARS.length - 1]! },
  caveat: {
    sv: 'Befolkningen den 31 december ställs i relation till landarealen den 1 januari året därpå. Från 2025 innehåller värdena en liten slumpmässig störning från SCB, eftersom måttet grundas på befolkningen.',
    en: 'Population on 31 December is set against the land area on 1 January the following year. From 2025 the values carry a small random perturbation added by SCB, because the measure is based on population.',
  },
  sensitivity: 'none',
  sources: [{ table: DENSITY_TABLE, contentCode: 'BE0101U1', note: '1991–2025' }],
  derivation:
    'One SCB total cell per municipality and year: the density content code at the "1+2" sex ' +
    "total, resolved by label — selected, never derived by dividing this project's own " +
    'population figure by area, since SCB already publishes the ratio directly.',
})

/**
 * TAB628's density selection: the 4-digit municipality codes, the Kon total ('1+2', ruling R1 —
 * selected instead of summing the two sexes), the density content code resolved by label, and
 * the requested years.
 */
export function densitySelection(meta: TableMeta, years: string[]): Selection {
  return {
    Region: values(meta, 'Region').filter((c) => /^\d{4}$/.test(c)),
    Kon: totalOrDeclaredSum(meta, 'Kon'),
    ContentsCode: [resolveContentCode(meta, DENSITY_CONTENT_LABEL)],
    Tid: years,
  }
}

/**
 * TAB628's land-area selection, for filling `Municipality.landAreaKm2` (optional since Plan 1).
 * Same table, same Region/Kon/Tid shape as densitySelection, differing only in ContentsCode —
 * land area does not vary by sex, but the table still requires a Kon value to be selected, and
 * the '1+2' total carries the same figure as either sex alone.
 */
export function landAreaSelection(meta: TableMeta, years: string[]): Selection {
  return {
    Region: values(meta, 'Region').filter((c) => /^\d{4}$/.test(c)),
    Kon: totalOrDeclaredSum(meta, 'Kon'),
    ContentsCode: [resolveContentCode(meta, LAND_AREA_CONTENT_LABEL)],
    Tid: years,
  }
}

/**
 * Maps each fetched region+year cell to its value. Density and land area are fetched as
 * separate selections (each with its own single ContentsCode; see buildDensity), so — unlike a
 * hypothetical combined fetch — a chunk passed here never mixes two different content codes
 * under the same region+year key.
 */
function valueByRegionYear(chunks: FrozenData[]): Map<string, number | null> {
  const map = new Map<string, number | null>()
  for (const chunk of chunks) {
    for (const r of toRows(chunk.response)) {
      map.set(`${r.dims.Region}|${r.dims.Tid}`, r.value)
    }
  }
  return map
}

/**
 * Builds the columnar density series. Same status rule as population and tax rate: existed()
 * gates before the value is even looked at (ruling R16), and a missing cell is
 * 'not-yet-published' rather than silently absent. Unlike tax rate, density IS derived from
 * population and so carries the same Cell Key Method perturbation from `perturbedFrom`
 * (defaults to population's real CKM_FROM, 2025) onward — confirmed against TAB628's own
 * "slumpmässig osäkerhet" note, not merely assumed by analogy.
 */
export function buildDensitySeries(
  municipalities: Municipality[],
  chunks: FrozenData[],
  years: number[],
  perturbedFrom: number = CKM_FROM,
): IndicatorSeries {
  const density = valueByRegionYear(chunks)
  const cells = buildRows(municipalities, years, (m, y) => {
    if (!existed(m.code, y)) {
      return { v: null as number | null, s: statusCode('did-not-exist') }
    }
    const v = density.get(`${m.code}|${y}`) ?? null
    if (v === null) return { v: null, s: statusCode('not-yet-published') }
    return { v, s: y >= perturbedFrom ? statusCode('perturbed') : statusCode('present') }
  })
  return {
    indicator: DENSITY.id,
    years,
    values: cells.map((r) => r.map((c) => c.v)),
    status: cells.map((r) => r.map((c) => c.s)),
  }
}

/**
 * Fills Municipality.landAreaKm2 in place from TAB628's land-area content code — the same table
 * that carries density also carries this, so it costs one extra fetch rather than a second
 * table. Uses the newest year with a real (non-null) value per municipality: land area is a
 * current administrative fact, not a time series anyone reads historically here, so there is no
 * reason to prefer an older figure once a newer one exists.
 */
export function fillLandArea(
  municipalities: Municipality[],
  chunks: FrozenData[],
  years: number[],
): void {
  const area = valueByRegionYear(chunks)
  for (const m of municipalities) {
    for (let i = years.length - 1; i >= 0; i--) {
      const v = area.get(`${m.code}|${years[i]}`)
      if (v != null) {
        m.landAreaKm2 = v
        break
      }
    }
  }
}

export async function buildDensity(ctx: BuildContext): Promise<IndicatorSeries> {
  const meta = await freezeMetadata(DENSITY_TABLE, 'sv', ctx.freeze)
  const parsed = parseMetadata(DENSITY_TABLE, meta.response)
  const years = DENSITY_YEARS.map(String)
  const areaChunks = await freezeData(
    DENSITY_TABLE,
    landAreaSelection(parsed, years),
    'sv',
    ctx.freeze,
  )
  const series = await buildDefined(densityDefined(), ctx)
  fillLandArea(ctx.municipalities, areaChunks, DENSITY_YEARS)
  // The density chunks and this table's metadata are recorded by buildDefined; only the
  // land-area fetch, which no definition describes, is this module's own to record.
  ctx.frozen.push(...areaChunks)
  return series
}

/**
 * Density, as a definition (Plan 14).
 *
 * TAB628's `Kon` carries its own total code, `1+2`, so this selects it rather than summing the
 * two sexes — ruling R1, and the reason `TOTAL_CODES` exists at all.
 *
 * The land-area fetch stays in `buildDensity` below rather than moving here: it fills
 * `Municipality.landAreaKm2` as a side effect and publishes no series of its own, so it is not
 * something a definition describes.
 */
export function densityDefined(): Definition {
  return {
    indicator: DENSITY,
    sources: [
      {
        table: DENSITY_TABLE,
        content: DENSITY_CONTENT_LABEL,
        years: DENSITY_YEARS,
        dims: { Kon: 'total' },
      },
    ],
    spec: { kind: 'direct' },
    perturbedFrom: CKM_FROM,
  }
}

export const densityDefinition: IndicatorDefinition = { indicator: DENSITY, build: buildDensity }
