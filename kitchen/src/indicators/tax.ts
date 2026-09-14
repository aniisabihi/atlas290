import {
  Indicator,
  type IndicatorSeries,
  type Municipality,
  statusCode,
} from '../../../shared/pantry'
import { existed } from '../municipalities'
import { parseMetadata, type Selection, type TableMeta } from '../scb/client'
import {
  freezeData,
  freezeMetadata,
  type FreezeOpts,
  type FrozenData,
  type FrozenMeta,
} from '../scb/freeze'
import { toRows } from '../scb/jsonstat'
import {
  buildRows,
  resolveContentCode,
  values,
  type BuildContext,
  type IndicatorDefinition,
} from './registry'

export const TAX_TABLE = 'TAB2017'

/**
 * Tax rate's own year range: 2000-2026. SCB sets next year's rate in December of the year
 * before, so this genuinely runs one year beyond population's 1968-2025 (and every other
 * indicator's) coverage. This must NOT be replaced by `ctx.years` (population's own constant,
 * currently 1968-2025) — reusing it here would silently drop 2026 with nothing failing, since
 * a missing fetched year just reads as an ordinary "not yet published" cell rather than an
 * error. Defined locally instead, exactly as population.ts defines its own YEARS.
 */
export const TAX_YEARS = Array.from({ length: 2026 - 2000 + 1 }, (_, i) => 2000 + i)

/**
 * Swedish label SCB uses for the total (municipality + region) tax rate content code. Resolved
 * by label rather than hardcoded, per docs/decisions/0001-plan-1-build-decisions.md's trap 2 —
 * the same convention every indicator in this project uses.
 */
const TAX_CONTENT_LABEL = 'Skattesats, total kommunal'

export const TAX: Indicator = Indicator.parse({
  id: 'tax-rate',
  name: { sv: 'Kommunal skattesats', en: 'Municipal tax rate' },
  description: {
    sv: 'Total kommunal skattesats (till kommun och region), i procent av den beskattningsbara förvärvsinkomsten.',
    en: 'Total municipal tax rate (to municipality and region), percent of taxable earned income.',
  },
  unit: 'percent',
  priceBasis: 'none',
  scale: { kind: 'sequential', breaks: [] },
  coverage: { from: TAX_YEARS[0]!, to: TAX_YEARS[TAX_YEARS.length - 1]! },
  caveat: {
    sv: 'Avser den skattesats kommunen beslutat för december året före redovisningsåret. 2026 löper därför ett år före varje annan indikator i denna databas.',
    en: 'The rate the municipality set in December of the year before. 2026 therefore runs a year ahead of every other indicator in this dataset.',
  },
  sensitivity: 'none',
  sources: [{ table: TAX_TABLE, contentCode: 'OE0101D1', note: '2000–2026' }],
  derivation:
    'One SCB cell per municipality and year: the single "total kommunal" tax-rate content ' +
    'code, resolved by its stable Swedish label. TAB2017 has no dimension beyond Region and ' +
    'Tid, so there is nothing to select a total from and nothing to sum.',
})

/**
 * TAB2017's selection: region (filtered to the 290 four-digit municipality codes, dropping the
 * national and county rows the table also carries), the tax-rate content code resolved by
 * label, and the requested years. No Kon/Alder/Civilstand — this table has none.
 */
export function taxSelection(meta: TableMeta, years: string[]): Selection {
  return {
    Region: values(meta, 'Region').filter((c) => /^\d{4}$/.test(c)),
    ContentsCode: [resolveContentCode(meta, TAX_CONTENT_LABEL)],
    Tid: years,
  }
}

/** Maps each fetched region+year cell to its value. TAB2017 has exactly one row per key. */
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
 * Builds the columnar tax-rate series. Same status rule as population (ruling R16): a
 * municipality that did not yet exist gets null + 'did-not-exist' regardless of what SCB sent;
 * only once existed() is true do we look at the fetched value, and a missing cell (a year
 * outside what was fetched, or genuinely not yet published) becomes 'not-yet-published' rather
 * than silently absent. Unlike population, there is no perturbation status here — this table
 * carries no Cell Key Method note.
 */
export function buildTaxSeries(
  municipalities: Municipality[],
  chunks: FrozenData[],
  years: number[],
): IndicatorSeries {
  const rates = valueByRegionYear(chunks)
  const cells = buildRows(municipalities, years, (m, y) => {
    if (!existed(m.code, y)) {
      return { v: null as number | null, s: statusCode('did-not-exist') }
    }
    const v = rates.get(`${m.code}|${y}`) ?? null
    if (v === null) return { v: null, s: statusCode('not-yet-published') }
    return { v, s: statusCode('present') }
  })
  return {
    indicator: TAX.id,
    years,
    values: cells.map((r) => r.map((c) => c.v)),
    status: cells.map((r) => r.map((c) => c.s)),
  }
}

export async function buildTax(ctx: BuildContext): Promise<IndicatorSeries> {
  const meta = await freezeMetadata(TAX_TABLE, 'sv', ctx.freeze)
  const parsed = parseMetadata(TAX_TABLE, meta.response)
  const years = TAX_YEARS.map(String)
  const chunks = await freezeData(TAX_TABLE, taxSelection(parsed, years), 'sv', ctx.freeze)
  const series = buildTaxSeries(ctx.municipalities, chunks, TAX_YEARS)
  ctx.frozen.push(...chunks, meta)
  return series
}

export const taxDefinition: IndicatorDefinition = { indicator: TAX, build: buildTax }

/**
 * Standalone real-fetch entry point, mirroring population.ts's fetchPopulation — used for the
 * spike/verification run and by tax.test.ts, independent of the shared REGISTRY singleton.
 * Needs municipalities to already exist (population's own responsibility per registry.ts), so
 * this is only useful once ctx.municipalities has been seeded some other way; buildAll (which
 * runs population first) is the normal path in application code.
 */
export async function fetchTax(
  municipalities: Municipality[],
  opts: FreezeOpts = {},
): Promise<{ series: IndicatorSeries; frozen: Array<FrozenData | FrozenMeta> }> {
  const ctx: BuildContext = {
    municipalities,
    years: TAX_YEARS,
    freeze: opts,
    frozen: [],
    series: new Map(),
  }
  const series = await buildTax(ctx)
  return { series, frozen: ctx.frozen }
}
