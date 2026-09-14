import {
  Indicator,
  type IndicatorSeries,
  type Municipality,
  statusCode,
} from '../../../shared/pantry'
import { isStructuralBreak } from '../breaks'
import { buildRows, type BuildContext, type IndicatorDefinition } from './registry'
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
