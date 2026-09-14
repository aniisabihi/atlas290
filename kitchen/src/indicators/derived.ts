import {
  Indicator,
  type IndicatorSeries,
  type Municipality,
  statusCode,
} from '../../../shared/pantry'
import { isStructuralBreak } from '../breaks'
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
// Same deferred-read reasoning every other indicator module documents for its own population.ts
// import (migration.ts's POPULATION import is the closest parallel: a plain, already-finished
// `const` read only inside a function body, never at this module's own top level) applies here:
// POPULATION is read only inside buildPopulationChange's function body below, so importing it
// is safe despite the population<->registry load cycle, even though this module is itself
// reached only through that same registry.ts import list.
import { POPULATION } from './population'

/**
 * Population change is the first indicator with NO fetch at all (Task 10 of
 * docs/plans/2026-09-14-02-the-ten-indicators.md): it is computed entirely from the population
 * series population.ts already built into `ctx.series`, never from a new SCB table. `sources`
 * below is therefore deliberately empty — there is no table/contentCode pair to record — and
 * `derivation` says in prose what the (empty) sources array cannot.
 */
export const POPULATION_CHANGE: Indicator = Indicator.parse({
  id: 'population-change',
  name: { sv: 'Befolkningsförändring', en: 'Population change' },
  description: {
    sv: 'Procentuell förändring i folkmängd jämfört med föregående år.',
    en: 'Percentage change in population compared with the previous year.',
  },
  unit: 'percent',
  priceBasis: 'none',
  // Diverging, not sequential, and around a meaningful zero: growth and decline are opposite
  // directions, not two points on one ramp — the same reasoning migration.ts's own diverging
  // scale documents. This is also THE indicator the site opens on (docs/DESIGN.md line 25: "First
  // view: population change, slider at 1968"), so unlike migration's rate this one doubles as
  // the first thing a visitor's eye has to read at a glance; growth and decline must be visually
  // distinguishable immediately, which a sequential ramp cannot do around zero.
  scale: { kind: 'diverging', reference: 'zero', breaks: [] },
  // 1968 onwards, per docs/DESIGN.md's indicator table. Hardcoded rather than imported from
  // population.ts's LATEST_YEAR/POPULATION.coverage, exactly as every other indicator module
  // (tax.ts, density.ts, migration.ts) hardcodes its OWN year range instead of borrowing
  // population's — importing a value out of POPULATION at this object literal's own top level
  // would be a real-load-order hazard here (this file is itself reached from inside registry.ts's
  // import list, which is itself reached from inside population.ts's own still-unfinished
  // evaluation — see registry.ts's module comment for the full chain), not merely a style choice.
  coverage: { from: 1968, to: 2025 },
  caveat: {
    sv: 'Det år en kommun bildas genom en avknoppning visas förälderns cell som null (structural-break) i stället för en skenbar kollaps: nedgången beror på att en gräns ritades om, inte på att invånare flyttat — se t.ex. Uppsala 2002, då Knivsta knoppades av. Samma statusregler som folkmängd i övrigt gäller: en kommun som ännu inte fanns är did-not-exist (inklusive dess eget första år, som saknar ett föregående år att jämföra med), och seriens allra första år saknar ett föregående år oavsett kommun.',
    en: "In the year a municipality is formed by a split, the parent's cell is null with status structural-break instead of a false collapse: the drop is a redrawn boundary, not people leaving — see Uppsala in 2002, the year Knivsta split off. Otherwise the same status rules as population apply: a municipality that did not yet exist is did-not-exist (including its own first year, which has no previous year to compare against), and the series' very first year has no previous year regardless of municipality.",
  },
  sensitivity: 'none',
  sources: [],
  derivation:
    'No fetch: computed entirely from the population series already built in ctx.series ' +
    '(read, never refetched). For each municipality and year, ((population[y] - population[y-1]) ' +
    '/ population[y-1]) * 100 — but only once existence and publication are both established: ' +
    'the current year not having happened yet for that municipality wins over everything else ' +
    '(did-not-exist); a first year of overall coverage has no year-1 column to read at all ' +
    "(not-yet-published); a municipality's own first year has a did-not-exist previous cell, " +
    "which is also not-yet-published's cousin but kept as did-not-exist since that IS the reason " +
    "no rate exists, not an ordinary publication gap; either year's population being null for " +
    "any other reason is not-yet-published; and a parent municipality's flagged structural-break " +
    'year (kitchen/src/breaks.ts, snapshot convention — population change moves in step with ' +
    "population, not one calendar year behind it, exactly like population's own year-Y-reflects-" +
    '1-January-Y+1 division) is null with status structural-break rather than a nonsense percentage.',
})

/**
 * Builds the population-change series from an already-built population series. Deliberately
 * takes `population: IndicatorSeries` directly, rather than reading it off `ctx` itself, so
 * this — the actual arithmetic under test — never needs a BuildContext or a network fake to
 * exercise; `buildPopulationChange` below is the thin ctx-reading wrapper REGISTRY calls.
 *
 * Uses `population.years` as this series' own years, rather than a separately declared local
 * year array (unlike every fetching indicator's own YEARS constant): population change has no
 * year range of its own to assert independently of population's — it IS population's own years,
 * shifted one column, so borrowing them outright is what guarantees column `j` here lines up
 * with population's column `j`, by construction rather than by two lists happening to agree.
 *
 * `municipalities` must be in the same order `population` was built from (true by construction
 * for every real caller, since both come from the same `ctx.municipalities`) so row `i` here is
 * population's row `i` too.
 *
 * Status precedence per cell, in the order actually applied (each guard below returns before
 * reaching the next, so only one status is ever attributed to a cell):
 *
 * 1. **`did-not-exist`** if the CURRENT year's population cell is itself `did-not-exist` — a
 *    municipality that does not exist yet this year has no change to report, full stop,
 *    regardless of what the previous column holds.
 * 2. **`not-yet-published`** if there IS no previous column at all — the series' first year
 *    (population.years[0]) can never have a rate, for every municipality, because there is
 *    nothing before it to compare against.
 * 3. **`did-not-exist`** if the PREVIOUS year's population cell is `did-not-exist` — this is a
 *    municipality's own first year of existence (population's status flips to something other
 *    than `did-not-exist` for the first time), the case the plan calls out by name (Knivsta,
 *    2002): a wrong implementation would divide by null/0 and either crash or publish a
 *    fabricated huge percentage, since SCB's own first-year figure is a real, correct population
 *    count, not a change from nothing.
 * 4. **`not-yet-published`** if either year's population value is null for any OTHER reason
 *    (both years' statuses already ruled out `did-not-exist` above, so this is an ordinary
 *    publication gap) — never a division by null.
 * 5. **`structural-break`** if `isStructuralBreak` flags this exact municipality+year under the
 *    snapshot convention (see the module-level comment above on why population change is
 *    snapshot, not flow) — both years' populations are real numbers at this point, which is
 *    exactly the danger: the arithmetic would happily produce a large, wrong, well-formed
 *    percentage here if this guard were skipped.
 * 6. Otherwise, the real rate: `((cur - prev) / prev) * 100`, with status carried over from the
 *    current year's own population status — `perturbed` when the current year is CKM-affected
 *    (from population's own CKM_FROM onward), `present` otherwise. (Population's status is only
 *    ever `present`, `not-yet-published`, `did-not-exist` or `perturbed` for a real value, per
 *    population.ts's own `buildPopulationSeries` — never `too-few-cases` or `structural-break`
 *    — so this cannot silently swallow one of those into a plain `present`.)
 */
export function buildPopulationChangeSeries(
  municipalities: Municipality[],
  population: IndicatorSeries,
): IndicatorSeries {
  const years = population.years
  const DID_NOT_EXIST = statusCode('did-not-exist')
  const NOT_YET_PUBLISHED = statusCode('not-yet-published')
  const PERTURBED = statusCode('perturbed')

  // Row/column lookups by identity (code, year) rather than array position — buildRows below
  // iterates `municipalities`/`years` themselves, so this mirrors migration.ts's own
  // popRowOf/popColOf maps rather than repeatedly scanning with indexOf.
  const rowOf = new Map(municipalities.map((m, i) => [m.code, i]))
  const colOf = new Map(years.map((y, i) => [y, i]))

  const cells = buildRows(municipalities, years, (m, y) => {
    // `row` and `curCol` are always found: buildRows iterates these exact `municipalities`
    // and `years` arrays, which are what rowOf/colOf were built from above. Only `prevCol`
    // (year - 1) can genuinely be missing — that is the series' first year.
    const row = rowOf.get(m.code)!
    const curCol = colOf.get(y)!
    const prevCol = colOf.get(y - 1)

    const curStatus = population.status[row]?.[curCol]
    const curVal = population.values[row]?.[curCol] ?? null

    if (curStatus === DID_NOT_EXIST) {
      return { v: null as number | null, s: DID_NOT_EXIST }
    }
    if (prevCol === undefined) {
      return { v: null, s: NOT_YET_PUBLISHED }
    }
    const prevStatus = population.status[row]?.[prevCol]
    const prevVal = population.values[row]?.[prevCol] ?? null

    if (prevStatus === DID_NOT_EXIST) {
      return { v: null, s: DID_NOT_EXIST }
    }
    if (curVal === null || prevVal === null) {
      return { v: null, s: NOT_YET_PUBLISHED }
    }
    if (isStructuralBreak(m.code, y, 'snapshot')) {
      return { v: null, s: statusCode('structural-break') }
    }

    const change = ((curVal - prevVal) / prevVal) * 100
    return { v: change, s: curStatus === PERTURBED ? PERTURBED : statusCode('present') }
  })

  return {
    indicator: POPULATION_CHANGE.id,
    years,
    values: cells.map((r) => r.map((c) => c.v)),
    status: cells.map((r) => r.map((c) => c.s)),
  }
}

/**
 * ctx-reading wrapper REGISTRY calls: reads population's already-built series out of
 * `ctx.series` (never refetches — this indicator has nothing to fetch) and hands it to
 * `buildPopulationChangeSeries` above. Throws, naming both indicators, if population has not
 * been built yet — population must therefore come before population-change in REGISTRY, exactly
 * as migration.ts's `buildMigration` requires (migration.ts's own comment on this same
 * requirement is the model for this one).
 */
export async function buildPopulationChange(ctx: BuildContext): Promise<IndicatorSeries> {
  const population = ctx.series.get(POPULATION.id)
  if (!population) {
    throw new Error(
      `${POPULATION_CHANGE.id}: population series not yet built — population must come ` +
        'before population-change in REGISTRY, since the change is computed against it',
    )
  }
  return buildPopulationChangeSeries(ctx.municipalities, population)
}

export const populationChangeDefinition: IndicatorDefinition = {
  indicator: POPULATION_CHANGE,
  build: buildPopulationChange,
}

/**
 * Mean age (Task 11 of docs/plans/2026-09-14-02-the-ten-indicators.md — the mean-age half only;
 * share aged 65 and over is deliberately held pending an architect decision on data cost and
 * NOT built here — see the task brief and `docs/kitchen.md`'s Task 2 spike section).
 *
 * The plan originally specified MEDIAN age, interpolated from single-year ages. The Task 2
 * spike (docs/kitchen.md, "Can median age and share-65+ be built at all?") established SCB does
 * not publish a municipal median at any resolution — TAB4659 carries a median content code but
 * its Region dimension has only 22 values (riket + 21 län), zero four-digit municipality codes
 * — and deriving one from single-year ages would have meant freezing ~130 MB of age-distribution
 * data for TAB638 alone, for a figure that would still only be an interpolated approximation.
 * SCB DOES publish mean age per municipality directly: TAB637, "Befolkningens medelålder efter
 * region och kön. År 1998-2025". Verified live 2026-09-14 against the real API (not recalled
 * from the spike, which only searched the table index and metadata, not real data): `Region` has
 * 312 values of which exactly 290 are four-digit codes, and — checked by set difference against
 * TAB638's own 290 four-digit codes (the municipality-identity authority per
 * docs/decisions/0001-plan-1-build-decisions.md) — this is EXACTLY the known 290, no phantom
 * aggregate codes to guard against (unlike TAB1212's Stor-Stockholm/Stor-Göteborg/Stor-Malmö
 * trap). One content code, `BE0101G9` = "Medelålder"; `Kon` carries the total `'1+2'`. This is
 * therefore a cheap, direct fetch — no age distribution, no interpolation, no derivation beyond
 * selecting one cell per municipality and year — unlike population-change above, which has
 * nothing to fetch at all. It ships under the id/name "mean age" (`medelålder`), not "median
 * age": the whole point of the correction is that this project is not claiming a median SCB
 * never published.
 */
export const MEAN_AGE_TABLE = 'TAB637'

/**
 * Mean age's own year range: 1998-2025. Hardcoded here rather than imported from population.ts's
 * YEARS/LATEST_YEAR — exactly as tax.ts, density.ts and population-change's own module comment
 * above explain: importing a value out of population.ts at this object literal's own top level
 * would be a real load-order hazard (this file is reached from inside registry.ts's import
 * list, itself reached from inside population.ts's own still-unfinished evaluation), not merely
 * a style choice. 1998 is TAB637's own real first year, verified against its live metadata
 * (`Tid`: 28 values, 1998..2025) — not population's 1968, which TAB637 simply does not cover.
 */
export const MEAN_AGE_YEARS = Array.from({ length: 2025 - 1998 + 1 }, (_, i) => 1998 + i)

/**
 * Swedish label SCB uses for TAB637's single content code. Resolved by label rather than
 * hardcoded `BE0101G9`, per docs/decisions/0001-plan-1-build-decisions.md's trap 2 — the same
 * convention every indicator in this project uses, even though this table happens to carry only
 * the one ContentsCode.
 */
const MEAN_AGE_CONTENT_LABEL = 'Medelålder'

export const MEAN_AGE: Indicator = Indicator.parse({
  id: 'mean-age',
  name: { sv: 'Medelålder', en: 'Mean age' },
  description: {
    sv: 'Genomsnittlig ålder bland kommunens invånare.',
    en: "Average age among the municipality's residents.",
  },
  unit: 'years',
  priceBasis: 'none',
  scale: { kind: 'sequential', breaks: [] },
  coverage: { from: MEAN_AGE_YEARS[0]!, to: MEAN_AGE_YEARS[MEAN_AGE_YEARS.length - 1]! },
  caveat: {
    sv: 'SCB publicerar ingen medianålder per kommun — endast per län och riket. Detta är därför medelåldern, hämtad direkt från SCB, inte en härledd eller interpolerad medianålder. Täcker 1998 och framåt; SCB:s motsvarande tabell för tidigare år saknas.',
    en: 'SCB does not publish a median age per municipality — only per county and nationally. This is therefore the mean age, fetched directly from SCB, not a derived or interpolated median. Coverage starts in 1998; SCB has no equivalent table for earlier years.',
  },
  sensitivity: 'none',
  sources: [{ table: MEAN_AGE_TABLE, contentCode: 'BE0101G9', note: '1998–2025' }],
  derivation:
    'One SCB total cell per municipality and year: the mean-age content code at the "1+2" sex ' +
    'total, resolved by label — selected directly, never derived from an age distribution, ' +
    'since SCB already publishes the mean per municipality.',
})

/**
 * TAB637's selection: the 4-digit municipality codes, the Kon total ('1+2', same total-code
 * mechanism density.ts uses — selected, never summed), the mean-age content code resolved by
 * label, and the requested years.
 */
export function meanAgeSelection(meta: TableMeta, years: string[]): Selection {
  return {
    Region: values(meta, 'Region').filter((c) => /^\d{4}$/.test(c)),
    Kon: totalOrDeclaredSum(meta, 'Kon'),
    ContentsCode: [resolveContentCode(meta, MEAN_AGE_CONTENT_LABEL)],
    Tid: years,
  }
}

/** Maps each fetched region+year cell to its value. TAB637 has exactly one row per key. */
function meanAgeByRegionYear(chunks: FrozenData[]): Map<string, number | null> {
  const map = new Map<string, number | null>()
  for (const chunk of chunks) {
    for (const r of toRows(chunk.response)) {
      map.set(`${r.dims.Region}|${r.dims.Tid}`, r.value)
    }
  }
  return map
}

/**
 * Builds the columnar mean-age series. Same snapshot status rule as population, tax rate and
 * density (ruling R16): existed() gates before the value is even looked at, so the literal `0`
 * TAB637 sends for a municipality's pre-existence years (verified live against the real API
 * 2026-09-14: Region 0330/Knivsta, Tid 1998-2001 all return `0`, exactly like TAB638 and
 * TAB3981 — never `null`, unlike TAB3554/TAB1169) is discarded rather than published as a real
 * mean age of zero. `existed(code, y)`, not `existed(code, y - 1)`: mean age is a snapshot, like
 * population/tax/density, not a flow like migration/house sales — confirmed against real TAB637
 * data for both splits that fall inside this indicator's 1998-2025 coverage: Knivsta's first
 * real (non-zero) cell is 2002, matching `CREATED['0330'] = 2002`; Nykvarn's first real cell is
 * 1998 itself (`CREATED['0140'] = 1998`), TAB637's own first covered year, so there is no
 * "before" row inside this table's range to check for Nykvarn specifically, but Nykvarn's 1998
 * cell already reads as a real value rather than 0, consistent with the same snapshot gate.
 * TAB637 carries no Cell Key Method perturbation note (checked against its live metadata's own
 * `note` field, which only states the 1-January-following-year regional-division convention
 * every snapshot table in this project already documents) — unlike density.ts, which inherits
 * CKM from being derived off population, mean age is published directly by SCB and never
 * carries a `perturbed` status.
 */
export function buildMeanAgeSeries(
  municipalities: Municipality[],
  chunks: FrozenData[],
  years: number[],
): IndicatorSeries {
  const ages = meanAgeByRegionYear(chunks)
  const cells = buildRows(municipalities, years, (m, y) => {
    if (!existed(m.code, y)) {
      return { v: null as number | null, s: statusCode('did-not-exist') }
    }
    const v = ages.get(`${m.code}|${y}`) ?? null
    if (v === null) return { v: null, s: statusCode('not-yet-published') }
    return { v, s: statusCode('present') }
  })
  return {
    indicator: MEAN_AGE.id,
    years,
    values: cells.map((r) => r.map((c) => c.v)),
    status: cells.map((r) => r.map((c) => c.s)),
  }
}

export async function buildMeanAge(ctx: BuildContext): Promise<IndicatorSeries> {
  const meta = await freezeMetadata(MEAN_AGE_TABLE, 'sv', ctx.freeze)
  const parsed = parseMetadata(MEAN_AGE_TABLE, meta.response)
  const years = MEAN_AGE_YEARS.map(String)
  const chunks = await freezeData(MEAN_AGE_TABLE, meanAgeSelection(parsed, years), 'sv', ctx.freeze)
  const series = buildMeanAgeSeries(ctx.municipalities, chunks, MEAN_AGE_YEARS)
  ctx.frozen.push(...chunks, meta)
  return series
}

export const meanAgeDefinition: IndicatorDefinition = { indicator: MEAN_AGE, build: buildMeanAge }

/**
 * Standalone real-fetch entry point, mirroring population.ts's fetchPopulation and tax.ts's
 * fetchTax — used for the spike/verification run, independent of the shared REGISTRY singleton.
 * Requires municipalities to already exist (population's own responsibility).
 */
export async function fetchMeanAge(
  municipalities: Municipality[],
  opts: FreezeOpts = {},
): Promise<{ series: IndicatorSeries; frozen: Array<FrozenData | FrozenMeta> }> {
  const ctx: BuildContext = {
    municipalities,
    years: MEAN_AGE_YEARS,
    freeze: opts,
    frozen: [],
    series: new Map(),
  }
  const series = await buildMeanAge(ctx)
  return { series, frozen: ctx.frozen }
}
