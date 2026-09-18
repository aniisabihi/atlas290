import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PantryIndex, PantryIndicator, type IndicatorSeries } from '../../../shared/pantry'
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
  const needsCpi = id === 'median-income' || id === 'house-prices'
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
