import {
  Indicator,
  type IndicatorSeries,
  type Municipality,
  statusCode,
} from '../../../shared/pantry'
import { isStructuralBreak } from '../breaks'
import { buildDefined, type Definition } from './define'
import { buildRows, type BuildContext, type IndicatorDefinition } from './registry'
// Same deferred-read reasoning every other indicator module documents for its own population.ts
// import (migration.ts's POPULATION import is the closest parallel: a plain, already-finished
// `const` read only inside a function body, never at this module's own top level) applies here:
// POPULATION is read only inside buildPopulationChange's function body below, so importing it
// is safe despite the population<->registry load cycle, even though this module is itself
// reached only through that same registry.ts import list. CKM_FROM is a plain literal number
// (2025), not a value that depends on any other module's own top-level evaluation having
// finished, so importing the binding is unconditionally safe — but per this same file's
// SHARE_65_YEARS comment below, it is still only ever READ inside a function body here
// (share65PlusDefined), never used to compute anything at this module's own top level.
import { CKM_FROM, NEW_TABLE, OLD_TABLE, POPULATION, YEARS } from './population'
import { neutral } from './prose'

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
  scale: { kind: 'diverging', breaks: [] },
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
    en: 'In the year a municipality is formed by a split, the parent’s cell is null with status structural-break instead of a false collapse: the drop is a redrawn boundary, not people leaving — see Uppsala in 2002, the year Knivsta split off. Otherwise the same status rules as population apply: a municipality that did not yet exist is did-not-exist (including its own first year, which has no previous year to compare against), and the series’ very first year has no previous year regardless of municipality.',
  },
  sensitivity: 'none',
  sources: [],
  derivation: {
    sv:
      'Ingen hämtning: beräknas helt ur folkmängdsserien som redan finns i ctx.series (läses, ' +
      'hämtas aldrig på nytt). För varje kommun och år ((folkmängd[y] − folkmängd[y−1]) / ' +
      'folkmängd[y−1]) × 100 — men först när både existens och publicering är fastställda: att ' +
      'det aktuella året ännu inte har inträffat för kommunen går före allt annat ' +
      '(did-not-exist); täckningens första år har ingen kolumn för år−1 att läsa alls ' +
      '(not-yet-published); en kommuns eget första år har en föregående cell med did-not-exist, ' +
      'som är släkt med not-yet-published men behålls som did-not-exist eftersom det ÄR skälet ' +
      'till att ingen förändring finns, inte en vanlig publiceringslucka; att folkmängden något ' +
      'av åren saknas av något annat skäl ger not-yet-published; och en moderkommuns flaggade ' +
      'år med strukturellt brott (kitchen/src/breaks.ts, ögonblicksbildskonventionen — ' +
      'befolkningsförändringen följer folkmängden och ligger inte ett kalenderår efter, precis ' +
      'som folkmängdens egen uppdelning där år Y speglar den 1 januari Y+1) blir null med ' +
      'statusen structural-break i stället för en meningslös procentsats.',
    en:
      'No fetch: computed entirely from the population series already built in ctx.series ' +
      '(read, never refetched). For each municipality and year, ((population[y] - ' +
      'population[y-1]) / population[y-1]) * 100 — but only once existence and publication are ' +
      'both established: the current year not having happened yet for that municipality wins ' +
      'over everything else (did-not-exist); a first year of overall coverage has no year-1 ' +
      'column to read at all (not-yet-published); a municipality’s own first year has a ' +
      'did-not-exist previous cell, which is also not-yet-published’s cousin but kept as ' +
      'did-not-exist since that IS the reason no rate exists, not an ordinary publication gap; ' +
      'either year’s population being null for any other reason is not-yet-published; and a ' +
      'parent municipality’s flagged structural-break year (kitchen/src/breaks.ts, snapshot ' +
      'convention — population change moves in step with population, not one calendar year ' +
      'behind it, exactly like population’s own year-Y-reflects-1-January-Y+1 division) is null ' +
      'with status structural-break rather than a nonsense percentage.',
  },
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
    en: 'Average age among the municipality’s residents.',
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
  sources: [{ table: MEAN_AGE_TABLE, contentCode: 'BE0101G9', note: neutral('1998–2025') }],
  derivation: {
    sv:
      'En SCB-totalcell per kommun och år: innehållskoden för medelålder vid könstotalen ”1+2”, ' +
      'utpekad genom etikett — vald direkt, aldrig härledd ur en åldersfördelning, eftersom SCB ' +
      'redan publicerar medelvärdet per kommun.',
    en:
      'One SCB total cell per municipality and year: the mean-age content code at the "1+2" sex ' +
      'total, resolved by label — selected directly, never derived from an age distribution, ' +
      'since SCB already publishes the mean per municipality.',
  },
})

export async function buildMeanAge(ctx: BuildContext): Promise<IndicatorSeries> {
  return buildDefined(meanAgeDefined(), ctx)
}

/**
 * Mean age, as a definition (Plan 14). TAB637's `Kon` carries its own total code, so nothing is
 * summed. No `perturbedFrom`: this table carries no Cell Key Method note, which is why the mean
 * is published as a plain figure rather than a fuzzed one.
 */
export function meanAgeDefined(): Definition {
  return {
    indicator: MEAN_AGE,
    sources: [
      {
        table: MEAN_AGE_TABLE,
        content: MEAN_AGE_CONTENT_LABEL,
        years: MEAN_AGE_YEARS,
        dims: { Kon: 'total' },
      },
    ],
    spec: { kind: 'direct' },
  }
}

export const meanAgeDefinition: IndicatorDefinition = { indicator: MEAN_AGE, build: buildMeanAge }

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
    en: 'Share of the municipality’s residents aged 65 or over, of that year’s total population.',
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
    en: 'The numerator (residents aged 65 and over) is fetched separately from the denominator (the municipality’s total population, already built elsewhere in this dataset) for the same year, never by re-summing both and risking the two disagreeing. Through 2024 (TAB638) this predates the Cell Key Method, so summing over sex and marital status (neither of which has a total code in that table) is exact arithmetic over real, unperturbed cells — not an approximation. From 2025 (TAB5557) the ready-made totals "TotSa" and "SC" are selected directly instead, and the values are CKM-perturbed, like population.',
  },
  sensitivity: 'none',
  sources: [
    {
      table: SHARE_65_TABLE_OLD,
      contentCode: 'BE0101N1',
      note: {
        sv: '1968–2024, åldrarna 65+ summerade över kön och civilstånd (ingen totalkod för något av dem)',
        en: '1968–2024, ages 65+ summed over sex and marital status (no total code for either)',
      },
    },
    {
      table: SHARE_65_TABLE_NEW,
      contentCode: '000007ME',
      note: {
        sv: '2025 och framåt, CKM, ettårsåldrarna 65–99 plus ettårskoden för 100+, totalerna för kön och civilstånd valda direkt',
        en: '2025 onwards, CKM, single-year ages 65–99 plus the single-year 100+ code, sex/marital totals selected directly',
      },
    },
  ],
  derivation: {
    sv:
      'Täljare: ettårsåldrarna 65 och äldre (65–99 plus ettårskoden för 100+ i båda ' +
      'tabellerna), vid folkmängdens innehållskod utpekad genom etikett. TAB638 (1968–2024) ' +
      'saknar totalkod för Kon och Civilstand, så båda summeras över sina fullständiga ' +
      'värdemängder — deklarerat säkert i SUM_SAFE eftersom TAB638 är äldre än Cell ' +
      'Key-metoden, vilket gör summan till exakt aritmetik över disjunkta, ostörda celler och ' +
      'aldrig en approximation. TAB5557 (2025 och framåt) har färdiga totaler för båda ' +
      '(’TotSa’, ’SC’), som väljs direkt i stället för att summeras. Nämnare: samma kommuns ' +
      'totala folkmängd samma år, läst ur den redan byggda folkmängdsserien i byggkontexten, ' +
      'aldrig hämtad på nytt eller summerad fristående. Andel = täljare / nämnare × 100.',
    en:
      'Numerator: single-year ages 65 and over (65-99 plus the single-year 100+ code on both ' +
      'tables), at the population content code resolved by label. TAB638 (1968-2024) has no ' +
      'total code for Kon or Civilstand, so both are summed over their full value sets — ' +
      'declared safe in SUM_SAFE because TAB638 predates the Cell Key Method, making the sum ' +
      'exact arithmetic over disjoint, unperturbed cells, never an approximation. TAB5557 (2025 ' +
      'onwards) carries ready-made totals for both (‘TotSa’, ‘SC’), selected directly rather ' +
      'than summed. Denominator: that same municipality’s total population for the same year, ' +
      'read from the already-built population series in the build context, never refetched or ' +
      'independently re-summed. Share = numerator / denominator * 100.',
  },
})

/**
 * ctx-reading wrapper REGISTRY calls: reads population's already-built series out of
 * `ctx.series` (never refetches or re-sums it independently — the design's explicit
 * requirement, to avoid the numerator and denominator silently disagreeing) and fetches the
 * 65+ numerator from TAB638/TAB5557. Throws, naming both indicators, if population has not
 * been built yet — population must therefore come before share-65-plus in REGISTRY, exactly
 * as it must for migration and population-change.
 */
export async function buildShare65Plus(ctx: BuildContext): Promise<IndicatorSeries> {
  return buildDefined(share65PlusDefined(), ctx)
}

/**
 * Share aged 65 and over, as a definition (Plan 14).
 *
 * The numerator stitches TAB638 to 2024 and the Cell Key Method table from 2025, selecting every
 * age from 65 up. The two tables disagree about what to call the open-ended top band — `100+` and
 * `100+1` — so the age rule is expressed as "leading digits of at least 65" and neither code is
 * written down.
 *
 * The denominator is population's already-built series rather than a second sum of the same
 * table, so numerator and denominator can never quietly disagree.
 */
export function share65PlusDefined(): Definition {
  return {
    indicator: SHARE_65_PLUS,
    sources: [
      {
        table: OLD_TABLE,
        content: SHARE_65_CONTENT_LABEL,
        years: YEARS.filter((y) => y < CKM_FROM),
        dims: {
          Alder: { singleFrom: 65, alsoInclude: ['100+'] },
          Kon: 'total',
          Civilstand: 'total',
        },
        regions: 'known',
      },
      {
        table: NEW_TABLE,
        content: SHARE_65_CONTENT_LABEL,
        years: YEARS.filter((y) => y >= CKM_FROM),
        dims: {
          Alder: { singleFrom: 65, alsoInclude: ['100+1'] },
          Kon: 'total',
          Civilstand: 'total',
        },
      },
    ],
    spec: { kind: 'ratio', of: POPULATION.id, times: 100 },
    perturbedFrom: CKM_FROM,
  }
}

export const share65PlusDefinition: IndicatorDefinition = {
  indicator: SHARE_65_PLUS,
  build: buildShare65Plus,
}
