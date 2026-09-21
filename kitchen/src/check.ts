import {
  statusCode,
  type Indicator,
  type IndicatorSeries,
  type Municipality,
} from '../../shared/pantry'

/**
 * The check stage (Task 12 of docs/plans/2026-09-14-02-the-ten-indicators.md, the second half
 * of Task 12 — the parent-break flagging half is kitchen/src/breaks.ts). Runs after every
 * indicator has been built and BEFORE anything is written to disk: "the thing that turns 'we
 * think the data is right' into 'the build refuses to ship data that is wrong'" (the plan's own
 * words). Task 13 wires this in as the gate `publish()` runs before `writePantryFile` — not
 * done here, per this task's own brief ("wiring publish to buildAll is Task 13's job").
 *
 * Every rule below throws immediately on the first violation it finds (fail fast, exactly like
 * every other guard in this codebase — registry.ts's `resolveContentCode`/`totalOrDeclaredSum`,
 * population.ts's status rules, etc.) and every message names the indicator, the municipality
 * and the year it is about, plus the actual value, wherever the rule concerns a specific cell
 * (rules 3, 4 and 5) — "a message saying only that a check failed is not acceptable" per this
 * task's own brief, because this stage exists to be read by a human at 2am who has to decide
 * whether SCB changed something. Rules 1 and 6 are about the whole municipality list or the
 * whole series respectively, not one cell, so they name what IS specific to them (the count, or
 * the indicator) instead of inventing a municipality/year that does not apply.
 */

/** The municipality count the population table's own registry establishes (Plan 1's identity
 * authority, docs/decisions/0001-plan-1-build-decisions.md) and the geometry is independently
 * proven to match via `assertCodesMatch` in publish.ts. This check does not re-derive the
 * geometry's own code list — it only re-asserts the number every real build must land on,
 * as a second, independent line of defence: a build that silently dropped or duplicated a
 * municipality somewhere between population.ts and here would still be caught, even if
 * `assertCodesMatch`'s join happened to be skipped or broken. */
export const EXPECTED_MUNICIPALITY_COUNT = 290

/** One indicator's declared plausible value range (Task 12's rule 5). Both bounds inclusive. */
export interface PlausibleRange {
  min: number
  max: number
}

/**
 * Declared plausible range per indicator id — deliberately one entry per indicator, never one
 * generic range reused across units, per this task's own brief ("do not invent one generic
 * range for all ten"). Chosen by looking at the real distribution `buildAll()` actually
 * produces (captured 2026-09-14, offline, from the committed `kitchen/raw/` cache — see this
 * task's report for the full per-indicator min/max) rather than guessed:
 *
 *   population                 min      2,241  max    999,239  (Stockholm, 2025)
 *   tax-rate                    min       26.5  max      35.65
 *   density                     min        0.2  max    6,529.2  (Sundbyberg, 2025)
 *   net-migration-rate          min     -72.82  max      318.78 (Salem, 1968 — tiny denominator)
 *   median-income               min  208,585.1  max  487,170.4  (Danderyd, 2021, adjusted)
 *   house-prices                min  309,846.6  max 16,253,221.5 (Danderyd, 2021, adjusted)
 *   post-secondary-education    min       5.30  max      65.66
 *   population-change           min      -5.67  max      37.45  (Salem, 1970 — miljonprogrammet-
 *                                                          era suburban boom, the five real
 *                                                          parent breaks are excluded already,
 *                                                          being null/structural-break)
 *   mean-age                    min       35.1  max       53.3
 *   share-65-plus               min       2.55  max       40.65
 *
 * Percent-of-population shares (tax rate, post-secondary education, share 65+) get the
 * mathematical 0–100 bound the brief names explicitly. Every count/money/rate indicator gets a
 * generous multiple of its real observed max (population and money indicators can only be
 * expected to grow — inflation, population growth — so headroom above today's real max is
 * deliberate, not slack) rather than a value pinned tight to what happens to exist today.
 * `population-change` and `net-migration-rate` are signed and legitimately negative (a
 * municipality can shrink, and can have net out-migration), so their ranges are NOT 0-anchored:
 * population-change's floor of -100 is a hard mathematical one (a population cannot fall by
 * more than the whole of itself in one year), not a guess.
 */
export const PLAUSIBLE_RANGES: Record<string, PlausibleRange> = {
  population: { min: 0, max: 2_000_000 },
  'tax-rate': { min: 0, max: 100 },
  density: { min: 0, max: 20_000 },
  'net-migration-rate': { min: -500, max: 500 },
  'median-income': { min: 0, max: 1_000_000 },
  'house-prices': { min: 0, max: 50_000_000 },
  'post-secondary-education': { min: 0, max: 100 },
  'population-change': { min: -100, max: 500 },
  'mean-age': { min: 0, max: 100 },
  'share-65-plus': { min: 0, max: 100 },
  // Plan 16. Same rule as above: a mathematical bound where one exists, and generous headroom
  // over the real observed maximum where the bound is only empirical.
  //
  // A fertility rate is bounded below by 0 and, in practice, far below 10 anywhere in Sweden;
  // the observed 2024 figures sit near 1.3-1.4. The dependency ratio is a count per 100
  // working-age people and legitimately exceeds 100 — Borgholm 2024 is 123.8 — so 100 would be
  // the wrong ceiling, and this is the one place where a "percent" indicator is not 0-100.
  'fertility-rate': { min: 0, max: 10 },
  'dependency-ratio': { min: 0, max: 500 },
  'employment-rate': { min: 0, max: 100 },
  'unemployment-rate': { min: 0, max: 100 },
  // Money, so generous headroom above today's real maximum: these can only grow.
  'taxable-income-per-resident': { min: 0, max: 5_000_000 },
  'disposable-household-income': { min: 0, max: 5_000_000 },
  'median-rent-per-sqm': { min: 0, max: 20_000 },
  // Natural change is signed and legitimately negative — most Swedish municipalities have more
  // deaths than births — so its range is not 0-anchored, for the same reason net migration's is
  // not. The rest are counts over a population and cannot be negative.
  'natural-change-rate': { min: -200, max: 200 },
  'dwellings-completed-rate': { min: 0, max: 500 },
  'dwellings-per-1000': { min: 0, max: 2000 },
  'greenhouse-gas-per-resident': { min: 0, max: 1000 },
  'share-houses': { min: 0, max: 100 },
  'share-rentals': { min: 0, max: 100 },
  'post-secondary-education-women': { min: 0, max: 100 },
  'post-secondary-education-men': { min: 0, max: 100 },
  // A gap in percentage points between two shares: bounded by -100 and 100 mathematically, and
  // signed, because men lead in some municipalities and women in most.
  'post-secondary-education-gap': { min: -100, max: 100 },
  'house-price-to-income': { min: 0, max: 200 },
  // Plan 17. A Swedish household has never averaged above about 2.5 people and cannot be below
  // 1; the ceiling is generous rather than tight. Cars per 1,000 cannot exceed 1,000 by much
  // even where companies register fleets. The nature share is a share.
  'persons-per-household': { min: 1, max: 10 },
  'cars-per-1000': { min: 0, max: 5000 },
  // Metres, and Sweden is large: the furthest municipality sits a few kilometres out.
  'distance-to-protected-nature': { min: 0, max: 100_000 },
  // A small municipality beside a large employer can draw in more commuters than it has
  // residents, so this is not bounded by 1,000.
  'in-commuters-per-1000': { min: 0, max: 5000 },
  'out-commuter-share': { min: 0, max: 100 },
  // Swedish life expectancy is in the eighties and has never approached either bound. The gap
  // is signed: men outlive women in a handful of small municipalities in some windows.
  'life-expectancy-women': { min: 0, max: 120 },
  'life-expectancy-men': { min: 0, max: 120 },
  'life-expectancy-gap': { min: -50, max: 50 },
}

/**
 * The year-on-year jump threshold for `population-change`, in percentage points (Task 12's
 * rule 4). Chosen from the real distribution of population-change's own already-computed
 * values (n = 16,363 non-null cells, captured 2026-09-14 offline from `buildAll()`):
 *
 *   p50    0.146    p95    2.066    p99.5   6.533   p99.99  31.735
 *   p90    1.511    p98    3.054    p99.9  11.815   max     37.447
 *
 * The real maximum (37.447%, Salem 1970) is not an error and not a flagged structural break —
 * it is the well-documented "miljonprogrammet" mass-housing boom of 1968-1975, which shows up
 * repeatedly at the top of this distribution (Salem, Upplands-Bro, Botkyrka, Håbo, Vellinge,
 * Ekerö, Härryda, Staffanstorp and more, all in 1968-1974, all real, all unflagged). A threshold
 * has to clear that real maximum with real margin, or the check stage would refuse the correct,
 * real dataset — the exact failure mode this task's brief warns is "worse than none".
 *
 * The five real parent-municipality breaks (Nyköping 1991 -27.5%, Uppsala 2002 -5.98%, Borås
 * 1994, Örebro 1994, Södertälje 1998) do NOT need to be accommodated by this threshold at all:
 * verified directly against the real built series (`breaks.ts`/`derived.ts`), all five are
 * already `structural-break` with a NULL value, so they are excluded from this check before the
 * threshold is even consulted, by the same guard that reads the status. A threshold this low
 * (50) would otherwise reject Nyköping's -27.5% outright — which is exactly the point: the
 * threshold does not have to be widened past a real structural break to let it through, because
 * the break flag already does that job; the threshold only has to clear the real, GENUINE
 * maximum (37.447%).
 *
 * 50 is chosen with real headroom above that genuine 37.447% maximum (roughly 1.3x) — enough
 * that a comparable future housing boom would not trip the check, while still being far tighter
 * than "anything goes": a genuine data fault (a decimal-place error, a table swapped with
 * another municipality's, a doubled or halved population) would very likely still cross 50%
 * without being anywhere near a real value.
 */
export const POPULATION_CHANGE_JUMP_THRESHOLD = 50

const PRESENT = statusCode('present')
const STRUCTURAL_BREAK = statusCode('structural-break')

/** What the check stage actually validates: the finished, not-yet-written output of `buildAll()`
 * (which returns strictly more than this — `frozen` — so any real `buildAll()` result can be
 * passed here directly). */
export interface CheckInput {
  municipalities: Municipality[]
  indicators: Indicator[]
  series: IndicatorSeries[]
}

/** Rule 1: exactly 290 municipalities, matching the geometry (see this module's own comment on
 * `EXPECTED_MUNICIPALITY_COUNT` for why this does not itself read the geometry file). */
function checkMunicipalityCount(municipalities: Municipality[]): void {
  if (municipalities.length !== EXPECTED_MUNICIPALITY_COUNT) {
    throw new Error(
      `check: expected exactly ${EXPECTED_MUNICIPALITY_COUNT} municipalities (matching the ` +
        `known geometry-derived registry), got ${municipalities.length}`,
    )
  }
}

/** Rule 2: every series has one row per municipality and one column per year. Checked
 * independently of `shared/pantry.ts`'s own `IndicatorSeries` zod schema (which enforces the
 * same shape at `writePantryFile` time): the check stage runs BEFORE that point, on plain
 * `buildAll()` output that has never been through `IndicatorSeries.parse`, so this must not
 * rely on that schema having already run. */
function checkSeriesShape(
  indicator: Indicator,
  s: IndicatorSeries,
  municipalities: Municipality[],
): void {
  if (s.values.length !== municipalities.length) {
    throw new Error(
      `check: ${indicator.id}: has ${s.values.length} rows but there are ` +
        `${municipalities.length} municipalities — every series must publish exactly one row ` +
        'per municipality',
    )
  }
  if (s.status.length !== municipalities.length) {
    throw new Error(
      `check: ${indicator.id}: has ${s.status.length} status rows but there are ` +
        `${municipalities.length} municipalities — every series must publish exactly one ` +
        'status row per municipality',
    )
  }
  for (const [i, row] of s.values.entries()) {
    const code = municipalities[i]?.code ?? `(row ${i}, no municipality at this index)`
    if (row.length !== s.years.length) {
      throw new Error(
        `check: ${indicator.id}: municipality ${code} has ${row.length} value columns but the ` +
          `series declares ${s.years.length} years — every row must have one column per year`,
      )
    }
    const statusRow = s.status[i]
    if (statusRow === undefined || statusRow.length !== s.years.length) {
      throw new Error(
        `check: ${indicator.id}: municipality ${code} has ${statusRow?.length ?? 0} status ` +
          `columns but the series declares ${s.years.length} years — every row must have one ` +
          'status column per year',
      )
    }
  }
}

/**
 * Rule 3: no year outside an indicator's declared coverage carries a `present` value. Checked
 * against the `present` status specifically (not `perturbed`, `too-few-cases`, etc.) per this
 * task's own wording — every real indicator's Cell Key Method years already fall inside its own
 * declared `coverage` (verified against the real built data: population/density/migration/
 * share-65-plus's `perturbed` years all start at `CKM_FROM`, itself always inside their
 * `coverage.to`), so this is not a gap in practice, only a literal reading of the rule as
 * written.
 *
 * Uses the INDICATOR's own `coverage`, never a shared/global year range (`ctx.years` is only
 * ever population's own 1968-2025) — trap 2 in this task's brief names this as "the rule most
 * likely to produce false failures", because tax rate runs to 2026, mean age starts in 1998,
 * income ends in 2024 and education starts in 1985, all different from population and from
 * each other.
 */
function checkCoverage(
  indicator: Indicator,
  s: IndicatorSeries,
  municipalities: Municipality[],
): void {
  for (const [i, row] of s.values.entries()) {
    for (const [j, year] of s.years.entries()) {
      if (s.status[i]?.[j] !== PRESENT) continue
      if (year < indicator.coverage.from || year > indicator.coverage.to) {
        const m = municipalities[i]
        throw new Error(
          `check: ${indicator.id}: ${m?.code ?? `row ${i}`} in ${year} is marked 'present' but ` +
            `${year} is outside this indicator's declared coverage ` +
            `(${indicator.coverage.from}-${indicator.coverage.to}); value ${row[j]}`,
        )
      }
    }
  }
}

/**
 * Rule 7 (plan 19): a declared `coverage.years` describes the series exactly, and a series with
 * gaps declares one.
 *
 * `coverage.years` is written by hand in an indicator module; the series is built from SCB. The
 * two can drift, and when they do the site lies in both directions: the slider lights a year
 * with nothing in it, or dims one that has a value. The same reasoning as
 * [0018](../../docs/decisions/0018-stage-a-and-what-the-tables-said.md)'s 290-region assertion —
 * the declaration is a claim, so the build checks it rather than trusting it.
 *
 * The second half matters more than the first. Without it, an indicator whose series has holes
 * ships looking DENSE — `covered` falls back to the range, the slider lights fifty-nine years
 * for fifteen values, and nothing anywhere goes red. That is the defect plan 19 exists to fix,
 * so forgetting the declaration has to fail the build.
 */
function checkDeclaredYears(indicator: Indicator, s: IndicatorSeries): void {
  const declared = indicator.coverage.years
  const dense = s.years.length === s.years[s.years.length - 1]! - s.years[0]! + 1

  if (!declared) {
    if (!dense) {
      throw new Error(
        `check: ${indicator.id}: the series has gaps — ${s.years.length} years between ` +
          `${s.years[0]} and ${s.years[s.years.length - 1]} — but coverage declares no ` +
          '`years` list, so the site would light every year in the range as if it had data',
      )
    }
    return
  }

  const missing = declared.filter((y) => !s.years.includes(y))
  const extra = s.years.filter((y) => !declared.includes(y))
  if (missing.length > 0 || extra.length > 0) {
    throw new Error(
      `check: ${indicator.id}: coverage.years does not match the series — ` +
        `declared but absent: [${missing.join(', ')}]; ` +
        `in the series but not declared: [${extra.join(', ')}]`,
    )
  }
}

/**
 * Rule 5: every value lies inside its indicator's declared plausible range (`PLAUSIBLE_RANGES`
 * above). Refuses to check an indicator with no declared range at all, rather than silently
 * skipping the rule for it — a tenth indicator added later without updating this map is exactly
 * the kind of silent gap this stage exists to prevent.
 */
function checkPlausibleRange(
  indicator: Indicator,
  s: IndicatorSeries,
  municipalities: Municipality[],
): void {
  const range = PLAUSIBLE_RANGES[indicator.id]
  if (!range) {
    throw new Error(
      `check: ${indicator.id}: no plausible range declared in PLAUSIBLE_RANGES — every ` +
        'published indicator must declare one before it can be checked',
    )
  }
  for (const [i, row] of s.values.entries()) {
    for (const [j, v] of row.entries()) {
      if (v === null) continue
      if (v < range.min || v > range.max) {
        const m = municipalities[i]
        throw new Error(
          `check: ${indicator.id}: ${m?.code ?? `row ${i}`} in ${s.years[j]} has value ${v}, ` +
            `outside the declared plausible range [${range.min}, ${range.max}]`,
        )
      }
    }
  }
}

/** Rule 6: no indicator has zero non-null values. */
function checkNonEmpty(indicator: Indicator, s: IndicatorSeries): void {
  const hasAnyValue = s.values.some((row) => row.some((v) => v !== null))
  if (!hasAnyValue) {
    throw new Error(
      `check: ${indicator.id}: every value in this series is null — refusing to publish an ` +
        'indicator with zero real values',
    )
  }
}

/**
 * Rule 4: no implausible year-on-year jump that is not a flagged break. Applies specifically to
 * the `population-change` series (the one indicator in this pantry that IS a year-on-year
 * change, per this task's own wording — "a population change beyond a stated threshold"), if
 * one is present in `series` — a fixture exercising the other five rules in isolation need not
 * include it. A cell whose status is `structural-break` is exempt from the threshold check
 * ENTIRELY regardless of its value (not merely skipped because it happens to be null): this is
 * checked by reading the status directly, not by relying on structural-break cells always being
 * null in the current implementation, so this rule is actually exercised (rather than
 * vacuously passed) by a test cell that sets a large value AND `structural-break` together.
 */
function checkPopulationChangeJumps(
  series: IndicatorSeries[],
  municipalities: Municipality[],
): void {
  const s = series.find((x) => x.indicator === 'population-change')
  if (!s) return
  for (const [i, row] of s.values.entries()) {
    for (const [j, v] of row.entries()) {
      if (v === null) continue
      if (s.status[i]?.[j] === STRUCTURAL_BREAK) continue
      if (Math.abs(v) > POPULATION_CHANGE_JUMP_THRESHOLD) {
        const m = municipalities[i]
        throw new Error(
          `check: population-change: ${m?.code ?? `row ${i}`} in ${s.years[j]} changed by ` +
            `${v}%, beyond the ${POPULATION_CHANGE_JUMP_THRESHOLD}% plausibility threshold, and ` +
            "is not flagged 'structural-break'",
        )
      }
    }
  }
}

/**
 * Runs every rule above against a finished `buildAll()` result, throwing on the first violation
 * found, naming the indicator, the municipality, the year and the value wherever the violation
 * is about a specific cell. Intended to run BEFORE anything is written to disk (Task 13 wires
 * this into `publish()`, ahead of every `writePantryFile` call) — "the build refuses to ship
 * data that is wrong" only if this runs before the data is shipped, not after.
 */
export function check({ municipalities, indicators, series }: CheckInput): void {
  checkMunicipalityCount(municipalities)

  const indicatorById = new Map(indicators.map((ind) => [ind.id, ind]))
  for (const s of series) {
    const indicator = indicatorById.get(s.indicator)
    if (!indicator) {
      throw new Error(`check: series '${s.indicator}' has no matching indicator definition`)
    }
    checkSeriesShape(indicator, s, municipalities)
    checkCoverage(indicator, s, municipalities)
    checkDeclaredYears(indicator, s)
    checkPlausibleRange(indicator, s, municipalities)
    checkNonEmpty(indicator, s)
  }

  checkPopulationChangeJumps(series, municipalities)
}
