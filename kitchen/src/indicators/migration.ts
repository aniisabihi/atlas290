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
  totalOrDeclaredSum,
  values,
  type BuildContext,
  type IndicatorDefinition,
} from './registry'
// Same deferred-read reasoning density.ts documents for its CKM_FROM import applies here:
// POPULATION and CKM_FROM are read only inside buildMigration's/buildMigrationSeries's function
// bodies below, never at this module's own top level, so the binding is safe to import despite
// the population<->registry<->migration load cycle.
import { CKM_FROM, POPULATION } from './population'

export const MIGRATION_TABLE_OLD = 'TAB1211' // 1968-1996
export const MIGRATION_TABLE_MID = 'TAB1212' // 1997-2024
export const MIGRATION_TABLE_NEW = 'TAB6640' // 2025, CKM

/**
 * Migration's own year range: 1968-2025. Coincides with population's 1968-2025 today, but is
 * defined independently — exactly as tax.ts and density.ts define their own ranges — because
 * `ctx.years` is population's own constant, not a shared one, and reusing it here would
 * silently mis-cover this series if the two ever diverge (a missing fetched year just reads as
 * an ordinary "not yet published" cell, with nothing failing).
 */
export const MIGRATION_YEARS = Array.from({ length: 2025 - 1968 + 1 }, (_, i) => 1968 + i)

/**
 * Swedish label stable across all three source tables, even though the ContentsCode ITSELF
 * differs in every one (docs/decisions/0001-plan-1-build-decisions.md's trap 2, confirmed live
 * 2026-09-14): BE0101C5 in TAB1211, BE0101AZ in TAB1212, 00000868 in TAB6640.
 */
const MIGRATION_CONTENT_LABEL = 'Flyttningsöverskott'

export const MIGRATION: Indicator = Indicator.parse({
  id: 'net-migration-rate',
  name: { sv: 'Flyttningsöverskott per 1 000 invånare', en: 'Net migration per 1,000 residents' },
  description: {
    sv: 'Flyttningsöverskott (in- minus utflyttning, oavsett ursprung) satt i relation till samma års folkmängd.',
    en: "Net migration (in-migration minus out-migration, regardless of origin) set against that year's population.",
  },
  unit: 'per-thousand',
  priceBasis: 'none',
  // Diverging, not sequential: a municipality gaining people and one losing them are not two
  // points on one ramp, they are opposite directions from a meaningful zero — the design
  // requires the colour scale to say so (Task 6 of docs/plans/2026-09-14-02-the-ten-indicators.md).
  scale: { kind: 'diverging', reference: 'zero', breaks: [] },
  coverage: { from: MIGRATION_YEARS[0]!, to: MIGRATION_YEARS[MIGRATION_YEARS.length - 1]! },
  caveat: {
    sv: 'Publicerat som en kvot (flyttningsöverskott per 1 000 invånare), inte en summa, eftersom den absoluta summan i stort sett bara återger folkmängden. Byggd av tre tabeller (1968–1996, 1997–2024, 2025). Omkring 49 kommuner som bildades vid länssammanslagningarna 1998 (Skåne, Västra Götaland) saknar underlag för 1968–1996: den äldsta tabellen använder fortfarande de kommunkoder som gällde före sammanslagningen, och dessa matchar inte dagens 290 koder. Från 2025 är värdena CKM-störda, liksom befolkningen.',
    en: "Published as a rate (net migration per 1,000 residents), not a count, because the raw count would largely just reproduce the population map. Built from three tables (1968–1996, 1997–2024, 2025). About 49 municipalities created by the 1998 county mergers (Skåne, Västra Götaland) have no data for 1968–1996: the oldest table still uses the municipality codes that predate the merger, which do not match today's 290 codes. From 2025 the values are CKM-perturbed, like population.",
  },
  sensitivity: 'none',
  sources: [
    { table: MIGRATION_TABLE_OLD, contentCode: 'BE0101C5', note: '1968–1996' },
    { table: MIGRATION_TABLE_MID, contentCode: 'BE0101AZ', note: '1997–2024' },
    { table: MIGRATION_TABLE_NEW, contentCode: '00000868', note: '2025, CKM' },
  ],
  derivation:
    'Net migration is published directly by SCB, never derived by subtracting in- from ' +
    'out-migration flows here. Selected at the age total (resolved by label) and the sex ' +
    'total: summed over the two sexes where no total code exists (TAB1211, TAB1212 — safe, ' +
    'since pre-2025 sex-split counts are disjoint and unperturbed), or selected directly where ' +
    'one does (TAB6640\'s "TotSa"). Divided by that same municipality\'s population in the same ' +
    'year — read from the build context rather than refetched — and multiplied by 1,000. A ' +
    'null population yields a null rate rather than a division by zero.',
})

/**
 * Selects only the region codes that are BOTH offered by this table AND known current
 * municipality codes, rather than a blind four-digit regex. Two independent things this
 * guards against, both confirmed live 2026-09-14 rather than assumed from the plan's summary:
 *
 * 1. TAB1212 and TAB6640 each carry three extra four-digit codes that are NOT municipalities —
 *    `0010` Stor-Stockholm, `0020` Stor-Göteborg, `0030` Stor-Malmö (the plan's own trap 1,
 *    verified to also apply to TAB6640, which the plan did not separately check).
 * 2. TAB1211 (1968-1996) predates the 1998 county mergers that renumbered every municipality in
 *    what is now Skåne and Västra Götaland, and was never retroactively republished under
 *    current codes the way TAB638 (population) was — confirmed by diffing its Region list
 *    against the known 290: 49 current codes are simply absent from TAB1211's own list, while
 *    49 different (old) codes appear instead (e.g. Borås as `1583`, matching the code
 *    kitchen/src/municipalities.ts already records for Bollebygd's parent). Requesting a known
 *    current code TAB1211 does not offer would fail the request outright; intersecting against
 *    what the table actually offers means those 49 municipalities simply read
 *    'not-yet-published' for 1968-1996 rather than the build crashing or fabricating a value —
 *    an honest gap, not a silent one, recorded in MIGRATION's caveat above.
 */
export function migrationSelection(
  meta: TableMeta,
  municipalityCodes: string[],
  years: string[],
): Selection {
  const known = new Set(municipalityCodes)
  return {
    Region: values(meta, 'Region').filter((c) => known.has(c)),
    Alder: totalOrDeclaredSum(meta, 'Alder'),
    Kon: totalOrDeclaredSum(meta, 'Kon'),
    ContentsCode: [resolveContentCode(meta, MIGRATION_CONTENT_LABEL)],
    Tid: years,
  }
}

/**
 * Sums SCB cell values per municipality+year — identical sum-and-null-propagation rule as
 * population.ts's own sumByRegionYear (not imported: that function is private to
 * population.ts). Collapses however many Kon rows a chunk carries per key: one, where a
 * table's total code was selected (TAB6640's 'TotSa'), or two, where TOTAL_CODES had no total
 * and totalOrDeclaredSum fell through to SUM_SAFE's declared-safe sum (TAB1211/TAB1212's `1`
 * and `2`). A key whose constituent rows are a MIX of null and real values becomes null —
 * never a partial sum presented as the whole.
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
 * Net migration is a FLOW measured during calendar year Y using the administrative boundary
 * that actually applied during year Y. Population's own `existed()` (kitchen/src/
 * municipalities.ts) instead encodes TAB638's convention that a year-Y population row already
 * reflects the administrative division of 1 January year Y+1 — which is why `CREATED['0330']`
 * (Knivsta) is 2002 even though Knivsta's formal creation date is 2003-01-01.
 *
 * Net migration does NOT follow that same forward-shifted convention: verified live against
 * TAB1211/TAB1212 for every split with a table old enough to check it —
 *
 *   - Gnesta (0461, CREATED 1991): real (non-zero) migration only from 1992
 *   - Trosa (0488, CREATED 1991): real migration only from 1992
 *   - Lekeberg (1814, CREATED 1994): real migration only from 1995
 *   - Nykvarn (0140, CREATED 1998): real migration only from 1999
 *   - Knivsta (0330, CREATED 2002): real migration only from 2003
 *
 * every one exactly one calendar year AFTER population's own CREATED year. (Bollebygd, the
 * sixth split, is moot here: its 1968-1996 data lives under a pre-1998 code TAB1211 uses
 * instead of `1443`, so it is already excluded by `migrationSelection`'s known-code join above,
 * regardless of this function.) So `existed(code, y)` — true a full calendar year too early —
 * must not gate migration directly; `existed(code, y - 1)` is the same gate, shifted the one
 * year migration actually needs.
 */
function migrationExisted(code: string, year: number): boolean {
  return existed(code, year - 1)
}

/**
 * Builds the columnar net-migration-rate series. `population` is the already-built population
 * series (read from `ctx.series`, per the design — never refetched), and must share the exact
 * municipality order `municipalities` gives here so row `i` below is population's row `i` too;
 * `buildMigration` guarantees this by construction, since both are built from the one
 * `ctx.municipalities` array. Rule order per cell: `migrationExisted` gates before the raw
 * count is even looked at (discarding whatever SCB sent, same as every other indicator's
 * ruling R16); a missing count is 'not-yet-published'; a null (or zero) population for that
 * same year yields a null rate — never a division by zero — also flagged
 * 'not-yet-published', since the rate genuinely cannot be published without its denominator.
 */
export function buildMigrationSeries(
  municipalities: Municipality[],
  oldChunks: FrozenData[],
  midChunks: FrozenData[],
  newChunks: FrozenData[],
  years: number[],
  population: IndicatorSeries,
  perturbedFrom: number = CKM_FROM,
): IndicatorSeries {
  const counts = new Map([
    ...sumByRegionYear(oldChunks),
    ...sumByRegionYear(midChunks),
    ...sumByRegionYear(newChunks),
  ])
  const popColOf = new Map(population.years.map((y, idx) => [y, idx]))
  const popRowOf = new Map(municipalities.map((m, i) => [m.code, i]))

  const cells = buildRows(municipalities, years, (m, y) => {
    if (!migrationExisted(m.code, y)) {
      return { v: null as number | null, s: statusCode('did-not-exist') }
    }
    const count = counts.get(`${m.code}|${y}`) ?? null
    if (count === null) {
      return { v: null, s: statusCode('not-yet-published') }
    }
    const row = popRowOf.get(m.code)
    const col = popColOf.get(y)
    const pop =
      row === undefined || col === undefined ? null : (population.values[row]?.[col] ?? null)
    if (pop === null || pop === 0) {
      return { v: null, s: statusCode('not-yet-published') }
    }
    const rate = (count / pop) * 1000
    return { v: rate, s: y >= perturbedFrom ? statusCode('perturbed') : statusCode('present') }
  })
  return {
    indicator: MIGRATION.id,
    years,
    values: cells.map((r) => r.map((c) => c.v)),
    status: cells.map((r) => r.map((c) => c.s)),
  }
}

export async function buildMigration(ctx: BuildContext): Promise<IndicatorSeries> {
  const population = ctx.series.get(POPULATION.id)
  if (!population) {
    throw new Error(
      `${MIGRATION.id}: population series not yet built — population must come before ` +
        'migration in REGISTRY, since the migration rate is computed against it',
    )
  }
  const codes = ctx.municipalities.map((m) => m.code)

  const [oldMeta, midMeta, newMeta] = await Promise.all([
    freezeMetadata(MIGRATION_TABLE_OLD, 'sv', ctx.freeze),
    freezeMetadata(MIGRATION_TABLE_MID, 'sv', ctx.freeze),
    freezeMetadata(MIGRATION_TABLE_NEW, 'sv', ctx.freeze),
  ])

  const oldYears = MIGRATION_YEARS.filter((y) => y <= 1996).map(String)
  const midYears = MIGRATION_YEARS.filter((y) => y >= 1997 && y <= 2024).map(String)
  const newYears = MIGRATION_YEARS.filter((y) => y >= 2025).map(String)

  const oldChunks = await freezeData(
    MIGRATION_TABLE_OLD,
    migrationSelection(parseMetadata(MIGRATION_TABLE_OLD, oldMeta.response), codes, oldYears),
    'sv',
    ctx.freeze,
  )
  const midChunks = await freezeData(
    MIGRATION_TABLE_MID,
    migrationSelection(parseMetadata(MIGRATION_TABLE_MID, midMeta.response), codes, midYears),
    'sv',
    ctx.freeze,
  )
  const newChunks = await freezeData(
    MIGRATION_TABLE_NEW,
    migrationSelection(parseMetadata(MIGRATION_TABLE_NEW, newMeta.response), codes, newYears),
    'sv',
    ctx.freeze,
  )

  const series = buildMigrationSeries(
    ctx.municipalities,
    oldChunks,
    midChunks,
    newChunks,
    MIGRATION_YEARS,
    population,
  )
  ctx.frozen.push(...oldChunks, ...midChunks, ...newChunks, oldMeta, midMeta, newMeta)
  return series
}

export const migrationDefinition: IndicatorDefinition = {
  indicator: MIGRATION,
  build: buildMigration,
}

/**
 * Standalone real-fetch entry point, mirroring population.ts's fetchPopulation, tax.ts's
 * fetchTax and density.ts's fetchDensity — used for the spot-check run, independent of the
 * shared REGISTRY singleton. Unlike those, migration also needs an already-built population
 * series (it is the rate's denominator), so the caller must supply one — normally
 * `fetchPopulation`'s own result — rather than this function deriving it.
 */
export async function fetchMigration(
  municipalities: Municipality[],
  population: IndicatorSeries,
  opts: FreezeOpts = {},
): Promise<{ series: IndicatorSeries; frozen: Array<FrozenData | FrozenMeta> }> {
  const ctx: BuildContext = {
    municipalities,
    years: MIGRATION_YEARS,
    freeze: opts,
    frozen: [],
    series: new Map([[POPULATION.id, population]]),
  }
  const series = await buildMigration(ctx)
  return { series, frozen: ctx.frozen }
}
