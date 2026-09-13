import {
  Indicator,
  type IndicatorSeries,
  type Municipality,
  statusCode,
} from '../../../shared/pantry'
import { existed, municipalitiesFromMetadata } from '../municipalities'
import { parseMetadata, type Selection, type TableMeta } from '../scb/client'
import {
  freezeData,
  freezeMetadata,
  type FreezeOpts,
  type FrozenData,
  type FrozenMeta,
} from '../scb/freeze'
import { toRows } from '../scb/jsonstat'

export const OLD_TABLE = 'TAB638' // 1968–2024
export const NEW_TABLE = 'TAB5557' // 2025– with Cell Key Method noise
export const CKM_FROM = 2025

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
  coverage: { from: 1968, to: CKM_FROM },
  caveat: {
    sv: 'Från 2025 innehåller värdena en liten slumpmässig störning från SCB, så summor stämmer inte alltid exakt.',
    en: 'From 2025 the values carry a small random perturbation added by SCB, so sums need not match exactly.',
  },
  sensitivity: 'none',
  sources: [
    { table: OLD_TABLE, contentCode: 'BE0101N1', note: '1968–2024' },
    { table: NEW_TABLE, contentCode: '000007ME', note: '2025 onwards, CKM' },
  ],
  derivation:
    'One SCB total cell per municipality and year: the age/sex/civil-status total code where ' +
    'the table has one, otherwise summed over the (disjoint, unperturbed) remaining values. ' +
    'Never a sum of already-aggregated or perturbed cells.',
})

function variable(meta: TableMeta, code: string) {
  const v = meta.variables.find((x) => x.code === code)
  if (!v)
    throw new Error(
      `${meta.id}: no variable ${code}; have ${meta.variables.map((x) => x.code).join(', ')}`,
    )
  return v
}

function values(meta: TableMeta, code: string): string[] {
  return variable(meta, code).values.map((x) => x.code)
}

/** Recognised total codes per dimension. Any one of these, if present, is used alone. */
const TOTAL_CODES: Record<'Alder' | 'Kon' | 'Civilstand', string[]> = {
  Alder: ['tot', 'TotSA', 'TOT1'],
  Kon: ['TotSa'],
  Civilstand: ['SC'],
}

/**
 * Table+dimension pairs where summing every value (because no total code exists) has been
 * verified safe — the values are disjoint and unperturbed, so their sum equals the true total.
 * This is an explicit opt-in allowlist (review finding 3), not a fallback every table gets by
 * default: an unlisted table with no recognised total throws instead of silently summing,
 * because ruling R17 exists precisely because summing an unverified set of "everything" can
 * silently overcount by a large multiple (as it would for TAB5557's Alder/Kon/Civilstand).
 * TAB638's Kon and Civilstand are declared here because the Task 6 spike verified they carry
 * no Cell Key Method noise and partition every person exactly once.
 */
const SUM_SAFE: Record<string, Array<'Alder' | 'Kon' | 'Civilstand'>> = {
  [OLD_TABLE]: ['Kon', 'Civilstand'],
}

/**
 * Selects the single total-code value for a dimension where the table declares one (ruling
 * R17), else falls back to summing every value ONLY where that has been explicitly declared
 * safe for this exact table in `SUM_SAFE` (review finding 3). Anything else — an unrecognised
 * total AND no declared-safe entry — throws loudly, naming the table, the dimension and its
 * values, rather than silently summing an unverified set of cells.
 */
function totalOrDeclaredSum(meta: TableMeta, dim: 'Alder' | 'Kon' | 'Civilstand'): string[] {
  const vals = values(meta, dim)
  for (const total of TOTAL_CODES[dim]) {
    if (vals.includes(total)) return [total]
  }
  if (SUM_SAFE[meta.id]?.includes(dim)) return vals
  throw new Error(
    `${meta.id}: dimension ${dim} has no recognised total code (looked for ` +
      `${TOTAL_CODES[dim].join(', ')}) and summing ${meta.id}.${dim} is not declared safe in ` +
      `SUM_SAFE; refusing to silently sum an unverified set of cells. Values were: ` +
      `${vals.join(', ')}`,
  )
}

/**
 * Resolves the population ContentsCode from the table's own metadata, by label, per table.
 * Throws if no code carries the label (wrong table/label drift) or if more than one does
 * (review finding 2: an ambiguous match must never be silently resolved by array order).
 */
function contentsCodeSelection(meta: TableMeta): string[] {
  const v = variable(meta, 'ContentsCode')
  const matches = v.values.filter((x) => x.label === POPULATION_CONTENT_LABEL)
  if (matches.length === 0) {
    throw new Error(
      `${meta.id}: no ContentsCode labelled '${POPULATION_CONTENT_LABEL}'; have ${v.values
        .map((x) => `${x.code}=${x.label}`)
        .join(', ')}`,
    )
  }
  if (matches.length > 1) {
    throw new Error(
      `${meta.id}: ${matches.length} ContentsCode values are labelled ` +
        `'${POPULATION_CONTENT_LABEL}' (${matches.map((x) => x.code).join(', ')}) — ambiguous, ` +
        `pick one explicitly instead of silently taking the first`,
    )
  }
  return [matches[0]!.code]
}

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
    ContentsCode: contentsCodeSelection(meta),
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
): IndicatorSeries {
  const totals = new Map([...sumByRegionYear(oldChunks), ...sumByRegionYear(newChunks)])
  const rows = municipalities.map((m) =>
    years.map((y) => {
      if (!existed(m.code, y)) {
        return { v: null as number | null, s: statusCode('did-not-exist') }
      }
      const v = totals.get(`${m.code}|${y}`) ?? null
      if (v === null) {
        return { v: null, s: statusCode('not-yet-published') }
      }
      return { v, s: y >= CKM_FROM ? statusCode('perturbed') : statusCode('present') }
    }),
  )
  return {
    indicator: POPULATION.id,
    years,
    values: rows.map((r) => r.map((c) => c.v)),
    status: rows.map((r) => r.map((c) => c.s)),
  }
}

export function quantileBreaks(nums: number[], classes: number): number[] {
  const sorted = [...nums].sort((a, b) => a - b)
  const at = (p: number) => {
    const pos = p * (sorted.length - 1)
    const lo = Math.floor(pos)
    const hi = Math.ceil(pos)
    const frac = pos - lo
    return (sorted[lo] ?? 0) * (1 - frac) + (sorted[hi] ?? 0) * frac
  }
  return Array.from({ length: classes - 1 }, (_, i) => at((i + 1) / classes))
}

export function withBreaks(indicator: Indicator, series: IndicatorSeries, classes = 7): Indicator {
  const all = series.values.flat().filter((v): v is number => v !== null)
  return { ...indicator, scale: { ...indicator.scale, breaks: quantileBreaks(all, classes) } }
}

export const YEARS = Array.from({ length: CKM_FROM - 1968 + 1 }, (_, i) => 1968 + i)

export async function fetchPopulation(opts: FreezeOpts = {}): Promise<{
  municipalities: Municipality[]
  indicator: Indicator
  series: IndicatorSeries
  frozen: Array<FrozenData | FrozenMeta>
}> {
  const [svMeta, enMeta, newMeta] = await Promise.all([
    freezeMetadata(OLD_TABLE, 'sv', opts),
    freezeMetadata(OLD_TABLE, 'en', opts),
    freezeMetadata(NEW_TABLE, 'sv', opts),
  ])
  const municipalities = municipalitiesFromMetadata(svMeta, enMeta)
  const oldYears = YEARS.filter((y) => y < CKM_FROM).map(String)
  const newYears = YEARS.filter((y) => y >= CKM_FROM).map(String)
  const oldChunks = await freezeData(
    OLD_TABLE,
    populationSelection(parseMetadata(OLD_TABLE, svMeta.response), oldYears),
    'sv',
    opts,
  )
  const newChunks = await freezeData(
    NEW_TABLE,
    populationSelection(parseMetadata(NEW_TABLE, newMeta.response), newYears),
    'sv',
    opts,
  )
  const series = buildPopulationSeries(municipalities, oldChunks, newChunks, YEARS)
  // Ruling R2 (Task 10 needs this for the provenance manifest without reopening this module):
  // every frozen chunk and metadata response involved in producing this series, in a fixed
  // order — data chunks first (old, then new), then the three metadata responses.
  const frozen: Array<FrozenData | FrozenMeta> = [
    ...oldChunks,
    ...newChunks,
    svMeta,
    enMeta,
    newMeta,
  ]
  return { municipalities, indicator: withBreaks(POPULATION, series), series, frozen }
}
