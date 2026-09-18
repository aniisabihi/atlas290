import { describe, expect, it } from 'vitest'
import { TAX_YEARS } from './tax'

/**
 * Plan 15: this file held `taxSelection` and `buildTaxSeries` tests until both functions were
 * deleted. Everything they asserted is covered elsewhere and deliberately not duplicated here:
 * the selection's shape and its label resolution by `source.test.ts`, the built series by
 * `define.test.ts`, and the real Stockholm and Arjeplog rates by
 * `src/indicators.semantics.test.ts`, which reads them off the published pantry.
 *
 * What is left is the one claim that belongs to this module alone.
 */
describe("TAX_YEARS: tax rate's own year range, distinct from population's", () => {
  it('runs 2000 through 2026 — one year beyond every other indicator', () => {
    expect(TAX_YEARS[0]).toBe(2000)
    expect(TAX_YEARS[TAX_YEARS.length - 1]).toBe(2026)
  })
})
