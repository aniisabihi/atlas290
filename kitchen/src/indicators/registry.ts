import type { Indicator, IndicatorSeries, Municipality } from '../../../shared/pantry'
import type { TableMeta } from '../scb/client'
import type { FreezeOpts, FrozenData, FrozenMeta } from '../scb/freeze'

/**
 * Everything one indicator definition needs to build its series, shared across every
 * definition in REGISTRY so a new indicator is a definition, not a new pipeline:
 *
 * - `municipalities` is empty until the population definition (the identity authority per
 *   docs/decisions/0001-plan-1-build-decisions.md) derives it and pushes into this same
 *   array — mutated in place, not reassigned, so every later definition sees it. Population
 *   must therefore run first in REGISTRY; buildAll enforces nothing about ordering beyond
 *   that, because nothing but population currently produces municipalities.
 * - `series` accumulates one entry per already-built indicator, keyed by indicator id, so a
 *   derived indicator (net-migration-per-1000, population-change) can read one already built
 *   instead of refetching it.
 * - `frozen` accumulates every FrozenData/FrozenMeta chunk any definition's build() fetched,
 *   in the order fetched, for the provenance manifest.
 * - `cpi` is left unset here; Task 4 populates it before any indicator that needs inflation
 *   adjustment runs.
 */
export interface BuildContext {
  municipalities: Municipality[]
  years: number[]
  freeze: FreezeOpts
  frozen: Array<FrozenData | FrozenMeta>
  cpi?: Map<number, number>
  series: Map<string, IndicatorSeries>
}

/** One entry in REGISTRY: the indicator's static metadata, plus how to build its series. */
export interface IndicatorDefinition {
  indicator: Indicator
  build(ctx: BuildContext): Promise<IndicatorSeries>
}

function variable(meta: TableMeta, code: string) {
  const v = meta.variables.find((x) => x.code === code)
  if (!v)
    throw new Error(
      `${meta.id}: no variable ${code}; have ${meta.variables.map((x) => x.code).join(', ')}`,
    )
  return v
}

/** Every value code SCB offers for one dimension of one table. */
export function values(meta: TableMeta, code: string): string[] {
  return variable(meta, code).values.map((x) => x.code)
}

/**
 * Recognised total codes per dimension, across every table any indicator resolves. Not
 * table-specific: a code here is used wherever a table's dimension happens to offer it.
 * Task 5 adds `'1+2'` for `Kon` (TAB628's density, selected instead of summing the two sexes —
 * ruling R1); Task 7 adds `Inkomstklass`'s `TOT` and `Alder`'s `tot16+` (income); Task 9 adds
 * `Alder`'s `tot16-74` (education) — a DIFFERENT age total on a DIFFERENT table from `tot16+`:
 * TAB3554 (income) carries `tot16+`, TAB3981 (education) carries `tot16-74`, and neither
 * subsumes the other, so both are listed rather than assuming one covers both tables. Extending
 * this list is additive and safe: a total code that happens not to exist in a given table's
 * value list is simply never matched there.
 */
export const TOTAL_CODES: Record<string, string[]> = {
  Alder: ['tot', 'TotSA', 'TOT1', 'tot16+', 'tot16-74'],
  Kon: ['TotSa', '1+2'],
  Civilstand: ['SC'],
  Inkomstklass: ['TOT'],
  // Plan 16: TAB3200 splits its labour-market measures by region of birth, and publishes a
  // 'tot' covering both. This site publishes the whole population of the age band; the split is
  // a question for a later indicator, not a silent choice inside this one.
  Fodelseregion: ['tot'],
  // Plan 16: the births tables' own age dimension. TAB1264 carries 'tot' ("totalt ålder");
  // TAB6401, its 2025 continuation, carries the CKM-era 'TotSA' like TAB5557 does for Alder.
  AlderModer: ['tot', 'TotSA'],
}

/**
 * Table+dimension pairs where summing every value (because no total code exists) has been
 * verified safe — the values are disjoint and unperturbed, so their sum equals the true
 * total. An explicit opt-in allowlist (ruling R17 / review finding 3), not a fallback every
 * table gets by default: an unlisted table with no recognised total throws instead of
 * silently summing, because summing an unverified set of "everything" can silently overcount
 * by a large multiple (as it would for TAB5557's Alder/Kon/Civilstand).
 */
export const SUM_SAFE: Record<string, string[]> = {
  // Declared for population.ts's own age-total fetch; reused as-is by derived.ts's share-65+
  // numerator (Task 11's share-65+ half), which selects a DIFFERENT Alder range (single ages
  // 65 and over, not the age total) from this same table but needs the identical Kon/Civilstand
  // summation for the same reason: TAB638 has no total code for either dimension, and the sum
  // is exact arithmetic — never an approximation — because TAB638 predates the Cell Key Method,
  // so every constituent cell is real and unperturbed rather than CKM-fuzzed.
  TAB638: ['Kon', 'Civilstand'],
  // Task 6 (net migration): TAB1211 (1968-1996) and TAB1212 (1997-2024) have no total code for
  // Kon — only '1' and '2' — so the sex total is summed rather than selected. Safe here for the
  // same reason TAB638's Kon sum is safe: both years' sex-split net-migration counts are
  // disjoint and unperturbed (CKM only begins 2025, and TAB6640, the 2025 table, carries its
  // own 'TotSa' total instead, so it never needs this fallback).
  TAB1211: ['Kon'],
  TAB1212: ['Kon'],
  // Plan 16 (natural change): TAB1264 (births) and TAB960 (deaths) publish 1968-2024 split by
  // sex with no total code — only '1' and '2' — so the total is summed. Safe for exactly the
  // reason TAB638's and TAB1211's sums are: a birth is recorded once under one sex and a death
  // once under one, the two sets are disjoint, and both tables predate the Cell Key Method, so
  // the sum is exact arithmetic rather than an approximation over perturbed cells. Their 2025
  // continuations TAB6401/TAB6757 carry 'TotSa' and never reach this fallback.
  TAB1264: ['Kon'],
  TAB960: ['Kon'],
  // Plan 16 (dwellings): TAB2538 splits completed dwellings by house type with no total, and
  // TAB824 splits the standing stock by house type AND tenure with no total for either. Each
  // dimension partitions the same set exactly once — a dwelling is one house type and one
  // tenure — so summing counts every dwelling once rather than several times. Neither table
  // carries a perturbation note.
  TAB2538: ['Hustyp'],
  TAB824: ['Hustyp', 'Upplatelseform'],
  // Task 9 (education): TAB3981's Kon has exactly two values, '1' and '2', and no total code —
  // verified live 2026-09-14 against the table's own metadata, so summing the two sexes here is
  // not optional, it is required before a share can be computed at all. Declared safe for the
  // same reason as TAB638/TAB1211/TAB1212 above: TAB3981 carries no Cell Key Method
  // perturbation note (its metadata's own notes cover two unrelated time-series breaks, 1990
  // and 2000, not disclosure-control noise), so summing the two sexes' counts is exact
  // arithmetic over real, disjoint, unperturbed cells — never an approximation over fuzzed ones.
  TAB3981: ['Kon'],
}

/**
 * Selects the single total-code value for a dimension where the table declares one, else
 * falls back to summing every value ONLY where that has been explicitly declared safe for
 * this exact table in `SUM_SAFE`. Anything else — an unrecognised total AND no declared-safe
 * entry — throws loudly, naming the table, the dimension and its values, rather than
 * silently summing an unverified set of cells.
 */
export function totalOrDeclaredSum(meta: TableMeta, dim: string): string[] {
  const vals = values(meta, dim)
  for (const total of TOTAL_CODES[dim] ?? []) {
    if (vals.includes(total)) return [total]
  }
  if (SUM_SAFE[meta.id]?.includes(dim)) return vals
  throw new Error(
    `${meta.id}: dimension ${dim} has no recognised total code (looked for ` +
      `${(TOTAL_CODES[dim] ?? []).join(', ')}) and summing ${meta.id}.${dim} is not declared ` +
      `safe in SUM_SAFE; refusing to silently sum an unverified set of cells. Values were: ` +
      `${vals.join(', ')}`,
  )
}

/**
 * Resolves a ContentsCode from a table's own metadata, by its Swedish label — the mechanism
 * every indicator uses, because the code itself varies by table and by era of the same table
 * (Global Constraints trap 2) while the label is stable. Throws if no code carries the label
 * (wrong table/label drift) or if more than one does (an ambiguous match must never be
 * silently resolved by array order).
 */
export function resolveContentCode(meta: TableMeta, label: string): string {
  const v = variable(meta, 'ContentsCode')
  const matches = v.values.filter((x) => x.label === label)
  if (matches.length === 0) {
    throw new Error(
      `${meta.id}: no ContentsCode labelled '${label}'; have ${v.values
        .map((x) => `${x.code}=${x.label}`)
        .join(', ')}`,
    )
  }
  if (matches.length > 1) {
    throw new Error(
      `${meta.id}: ${matches.length} ContentsCode values are labelled '${label}' ` +
        `(${matches.map((x) => x.code).join(', ')}) — ambiguous, pick one explicitly instead ` +
        `of silently taking the first`,
    )
  }
  return matches[0]!.code
}

/**
 * Builds one row per municipality, one column per year, by calling `cell` for each — the
 * shared shape every indicator's series has, iterating the KNOWN municipality list rather
 * than trusting a table's own region list.
 */
export function buildRows<T>(
  municipalities: Municipality[],
  years: number[],
  cell: (m: Municipality, y: number) => T,
): T[][] {
  return municipalities.map((m) => years.map((y) => cell(m, y)))
}

/**
 * Unreachable for population (every municipality reports a value every year), but Plan 2
 * adds indicators with genuinely partial coverage. An empty `nums` would otherwise fall
 * through a `?? 0` fallback and return `classes - 1` zero breaks that validate cleanly
 * against the schema while producing a meaningless colour scale — so this throws, naming the
 * indicator, rather than hand back a scale nobody can read.
 */
export function quantileBreaks(
  nums: number[],
  classes: number,
  indicatorId = 'quantileBreaks',
): number[] {
  if (nums.length === 0) {
    throw new Error(`${indicatorId}: cannot compute colour breaks — every value is null`)
  }
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

/** Fills an indicator's fixed colour-scale breaks from every non-null value in its series. */
export function withBreaks(indicator: Indicator, series: IndicatorSeries, classes = 7): Indicator {
  const all = series.values.flat().filter((v): v is number => v !== null)
  return {
    ...indicator,
    scale: { ...indicator.scale, breaks: quantileBreaks(all, classes, indicator.id) },
  }
}

// Circular by necessity: population.ts (and every future indicator module) imports the
// shared machinery above, and this module needs population.ts's finished definition to seed
// REGISTRY. Declaring this import is always safe — an ES `import` binding never itself
// throws — but READING `populationDefinition` eagerly at this module's own top level is NOT
// safe: whichever of the two modules a real entry point (the CLI, a test) happens to load
// first, the OTHER one's top-level code has not necessarily run yet at that point. This was
// not a hypothetical: building REGISTRY as a plain `[populationDefinition]` array literal
// here crashed `yarn kitchen publish` with "ReferenceError: Cannot access
// 'populationDefinition' before initialization", because publish.ts reaches population.ts
// first and population.ts's own top level had not yet defined it when this line ran — even
// though the equivalent vitest run passed, because Vitest's module graph happened to resolve
// the cycle from the other side. So the read is deferred to `ensureRegistered`, called only
// from inside `buildAll`'s function body — i.e. only once application code actually invokes
// it, by which point loading of every module in the program has unconditionally finished.
import { populationDefinition, YEARS } from './population'
// Same deferred-read reasoning as the population import above applies to every later indicator
// module: the binding itself is always safe to import, but ensureRegistered is what actually
// reads taxDefinition/densityDefinition, and it only runs from inside buildAll — never at
// either module's own top level.
import { taxDefinition } from './tax'
import { densityDefinition } from './density'
// Same deferred-read reasoning as population/tax/density above: migration additionally reads
// ANOTHER definition's finished series (population's, via ctx.series) inside its own build(),
// which is a second reason it must run only from inside ensureRegistered/buildAll — never at
// this module's own top level — and a second reason it must be registered strictly after
// populationDefinition below.
import { migrationDefinition } from './migration'
// Same deferred-read reasoning as every import above: the binding is always safe to import,
// but ensureRegistered is what actually reads incomeDefinition, and only from inside buildAll.
// Unlike migration, income does not read another indicator's series from ctx — it calls
// cpi.ts's fetchCpi directly inside its own build() (see income.ts's module comment for why
// that call is not routed through ctx.cpi yet) — so it has no ordering dependency on any other
// REGISTRY entry beyond needing ctx.municipalities, which population alone establishes.
import { incomeDefinition } from './income'
// Same deferred-read reasoning as every import above: the binding is always safe to import,
// but ensureRegistered is what actually reads housingDefinition, and only from inside buildAll.
// Like income, housing calls cpi.ts's fetchCpi directly inside its own build() rather than
// through ctx.cpi (Task 13 wires that slot), so it has no ordering dependency on any other
// REGISTRY entry beyond needing ctx.municipalities, which population alone establishes.
import { housingDefinition } from './housing'
// Same deferred-read reasoning as every import above: the binding is always safe to import,
// but ensureRegistered is what actually reads educationDefinition, and only from inside
// buildAll. Like income and housing, education has no ordering dependency on any other
// REGISTRY entry beyond needing ctx.municipalities, which population alone establishes.
import {
  educationDefinition,
  educationGapDefinition,
  educationMenDefinition,
  educationWomenDefinition,
} from './education'
// Same deferred-read reasoning as every import above: the binding is always safe to import, but
// ensureRegistered is what actually reads populationChangeDefinition/meanAgeDefinition/
// share65PlusDefinition, and only from inside buildAll. Like migration, population change AND
// share-65+ each read ANOTHER definition's finished series (population's, via ctx.series)
// inside their own build() — a second reason each must be registered strictly after
// populationDefinition below, same as migrationDefinition. Mean age (Task 11's mean-age half)
// has no such ordering requirement: it only needs ctx.municipalities, already established by
// population, exactly like income/housing/education.
import { meanAgeDefinition, populationChangeDefinition, share65PlusDefinition } from './derived'
// Plan 16. Same deferred-read reasoning as every import above. None of these four reads another
// indicator's series: each is a direct fetch that needs only ctx.municipalities, which population
// establishes, so their position among the non-population entries is arbitrary.
import { dependencyDefinition, fertilityDefinition } from './demography'
import { employmentDefinition, unemploymentDefinition } from './labour'
// Taxable income fetches the price index itself inside its own build(), exactly as income and
// housing do, so like them it has no ordering dependency beyond ctx.municipalities.
import { disposableDefinition, priceToIncomeDefinition, taxBaseDefinition } from './finance'
import {
  completedDefinition,
  rentDefinition,
  shareHousesDefinition,
  shareRentalsDefinition,
  stockDefinition,
} from './dwellings'
// These four divide by population's finished series through ctx.series, exactly as migration,
// population-change and share-65-plus do, so like them they MUST be registered after population.
import { naturalChangeDefinition } from './demography'
import { emissionsDefinition, natureDefinition } from './environment'
import { householdSizeDefinition } from './households'
import { carsDefinition } from './transport'
// in-commuters divides by population's finished series, so it must come after population.
import { inCommutingDefinition, outCommutingDefinition } from './commuting'
// The life-expectancy gap reads its two operands from ctx.series, so it comes after both.
import { lifeGapDefinition, lifeMenDefinition, lifeWomenDefinition } from './longevity'

/** Every indicator the pantry publishes, in build order. Population must stay first: it is
 * the only definition that derives `ctx.municipalities`, and every other definition depends
 * on that having already happened. Tax rate and density (Task 5) come next; order between them
 * does not matter, since neither derives municipalities or reads another's series. Net
 * migration (Task 6) must come after population specifically — not merely after it happens to
 * run — because its build() reads `ctx.series.get(POPULATION.id)` and throws if that is not
 * yet set. Median income (Task 7), house prices (Task 8) and education (Task 9) have no such
 * ordering requirement — each only needs `ctx.municipalities`, already established by
 * population — so their position among the other non-population entries is arbitrary.
 * Population change (Task 10) has the same ordering requirement as migration, for the same
 * reason: its build() also reads `ctx.series.get(POPULATION.id)` and throws if population has
 * not run yet. Mean age (Task 11's mean-age half) has no such ordering requirement — a direct
 * TAB637 fetch with nothing read from ctx.series — so, like income/housing/education, its
 * position among the other non-population entries is arbitrary. Share aged 65 and over (Task
 * 11's other half) DOES have the same ordering requirement as migration/population-change: its
 * denominator is population's own series, read from ctx.series, so it too must come after
 * populationDefinition. Starts empty; `ensureRegistered` fills it in on first use (see the
 * comment on the imports above for why that can't happen at module-load time). */
export const REGISTRY: IndicatorDefinition[] = []

let registered = false
function ensureRegistered(): void {
  if (registered) return
  registered = true
  REGISTRY.push(
    populationDefinition,
    taxDefinition,
    densityDefinition,
    migrationDefinition,
    incomeDefinition,
    housingDefinition,
    educationDefinition,
    populationChangeDefinition,
    meanAgeDefinition,
    share65PlusDefinition,
    fertilityDefinition,
    dependencyDefinition,
    employmentDefinition,
    unemploymentDefinition,
    taxBaseDefinition,
    disposableDefinition,
    rentDefinition,
    naturalChangeDefinition,
    completedDefinition,
    stockDefinition,
    emissionsDefinition,
    shareHousesDefinition,
    shareRentalsDefinition,
    // The two splits must come before the gap, and house-prices and median-income before the
    // ratio of the two: each reads its operands from ctx.series and throws if they are not there.
    educationWomenDefinition,
    educationMenDefinition,
    educationGapDefinition,
    priceToIncomeDefinition,
    householdSizeDefinition,
    carsDefinition,
    natureDefinition,
    inCommutingDefinition,
    outCommutingDefinition,
    lifeWomenDefinition,
    lifeMenDefinition,
    lifeGapDefinition,
  )
}

/**
 * Runs every definition in `defs` (REGISTRY by default) through the shared build path:
 * fetch through the freeze layer (via `ctx.freeze`), map onto the known municipalities,
 * apply each definition's own status rule, then compute fixed quantile breaks. Validates,
 * per definition, that its series has exactly one row per municipality and that its id is
 * not already taken — both name the offending indicator when they fail, so a broken
 * definition cannot silently corrupt the pantry.
 *
 * `defs` is an extra, optional parameter beyond the published `buildAll(opts?)` signature —
 * every real caller uses the one-argument form and gets REGISTRY; tests use the second
 * parameter to exercise the integrity guards against fake definitions without a network
 * round trip.
 */
export async function buildAll(
  opts: FreezeOpts = {},
  defs?: IndicatorDefinition[],
): Promise<{
  municipalities: Municipality[]
  indicators: Indicator[]
  series: IndicatorSeries[]
  frozen: Array<FrozenData | FrozenMeta>
  /**
   * Task 13: exactly the slice of `frozen` each definition's OWN `build(ctx)` call pushed,
   * keyed by indicator id — never derived by matching an indicator's declared
   * `Indicator.sources` (table + contentCode) back against the flat `frozen` array after the
   * fact. That matching approach was tried first and found wrong by inspecting its own
   * output: population and share-65-plus both declare TAB638/`BE0101N1` as one of their own
   * sources (a real fact — population fetches the age TOTAL from it, share-65-plus fetches
   * ages 65+ from the SAME table and content code, via a different `Alder` selection), so
   * matching on (table, contentCode) alone attributed share-65-plus's ~50 chunked requests to
   * population too, and vice versa — a 100% false overlap, caught by checking the two
   * indicators' resulting chunk lists against each other rather than trusting the code
   * compiled and the row counts looked plausible. `ctx.frozen`'s cumulative length before and
   * after each `def.build(ctx)` call below is a precise boundary: whatever a definition's own
   * build() pushed is unambiguously its own provenance, with no risk of attributing another
   * definition's chunks to it just because both happen to share a table or content code.
   */
  sourcesByIndicator: Record<string, Array<FrozenData | FrozenMeta>>
}> {
  // Only populate the real singleton when we are actually going to use it. Passing `defs`
  // is the tests' isolated path, and registering as a side effect of it would leave the
  // global REGISTRY mutated by a test that never meant to touch it.
  if (!defs) ensureRegistered()
  const list = defs ?? REGISTRY

  // YEARS is population's own constant (1968..LATEST_YEAR), kept here as ctx.years only
  // because population's build() reads it from ctx rather than closing over its own module
  // constant. It is NOT a shared year range for every indicator: tax rate (2000-2026) and
  // density (1991-2025) each define and use their own year constants instead of this one
  // (Task 5) — reusing ctx.years for either would silently mis-cover its series with nothing
  // failing, since a missing fetched year just reads as an ordinary "not yet published" cell.
  const ctx: BuildContext = {
    municipalities: [],
    years: YEARS,
    freeze: opts,
    frozen: [],
    series: new Map(),
  }
  const indicators: Indicator[] = []
  const seriesList: IndicatorSeries[] = []
  const seenIds = new Set<string>()
  const sourcesByIndicator: Record<string, Array<FrozenData | FrozenMeta>> = {}

  for (const def of list) {
    const id = def.indicator.id
    if (seenIds.has(id)) {
      throw new Error(`indicator registry: duplicate indicator id '${id}'`)
    }
    seenIds.add(id)

    const frozenBefore = ctx.frozen.length
    const series = await def.build(ctx)
    sourcesByIndicator[id] = ctx.frozen.slice(frozenBefore)

    // Population is the only definition that derives ctx.municipalities; everything else
    // maps onto it. If a definition ran before that happened, the row-count check below
    // cannot see it — zero rows equals zero municipalities and passes. Until Plan 2's
    // review this was caught only as a side effect of quantileBreaks refusing empty input,
    // which is luck rather than a guarantee, so say it outright.
    if (ctx.municipalities.length === 0) {
      throw new Error(
        `${id}: built before any definition had established the municipality list — ` +
          `population must come first in REGISTRY`,
      )
    }

    if (series.values.length !== ctx.municipalities.length) {
      throw new Error(
        `${id}: series has ${series.values.length} rows but there are ` +
          `${ctx.municipalities.length} municipalities — every indicator must publish exactly ` +
          `one row per municipality`,
      )
    }

    ctx.series.set(id, series)
    seriesList.push(series)
    indicators.push(withBreaks(def.indicator, series))
  }

  return {
    municipalities: ctx.municipalities,
    indicators,
    series: seriesList,
    frozen: ctx.frozen,
    sourcesByIndicator,
  }
}
