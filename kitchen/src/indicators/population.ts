import {
  Indicator,
  type IndicatorSeries,
  type Municipality,
  statusCode,
} from '../../../shared/pantry'
import { existed, municipalitiesFromMetadata } from '../municipalities'
import { buildDefined, type Definition } from './define'
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
  totalOrDeclaredSum,
  values,
  quantileBreaks,
  withBreaks,
  type BuildContext,
  type IndicatorDefinition,
} from './registry'
import { neutral } from './prose'

// Re-exported so existing callers (population.test.ts, publish.ts) keep working unchanged:
// both now live in registry.ts as shared machinery every indicator needs, not just population.
export { quantileBreaks, withBreaks }

export const OLD_TABLE = 'TAB638' // 1968–2024
export const NEW_TABLE = 'TAB5557' // 2025– with Cell Key Method noise

/**
 * First year SCB applies Cell Key Method noise and starts publishing from NEW_TABLE instead
 * of OLD_TABLE. This is a fact about SCB's disclosure control method, not about how much data
 * has been published — it changes only if SCB changes that method, never on a routine data
 * refresh. Three things key off it: the old/new table split in fetchPopulation, the
 * 'perturbed' status predicate in buildPopulationSeries, and the bubble layout's "last
 * stable, unperturbed year" reference in publish.ts. Do NOT bump this to add a new year's
 * data — that is LATEST_YEAR's job. Bumping CKM_FROM instead would silently relabel the
 * current CKM_FROM year as unperturbed (wrong: SCB still perturbs it) and ask OLD_TABLE
 * (which stops at 2024) for a year it does not have.
 */
export const CKM_FROM = 2025

/**
 * Newest reference year actually published in the pantry. Bumped every data refresh (e.g. to
 * 2026 once SCB publishes that year) — unlike CKM_FROM, which stays fixed across refreshes.
 * YEARS and the indicator's coverage.to are derived from this, so adding a year is a one-line
 * change here rather than a change to the perturbation cutoff.
 */
export const LATEST_YEAR = 2025

/**
 * Swedish label SCB uses for the "population count" content code in both tables. The code
 * ITSELF differs between tables (BE0101N1 in TAB638, 000007ME in TAB5557 — ruling R17), so
 * resolving by label at run time, per table, is what lets the code adapt if SCB ever changes
 * a codelist, rather than hardcoding one content code across both tables.
 */
const POPULATION_CONTENT_LABEL = 'Folkmängd'

export const POPULATION: Indicator = Indicator.parse({
  id: 'population',
  name: { sv: 'Folkmängd', en: 'Population' },
  description: {
    sv: 'Antal folkbokförda invånare den 31 december.',
    en: 'Registered residents on 31 December.',
  },
  unit: 'count',
  priceBasis: 'none',
  scale: { kind: 'sequential', breaks: [] },
  coverage: { from: 1968, to: LATEST_YEAR },
  caveat: {
    sv: 'Från 2025 innehåller värdena en liten slumpmässig störning från SCB, så summor stämmer inte alltid exakt.',
    en: 'From 2025 the values carry a small random perturbation added by SCB, so sums need not match exactly.',
  },
  sensitivity: 'none',
  sources: [
    { table: OLD_TABLE, contentCode: 'BE0101N1', note: neutral('1968–2024') },
    {
      table: NEW_TABLE,
      contentCode: '000007ME',
      note: { sv: '2025 och framåt, CKM', en: '2025 onwards, CKM' },
    },
  ],
  derivation: {
    sv:
      'En SCB-totalcell per kommun och år: totalkoden för ålder, kön och civilstånd där ' +
      'tabellen har en, annars en summa över de återstående (disjunkta, ostörda) värdena. ' +
      'Aldrig en summa av redan aggregerade eller störda celler.',
    en:
      'One SCB total cell per municipality and year: the age/sex/civil-status total code where ' +
      'the table has one, otherwise summed over the (disjoint, unperturbed) remaining values. ' +
      'Never a sum of already-aggregated or perturbed cells.',
  },
})

/**
 * Total population per municipality and year. Selects exactly one total cell per dimension
 * wherever SCB provides one, and never sums perturbed or already-aggregated cells (ruling R17).
 * Where a dimension has no total (TAB638's Kon and Civilstand), all its values are selected and
 * summed — safe there because those values are disjoint and unperturbed before 2025.
 */
export function populationSelection(meta: TableMeta, years: string[]): Selection {
  const sel: Selection = {
    Region: values(meta, 'Region').filter((c) => /^\d{4}$/.test(c)),
    Alder: totalOrDeclaredSum(meta, 'Alder'),
    Kon: totalOrDeclaredSum(meta, 'Kon'),
    ContentsCode: [resolveContentCode(meta, POPULATION_CONTENT_LABEL)],
    Tid: years,
  }
  if (meta.variables.some((x) => x.code === 'Civilstand')) {
    sel.Civilstand = totalOrDeclaredSum(meta, 'Civilstand')
  }
  return sel
}

/**
 * Sums SCB cell values per municipality+year. Review finding 4: if the constituent rows for a
 * key are a MIX of null and real values (a partial SCB publication), the result must be null —
 * never a partial sum silently presented as the complete total, and never dependent on the
 * order rows happen to arrive in. A key that is either fully null or fully real behaves as
 * before (null, or the real sum, respectively).
 */
function sumByRegionYear(chunks: FrozenData[]): Map<string, number | null> {
  const acc = new Map<string, { sum: number; sawNull: boolean; sawValue: boolean }>()
  for (const chunk of chunks) {
    for (const r of toRows(chunk.response)) {
      const key = `${r.dims.Region}|${r.dims.Tid}`
      const entry = acc.get(key) ?? { sum: 0, sawNull: false, sawValue: false }
      if (r.value === null) {
        entry.sawNull = true
      } else {
        entry.sum += r.value
        entry.sawValue = true
      }
      acc.set(key, entry)
    }
  }
  const totals = new Map<string, number | null>()
  for (const [key, entry] of acc) {
    totals.set(key, entry.sawNull ? null : entry.sum)
  }
  return totals
}

/**
 * Builds the columnar indicator series. Ruling R16: absence must beat the value — a
 * municipality that did not yet exist gets null + 'did-not-exist' regardless of what SCB sent
 * (SCB sends literal 0, not null, before a municipality exists; that 0 is discarded here).
 * Only once existed() is true do we look at the value: null means not yet published, a real
 * value from 2025 onward is perturbed (CKM), otherwise it is present.
 */
export function buildPopulationSeries(
  municipalities: Municipality[],
  oldChunks: FrozenData[],
  newChunks: FrozenData[],
  years: number[],
  perturbedFrom: number = CKM_FROM,
): IndicatorSeries {
  const totals = new Map([...sumByRegionYear(oldChunks), ...sumByRegionYear(newChunks)])
  const cells = buildRows(municipalities, years, (m, y) => {
    if (!existed(m.code, y)) {
      return { v: null as number | null, s: statusCode('did-not-exist') }
    }
    const v = totals.get(`${m.code}|${y}`) ?? null
    if (v === null) {
      return { v: null, s: statusCode('not-yet-published') }
    }
    return { v, s: y >= perturbedFrom ? statusCode('perturbed') : statusCode('present') }
  })
  return {
    indicator: POPULATION.id,
    years,
    values: cells.map((r) => r.map((c) => c.v)),
    status: cells.map((r) => r.map((c) => c.s)),
  }
}

export const YEARS = Array.from({ length: LATEST_YEAR - 1968 + 1 }, (_, i) => 1968 + i)

/**
 * Fetches population and, as a side effect, derives the 290-municipality registry into
 * `ctx.municipalities` (mutated in place, not reassigned) — population is the identity
 * authority (docs/decisions/0001-plan-1-build-decisions.md), so this must run before any
 * other definition in REGISTRY.
 */
export async function buildPopulation(ctx: BuildContext): Promise<IndicatorSeries> {
  const [svMeta, enMeta, newMeta] = await Promise.all([
    freezeMetadata(OLD_TABLE, 'sv', ctx.freeze),
    freezeMetadata(OLD_TABLE, 'en', ctx.freeze),
    freezeMetadata(NEW_TABLE, 'sv', ctx.freeze),
  ])
  const municipalities = municipalitiesFromMetadata(svMeta, enMeta)
  ctx.municipalities.splice(0, ctx.municipalities.length, ...municipalities)

  const oldYears = ctx.years.filter((y) => y < CKM_FROM).map(String)
  const newYears = ctx.years.filter((y) => y >= CKM_FROM).map(String)
  const oldChunks = await freezeData(
    OLD_TABLE,
    populationSelection(parseMetadata(OLD_TABLE, svMeta.response), oldYears),
    'sv',
    ctx.freeze,
  )
  const newChunks = await freezeData(
    NEW_TABLE,
    populationSelection(parseMetadata(NEW_TABLE, newMeta.response), newYears),
    'sv',
    ctx.freeze,
  )
  void oldChunks
  void newChunks
  void newMeta
  const series = await buildDefined(populationDefined(), ctx)

  // Ruling R2: every frozen chunk and metadata response involved in producing this series is
  // recorded, so the provenance manifest can be built from ctx.frozen without reopening this
  // module. buildDefined records both tables' chunks and their Swedish metadata; the ENGLISH
  // metadata is this module's own, read to give each municipality its English name, and nothing
  // else would record it.
  ctx.frozen.push(enMeta)
  return series
}

/**
 * Population, as a definition (Plan 14) — the first stitched one.
 *
 * TAB638 runs to 2024 and the Cell Key Method table TAB5557 from 2025, so the new table is listed
 * last and wins any year both publish. Neither `Kon` nor `Civilstand` has a total code on either
 * table, which is exactly what `SUM_SAFE` declares verified for them.
 *
 * Deriving the 290 municipalities from TAB638's own metadata stays in `buildPopulation` below:
 * it is this indicator's other job, and it is not something a definition describes.
 */
export function populationDefined(): Definition {
  return {
    indicator: POPULATION,
    sources: [
      {
        table: OLD_TABLE,
        content: POPULATION_CONTENT_LABEL,
        years: YEARS.filter((y) => y < CKM_FROM),
        dims: { Alder: 'total', Kon: 'total', Civilstand: 'total' },
      },
      {
        table: NEW_TABLE,
        content: POPULATION_CONTENT_LABEL,
        years: YEARS.filter((y) => y >= CKM_FROM),
        dims: { Alder: 'total', Kon: 'total', Civilstand: 'total' },
      },
    ],
    spec: { kind: 'direct' },
    perturbedFrom: CKM_FROM,
  }
}

export const populationDefinition: IndicatorDefinition = {
  indicator: POPULATION,
  build: buildPopulation,
}

export async function fetchPopulation(opts: FreezeOpts = {}): Promise<{
  municipalities: Municipality[]
  indicator: Indicator
  series: IndicatorSeries
  frozen: Array<FrozenData | FrozenMeta>
}> {
  const ctx: BuildContext = {
    municipalities: [],
    years: YEARS,
    freeze: opts,
    frozen: [],
    series: new Map(),
  }
  const series = await buildPopulation(ctx)
  return {
    municipalities: ctx.municipalities,
    indicator: withBreaks(POPULATION, series),
    series,
    frozen: ctx.frozen,
  }
}
