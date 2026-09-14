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
// reached only through that same registry.ts import list. CKM_FROM is a plain literal number
// (2025), not a value that depends on any other module's own top-level evaluation having
// finished, so importing the binding is unconditionally safe — but per this same file's
// SHARE_65_YEARS comment below, it is still only ever READ inside a function body here
// (buildShare65PlusSeries), never used to compute anything at this module's own top level.
import { CKM_FROM, POPULATION } from './population'

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
 * Mean age (Task 11 of docs/plans/2026-09-14-02-the-ten-indicators.md — the mean-age half; share
 * aged 65 and over, Task 11's other half, is built further down this file, after
 * `meanAgeDefinition`).
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

/**
 * Share aged 65 and over (Task 11's other half). Covers the full approved 1968-2025 history,
 * not the cheaper 1998-onwards start mean age was forced into: the Task 2 spike
 * (docs/kitchen.md, "Can median age and share-65+ be built at all?") established this needs
 * only a threshold at 65, not a full age distribution or interpolation, so it is unaffected by
 * the reason mean age had to move to TAB637. The architect's approved cost is real, not free:
 * fetching TAB638's ages-65+ range (measured 828,022 B for 2024, all 290 municipalities)
 * projects to ~47.2 MB across 1968-2024 (docs/kitchen.md's own measurement, not re-derived
 * here), growing kitchen/raw/ from ~9 MB to roughly 56 MB. That is the accepted price of full
 * history over a 1998 start, per the task brief, and this module does not economise below it
 * (e.g. by silently narrowing to 1998 the way mean age had to) or exceed it silently.
 *
 * Mirrors population.ts's own old/new table split exactly, for the same underlying reason:
 * TAB638 (1968-2024) predates the Cell Key Method and TAB5557 (2025 onwards) is CKM-perturbed.
 * The numerator here is population restricted to ages 65 and over, not the age total
 * population.ts fetches — so this is a second, independent fetch of the same two tables,
 * shaped differently (a 36-value Alder selection instead of the age total), not a re-use of
 * population's own frozen chunks.
 */
export const SHARE_65_TABLE_OLD = 'TAB638' // 1968–2024, pre-CKM
export const SHARE_65_TABLE_NEW = 'TAB5557' // 2025 onwards, CKM

/**
 * This indicator's own year range: 1968-2025, the full history the architect approved rather
 * than a cheaper 1998 start. Hardcoded here rather than imported from population.ts's
 * YEARS/LATEST_YEAR or reused from `ctx.years` — exactly as MEAN_AGE_YEARS above and every
 * other indicator module (tax.ts, density.ts, migration.ts) explains: `ctx.years` is
 * population's own constant, not a shared one, and importing a value out of population.ts at
 * this object literal's own top level would be a real load-order hazard (this file is reached
 * from inside registry.ts's import list, itself reached from inside population.ts's own
 * still-unfinished evaluation), not merely a style choice — the exact hazard Task 10 hit and
 * documented on POPULATION_CHANGE above.
 */
export const SHARE_65_YEARS = Array.from({ length: 2025 - 1968 + 1 }, (_, i) => 1968 + i)

/**
 * Same Swedish label population.ts resolves ('Folkmängd'), because this indicator's numerator
 * is still a population count — just restricted to ages 65 and over rather than the age total.
 * The ContentsCode ITSELF differs by table exactly as population.ts's own POPULATION_CONTENT_LABEL
 * comment documents (BE0101N1 in TAB638, 000007ME in TAB5557), which is why this is resolved by
 * label per table rather than hardcoded.
 */
const SHARE_65_CONTENT_LABEL = 'Folkmängd'

export const SHARE_65_PLUS: Indicator = Indicator.parse({
  id: 'share-65-plus',
  name: { sv: 'Andel 65 år och äldre', en: 'Share aged 65 and over' },
  description: {
    sv: 'Andel av kommunens invånare som är 65 år eller äldre, av samma års totala folkmängd.',
    en: "Share of the municipality's residents aged 65 or over, of that year's total population.",
  },
  unit: 'percent',
  priceBasis: 'none',
  // Sequential, not diverging: a share of population is a level between 0 and 100, with no
  // meaningful zero-crossing the way population change or net migration have — matching
  // education's own share indicator, the closest precedent in this project.
  scale: { kind: 'sequential', breaks: [] },
  coverage: { from: SHARE_65_YEARS[0]!, to: SHARE_65_YEARS[SHARE_65_YEARS.length - 1]! },
  caveat: {
    sv: 'Täljaren (invånare 65 år och äldre) hämtas separat från nämnaren (kommunens totala folkmängd, redan byggd i denna databas) för samma år, aldrig genom att på nytt summera och riskera att de två svarar mot olika totaler. Fram till och med 2024 (TAB638) föregår detta Cell Key Method-metoden, så summeringen över kön och civilstånd (som saknar totalkoder i den tabellen) är exakt aritmetik över riktiga, ostörda celler — inte en approximation. Från 2025 (TAB5557) hämtas i stället de färdiga totalkoderna "TotSa" och "SC" direkt, och värdena är CKM-störda liksom folkmängden.',
    en: 'The numerator (residents aged 65 and over) is fetched separately from the denominator (the municipality\'s total population, already built elsewhere in this dataset) for the same year, never by re-summing both and risking the two disagreeing. Through 2024 (TAB638) this predates the Cell Key Method, so summing over sex and marital status (neither of which has a total code in that table) is exact arithmetic over real, unperturbed cells — not an approximation. From 2025 (TAB5557) the ready-made totals "TotSa" and "SC" are selected directly instead, and the values are CKM-perturbed, like population.',
  },
  sensitivity: 'none',
  sources: [
    {
      table: SHARE_65_TABLE_OLD,
      contentCode: 'BE0101N1',
      note: '1968–2024, ages 65+ summed over sex and marital status (no total code for either)',
    },
    {
      table: SHARE_65_TABLE_NEW,
      contentCode: '000007ME',
      note: '2025 onwards, CKM, single-year ages 65–99 plus the single-year 100+ code, sex/marital totals selected directly',
    },
  ],
  derivation:
    'Numerator: single-year ages 65 and over (65-99 plus the single-year 100+ code on both ' +
    'tables), at the population content code resolved by label. TAB638 (1968-2024) has no ' +
    'total code for Kon or Civilstand, so both are summed over their full value sets — ' +
    'declared safe in SUM_SAFE because TAB638 predates the Cell Key Method, making the sum ' +
    'exact arithmetic over disjoint, unperturbed cells, never an approximation. TAB5557 (2025 ' +
    "onwards) carries ready-made totals for both ('TotSa', 'SC'), selected directly rather " +
    "than summed. Denominator: that same municipality's total population for the same year, " +
    'read from the already-built population series in the build context, never refetched or ' +
    'independently re-summed. Share = numerator / denominator * 100.',
})

/**
 * TAB638's selection: the municipality codes, single-year ages 65 and over (65 through 100+,
 * which is the last TAB638 age bucket — verified against its live metadata to have no age
 * beyond 100+, so this is a clean boundary at 65 with no group straddling it), the full Kon x
 * Civilstand cross-tab (summed — TAB638 has no total for either, declared safe in SUM_SAFE),
 * the population content code resolved by label, and the requested years.
 */
export function share65OldSelection(
  meta: TableMeta,
  municipalityCodes: string[],
  years: string[],
): Selection {
  const known = new Set(municipalityCodes)
  const ages = values(meta, 'Alder').filter(
    (c) => c === '100+' || (/^\d+$/.test(c) && Number(c) >= 65),
  )
  return {
    Region: values(meta, 'Region').filter((c) => known.has(c) && /^\d{4}$/.test(c)),
    Alder: ages,
    Kon: totalOrDeclaredSum(meta, 'Kon'),
    Civilstand: totalOrDeclaredSum(meta, 'Civilstand'),
    ContentsCode: [resolveContentCode(meta, SHARE_65_CONTENT_LABEL)],
    Tid: years,
  }
}

/**
 * TAB5557's selection: single-year ages 65 and over (65 through 99, plus '100+1' — the
 * single-year-resolution 100+ code, distinct from the 5-/10-year-resolution '100+5'/'100+10'
 * codes the same table also carries per docs/kitchen.md's Task 2 spike findings; picking the
 * single-year one keeps the same clean boundary at 65 that the old table's selection has,
 * with no 5-/10-year group straddling it). Excludes every group code (`65-69`, `60-69`, ...)
 * and every total code (`TotSA`, `TOT1`, `TOT5`, `TOT10`) — those are alternative resolutions
 * of the SAME cells and summing across resolutions would badly overcount, exactly the CKM
 * finding docs/kitchen.md records for population's own single-age vs. group sums. Kon and
 * Civilstand select the ready-made totals ('TotSa', 'SC') directly rather than summing, since
 * TAB5557 carries them as ordinary values.
 */
export function share65NewSelection(meta: TableMeta, years: string[]): Selection {
  const ages = values(meta, 'Alder').filter(
    (c) => c === '100+1' || (/^\d+$/.test(c) && Number(c) >= 65),
  )
  return {
    Region: values(meta, 'Region').filter((c) => /^\d{4}$/.test(c)),
    Alder: ages,
    Kon: totalOrDeclaredSum(meta, 'Kon'),
    Civilstand: totalOrDeclaredSum(meta, 'Civilstand'),
    ContentsCode: [resolveContentCode(meta, SHARE_65_CONTENT_LABEL)],
    Tid: years,
  }
}

/**
 * Sums SCB cell values per municipality+year — identical sum-and-null-propagation rule as
 * population.ts's own sumByRegionYear and migration.ts's own copy of the same helper (not
 * imported: private to each module, per this project's established convention). Collapses
 * however many rows a chunk carries per (Region, Tid) key: up to 36 ages x 2 sexes x 4 marital
 * states = 288 rows on TAB638, or up to 36 ages x 1 sex-total x 1 marital-total = 36 rows on
 * TAB5557. A key whose constituent rows are a MIX of null and real values becomes null — never
 * a partial sum presented as the whole 65-and-over count.
 */
function sum65PlusByRegionYear(chunks: FrozenData[]): Map<string, number | null> {
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
 * Builds the columnar share-65+ series. `population` is the already-built population series
 * (read from `ctx.series` by `buildShare65Plus` below, per the design's explicit instruction to
 * read the denominator rather than refetch or re-sum it), and must share the exact
 * municipality order `municipalities` gives here so row `i` below is population's row `i` too —
 * guaranteed by construction, since both are built from the one `ctx.municipalities` array.
 *
 * This is a SNAPSHOT indicator, like population/tax/density/income/education/mean age, not a
 * FLOW like migration/house sales (kitchen/src/breaks.ts's SourceKind distinction) — its
 * numerator comes from the very same TAB638/TAB5557 population tables and dataset note
 * ("a year-Y figure uses the administrative division of 1 January year Y+1"), so it uses
 * `existed(code, y)` directly, exactly like population itself, never `existed(code, y - 1)`.
 *
 * Status precedence per cell:
 * 1. `did-not-exist` if the municipality did not yet exist that year — gates BEFORE the
 *    numerator is even looked at, discarding whatever TAB638 sent (a literal `0`, never null,
 *    for a municipality's pre-existence years — ruling R16, the same trap population.ts's own
 *    `buildPopulationSeries` guards against).
 * 2. `not-yet-published` if the 65+ numerator itself is null (missing or genuinely
 *    unpublished for that municipality+year).
 * 3. `not-yet-published` if the same year's population denominator is null or zero — never a
 *    division by zero or null. The denominator is read from `population`, not recomputed.
 * 4. Otherwise the real share (`numerator / denominator * 100`), with status `perturbed` from
 *    `perturbedFrom` (CKM_FROM) onward, `present` otherwise — reusing the same constant
 *    population's own status rule uses, per the task brief's explicit instruction, rather than
 *    a second one that could silently drift from it.
 */
export function buildShare65PlusSeries(
  municipalities: Municipality[],
  oldChunks: FrozenData[],
  newChunks: FrozenData[],
  years: number[],
  population: IndicatorSeries,
  perturbedFrom: number = CKM_FROM,
): IndicatorSeries {
  const numerators = new Map([
    ...sum65PlusByRegionYear(oldChunks),
    ...sum65PlusByRegionYear(newChunks),
  ])
  const popColOf = new Map(population.years.map((y, idx) => [y, idx]))
  const popRowOf = new Map(municipalities.map((m, i) => [m.code, i]))

  const cells = buildRows(municipalities, years, (m, y) => {
    if (!existed(m.code, y)) {
      return { v: null as number | null, s: statusCode('did-not-exist') }
    }
    const numerator = numerators.get(`${m.code}|${y}`) ?? null
    if (numerator === null) {
      return { v: null, s: statusCode('not-yet-published') }
    }
    const row = popRowOf.get(m.code)
    const col = popColOf.get(y)
    const denom =
      row === undefined || col === undefined ? null : (population.values[row]?.[col] ?? null)
    if (denom === null || denom === 0) {
      return { v: null, s: statusCode('not-yet-published') }
    }
    const share = (numerator / denom) * 100
    return { v: share, s: y >= perturbedFrom ? statusCode('perturbed') : statusCode('present') }
  })
  return {
    indicator: SHARE_65_PLUS.id,
    years,
    values: cells.map((r) => r.map((c) => c.v)),
    status: cells.map((r) => r.map((c) => c.s)),
  }
}

/**
 * ctx-reading wrapper REGISTRY calls: reads population's already-built series out of
 * `ctx.series` (never refetches or re-sums it independently — the design's explicit
 * requirement, to avoid the numerator and denominator silently disagreeing) and fetches the
 * 65+ numerator from TAB638/TAB5557. Throws, naming both indicators, if population has not
 * been built yet — population must therefore come before share-65-plus in REGISTRY, exactly
 * as it must for migration and population-change.
 */
export async function buildShare65Plus(ctx: BuildContext): Promise<IndicatorSeries> {
  const population = ctx.series.get(POPULATION.id)
  if (!population) {
    throw new Error(
      `${SHARE_65_PLUS.id}: population series not yet built — population must come before ` +
        'share-65-plus in REGISTRY, since its denominator is read from that series',
    )
  }
  const codes = ctx.municipalities.map((m) => m.code)

  const [oldMeta, newMeta] = await Promise.all([
    freezeMetadata(SHARE_65_TABLE_OLD, 'sv', ctx.freeze),
    freezeMetadata(SHARE_65_TABLE_NEW, 'sv', ctx.freeze),
  ])
  const oldYears = SHARE_65_YEARS.filter((y) => y < CKM_FROM).map(String)
  const newYears = SHARE_65_YEARS.filter((y) => y >= CKM_FROM).map(String)

  const oldChunks = await freezeData(
    SHARE_65_TABLE_OLD,
    share65OldSelection(parseMetadata(SHARE_65_TABLE_OLD, oldMeta.response), codes, oldYears),
    'sv',
    ctx.freeze,
  )
  const newChunks = await freezeData(
    SHARE_65_TABLE_NEW,
    share65NewSelection(parseMetadata(SHARE_65_TABLE_NEW, newMeta.response), newYears),
    'sv',
    ctx.freeze,
  )
  const series = buildShare65PlusSeries(
    ctx.municipalities,
    oldChunks,
    newChunks,
    SHARE_65_YEARS,
    population,
  )
  ctx.frozen.push(...oldChunks, ...newChunks, oldMeta, newMeta)
  return series
}

export const share65PlusDefinition: IndicatorDefinition = {
  indicator: SHARE_65_PLUS,
  build: buildShare65Plus,
}

/**
 * Standalone real-fetch entry point, mirroring migration.ts's fetchMigration — used for the
 * spot-check/verification run, independent of the shared REGISTRY singleton. Like migration,
 * needs an already-built population series (it is the share's denominator), so the caller
 * must supply one — normally fetchPopulation's own result — rather than this function deriving
 * it.
 */
export async function fetchShare65Plus(
  municipalities: Municipality[],
  population: IndicatorSeries,
  opts: FreezeOpts = {},
): Promise<{ series: IndicatorSeries; frozen: Array<FrozenData | FrozenMeta> }> {
  const ctx: BuildContext = {
    municipalities,
    years: SHARE_65_YEARS,
    freeze: opts,
    frozen: [],
    series: new Map([[POPULATION.id, population]]),
  }
  const series = await buildShare65Plus(ctx)
  return { series, frozen: ctx.frozen }
}
