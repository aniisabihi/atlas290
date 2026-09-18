import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  Indicator,
  OBSERVATION_STATUS,
  PantryIndex,
  PantryIndicator,
  statusCode,
  type IndicatorSeries,
  type Municipality,
} from '../../../shared/pantry'
import { DEFAULT_PANTRY_DIR } from '../publish'
import { roundSeriesValues } from '../round'
import { buildDefined, type Definition } from './define'
import { fetchCpi } from './cpi'
import { taxDefined } from './tax'
import { populationDefined } from './population'
import { densityDefined } from './density'
import { incomeDefined } from './income'
import { housingDefined } from './housing'
import { educationDefined } from './education'
import { migrationDefined } from './migration'
import { meanAgeDefined, share65PlusDefined } from './derived'
import { dependencyDefined, fertilityDefined, naturalChangeDefined } from './demography'
import { employmentDefined, unemploymentDefined } from './labour'
import { disposableDefined, taxBaseDefined } from './finance'
import {
  completedDefined,
  rentDefined,
  shareHousesDefined,
  shareRentalsDefined,
  stockDefined,
} from './dwellings'
import { educationMenDefined, educationWomenDefined } from './education'
import { emissionsDefined } from './environment'

/**
 * Plan 14, widened by plan 15: an indicator built from its definition must equal the one the
 * pantry already publishes — every value and every status byte.
 *
 * Asserted against the committed file rather than a fixture, because that file is what the whole
 * migration promises not to change. A fixture would only prove the new code agrees with itself.
 *
 * Plan 15 deletes the nine hand-written implementations these definitions replaced, along with
 * roughly 190 assertions against them. This file is what takes over as the regression net, so it
 * covers all nine by name rather than the one indicator plan 14 needed to prove the idea.
 *
 * WHAT THIS DOES NOT PROVE, stated because it would otherwise read as more than it is: the pantry
 * is generated from these same definitions, so agreeing with it proves a definition has not
 * DRIFTED, never that it was right to begin with. The claim about correctness lives in
 * `src/indicators.semantics.test.ts` and `src/indicators.headline.test.ts`, whose figures were
 * derived independently — hand-summed from a frozen chunk, or spot-checked against the live SCB
 * API — and are pinned there.
 */

const offline: typeof fetch = async (input) => {
  throw new Error(`these tests must be offline but tried to fetch ${String(input)}`)
}

const index = PantryIndex.parse(
  JSON.parse(readFileSync(join(DEFAULT_PANTRY_DIR, 'data/index.json'), 'utf8')) as unknown,
)

function published(id: string): IndicatorSeries {
  return PantryIndicator.parse(
    JSON.parse(
      readFileSync(join(DEFAULT_PANTRY_DIR, `data/indicators/${id}.json`), 'utf8'),
    ) as unknown,
  ).series
}

/**
 * The nine, by name. Deliberately not a loop over whatever the modules happen to export: an
 * indicator that stopped being a definition would then leave this file silently smaller.
 *
 * `population-change` is absent because it is not a definition and never became one — it
 * propagates four statuses through a year-over-year comparison and applies the structural-break
 * rule, and ADR-0014 D5 records why a generic builder for it would have exactly one user.
 */
const DEFINED: ReadonlyArray<readonly [id: string, definition: () => Definition]> = [
  ['population', populationDefined],
  ['tax-rate', taxDefined],
  ['density', densityDefined],
  ['mean-age', meanAgeDefined],
  ['median-income', incomeDefined],
  ['house-prices', housingDefined],
  ['post-secondary-education', educationDefined],
  ['share-65-plus', share65PlusDefined],
  ['net-migration-rate', migrationDefined],
  ['fertility-rate', fertilityDefined],
  ['dependency-ratio', dependencyDefined],
  ['employment-rate', employmentDefined],
  ['unemployment-rate', unemploymentDefined],
  ['taxable-income-per-resident', taxBaseDefined],
  ['disposable-household-income', disposableDefined],
  ['median-rent-per-sqm', rentDefined],
  ['natural-change-rate', naturalChangeDefined],
  ['dwellings-completed-rate', completedDefined],
  ['dwellings-per-1000', stockDefined],
  ['greenhouse-gas-per-resident', emissionsDefined],
  ['share-houses', shareHousesDefined],
  ['share-rentals', shareRentalsDefined],
  ['post-secondary-education-women', educationWomenDefined],
  ['post-secondary-education-men', educationMenDefined],
]

/**
 * A build context standing in for the registry's, with two differences that matter.
 *
 * `series` is filled from the PUBLISHED population rather than by building it first, so each
 * ratio indicator is checked against ground truth instead of against whatever this run happened
 * to compute upstream — a wrong population would otherwise cancel out on both sides.
 *
 * `cpi` is fetched here because income and housing fill that slot themselves inside their own
 * `build()` (cpi.ts is deliberately independent of registry.ts), and `buildDefined` reads it.
 */
async function contextFor(id: string): Promise<Parameters<typeof buildDefined>[1]> {
  const freeze = { deps: { fetchImpl: offline } }
  const needsCpi =
    id === 'median-income' || id === 'house-prices' || id === 'taxable-income-per-resident'
  return {
    municipalities: index.municipalities,
    years: [],
    freeze,
    frozen: [],
    cpi: needsCpi ? (await fetchCpi(freeze)).index : undefined,
    series: new Map([['population', published('population')]]),
  }
}

describe('an indicator built from its definition', () => {
  it.each(DEFINED)(
    'reproduces the published %s exactly, value for value and status for status',
    async (id, definition) => {
      const defined = definition()
      const series = await buildDefined(defined, await contextFor(id))
      // Two steps stand between a built series and a published one, and both are applied here
      // so that what is compared is what would actually be written.
      //
      // `publish()` rounds once, at the very end, to the precision each indicator's unit carries
      // — never mid-build, so that a ratio divides by an unrounded denominator.
      //
      // Then it serialises. That is not a formality: a net-migration rate that rounds to a very
      // small negative number is -0 in memory, and `JSON.stringify` writes it as `0`. Comparing
      // the in-memory object would fail on a difference no published byte has.
      const wouldPublish: IndicatorSeries = JSON.parse(
        JSON.stringify(roundSeriesValues(series, defined.indicator.unit)),
      ) as IndicatorSeries
      expect(wouldPublish).toEqual(published(id))
    },
  )

  it('reports what it read, so the provenance manifest still names every frozen chunk', async () => {
    const ctx = await contextFor('tax-rate')
    await buildDefined(taxDefined(), ctx)
    expect(ctx.frozen.length).toBeGreaterThan(0)
  })
})

/**
 * Plan 16 Task 2: the two builders that compute from the pantry alone.
 *
 * `house-price-to-income` is one published series over another; `post-secondary-education-gap`
 * is one minus another. Neither fetches anything, so both are tested against fabricated series
 * rather than frozen responses — there is no SCB request to freeze.
 */
const TWO: Municipality[] = [
  { code: '0180', name: { sv: 'Stockholm', en: 'Stockholm' }, county: '01' },
  { code: '0330', name: { sv: 'Knivsta', en: 'Knivsta' }, county: '03' }, // created 2002
]

function fakeSeries(
  id: string,
  years: number[],
  values: Array<Array<number | null>>,
  status?: Array<Array<number>>,
): IndicatorSeries {
  return {
    indicator: id,
    years,
    values,
    status:
      status ??
      values.map((row) => row.map((v) => statusCode(v === null ? 'not-yet-published' : 'present'))),
  }
}

function ctxWith(series: IndicatorSeries[]): Parameters<typeof buildDefined>[1] {
  return {
    municipalities: TWO,
    years: [],
    freeze: { deps: { fetchImpl: offline } },
    frozen: [],
    series: new Map(series.map((s) => [s.indicator, s])),
  }
}

const QUOTIENT: Indicator = Indicator.parse({
  id: 'a-over-b',
  name: { sv: 'A', en: 'A' },
  description: { sv: 'x', en: 'x' },
  unit: 'years',
  priceBasis: 'none',
  scale: { kind: 'sequential', breaks: [] },
  coverage: { from: 2020, to: 2021 },
  caveat: { sv: 'x', en: 'x' },
  derivation: 'x',
  sources: [{ table: 'TAB1', contentCode: 'C', note: 'n' }],
  sensitivity: 'none',
})

describe('quotient: one published series over another', () => {
  const defn = (): Definition => ({
    indicator: QUOTIENT,
    sources: [],
    spec: { kind: 'quotient', of: 'top', by: 'bottom' },
  })

  it('divides cell by cell, over the years both series publish', async () => {
    const ctx = ctxWith([
      fakeSeries(
        'top',
        [2020, 2021],
        [
          [10, 20],
          [5, 8],
        ],
      ),
      fakeSeries(
        'bottom',
        [2020, 2021],
        [
          [2, 4],
          [5, 2],
        ],
      ),
    ])
    const s = await buildDefined(defn(), ctx)
    expect(s.years).toEqual([2020, 2021])
    expect(s.values[0]).toEqual([5, 5])
  })

  it('takes only the years BOTH series cover, never inventing one', async () => {
    const ctx = ctxWith([
      fakeSeries(
        'top',
        [2019, 2020, 2021],
        [
          [1, 10, 20],
          [1, 5, 8],
        ],
      ),
      fakeSeries(
        'bottom',
        [2020, 2021, 2022],
        [
          [2, 4, 9],
          [5, 2, 9],
        ],
      ),
    ])
    const s = await buildDefined(defn(), ctx)
    expect(s.years).toEqual([2020, 2021])
  })

  it('yields null, never Infinity, when the divisor is zero', async () => {
    const ctx = ctxWith([
      fakeSeries(
        'top',
        [2020, 2021],
        [
          [10, 20],
          [5, 8],
        ],
      ),
      fakeSeries(
        'bottom',
        [2020, 2021],
        [
          [0, 4],
          [5, 2],
        ],
      ),
    ])
    const s = await buildDefined(defn(), ctx)
    expect(s.values[0]![0]).toBeNull()
    expect(OBSERVATION_STATUS[s.status[0]![0]!]).toBe('not-yet-published')
  })

  it('refuses a series that has not been built yet, naming it', async () => {
    await expect(
      buildDefined(defn(), ctxWith([fakeSeries('top', [2020], [[1], [1]])])),
    ).rejects.toThrow(/a-over-b: needs bottom/)
  })

  it("keeps a municipality's did-not-exist years did-not-exist", async () => {
    const ctx = ctxWith([
      fakeSeries(
        'top',
        [2000, 2020],
        [
          [10, 20],
          [null, 8],
        ],
        [
          [statusCode('present'), statusCode('present')],
          [statusCode('did-not-exist'), statusCode('present')],
        ],
      ),
      fakeSeries(
        'bottom',
        [2000, 2020],
        [
          [2, 4],
          [null, 2],
        ],
        [
          [statusCode('present'), statusCode('present')],
          [statusCode('did-not-exist'), statusCode('present')],
        ],
      ),
    ])
    const s = await buildDefined(defn(), ctx)
    expect(OBSERVATION_STATUS[s.status[1]![0]!]).toBe('did-not-exist')
    expect(s.values[1]![0]).toBeNull()
  })

  it('carries perturbed forward: a quotient of a fuzzed figure is fuzzed', async () => {
    const ctx = ctxWith([
      fakeSeries('top', [2020], [[10], [5]], [[statusCode('perturbed')], [statusCode('present')]]),
      fakeSeries('bottom', [2020], [[2], [5]]),
    ])
    const s = await buildDefined(defn(), ctx)
    expect(OBSERVATION_STATUS[s.status[0]![0]!]).toBe('perturbed')
    expect(OBSERVATION_STATUS[s.status[1]![0]!]).toBe('present')
  })
})

describe('difference: one published series minus another', () => {
  const defn = (): Definition => ({
    indicator: { ...QUOTIENT, id: 'a-minus-b', unit: 'percent' },
    sources: [],
    spec: { kind: 'difference', of: 'women', minus: 'men' },
  })

  it('subtracts cell by cell, and a negative difference is a real value', async () => {
    const ctx = ctxWith([
      fakeSeries(
        'women',
        [2020, 2021],
        [
          [40, 50],
          [30, 20],
        ],
      ),
      fakeSeries(
        'men',
        [2020, 2021],
        [
          [30, 55],
          [30, 25],
        ],
      ),
    ])
    const s = await buildDefined(defn(), ctx)
    expect(s.values[0]).toEqual([10, -5])
    expect(s.values[1]).toEqual([0, -5])
  })

  it('yields null where either side is null, rather than treating it as zero', async () => {
    const ctx = ctxWith([
      fakeSeries('women', [2020], [[null], [30]]),
      fakeSeries('men', [2020], [[30], [null]]),
    ])
    const s = await buildDefined(defn(), ctx)
    expect(s.values[0]![0]).toBeNull()
    expect(s.values[1]![0]).toBeNull()
  })
})
