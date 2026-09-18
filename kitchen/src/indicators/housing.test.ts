import { describe, expect, it } from 'vitest'
import type { TableMeta } from '../scb/client'
import { housingDefined, HOUSING_TABLE, HOUSING_YEARS } from './housing'
import { selectionFor } from './source'
/** The municipality codes these fixtures offer, as a definition's resolver takes them. */
const KNOWN = ['0330', '0180']

/** Minimal fake TableMeta, mirroring density.test.ts's/income.test.ts's fakeMeta helper. */
function fakeMeta(
  overrides: Record<string, Array<{ code: string; label: string }>> = {},
): TableMeta {
  const defaults: Record<string, Array<{ code: string; label: string }>> = {
    Region: [
      { code: '00', label: 'Riket' },
      { code: '0010', label: 'Stor-Stockholm' }, // not a municipality — trap 1
      { code: '0330', label: 'Knivsta' },
      { code: '0180', label: 'Stockholm' },
    ],
    Fastighetstyp: [
      { code: '220', label: 'permanentbostad (ej tomträtt)' },
      { code: '221', label: 'fritidshus' },
    ],
    ContentsCode: [
      { code: 'BO0501C1', label: 'Antal' },
      { code: 'BO0501C2', label: 'Köpeskilling, medelvärde i tkr' },
    ],
  }
  const vars = { ...defaults, ...overrides }
  return {
    id: HOUSING_TABLE,
    label: HOUSING_TABLE,
    variables: Object.entries(vars).map(([code, values]) => ({ code, label: code, values })),
  }
}

describe("house-prices' two declared sources, resolved", () => {
  // Plan 15: these asserted housingPriceSelection/housingCountSelection, deleted with the
  // hand-written builder. The count source is the one the minimum-sale-count modifier declares.
  const price = (meta: TableMeta) => selectionFor(meta, housingDefined().sources[0]!, KNOWN)
  const count = (meta: TableMeta) =>
    selectionFor(meta, housingDefined().modifiers!.minCount!.counts[0]!, KNOWN)

  it("select the '220' (permanent home) Fastighetstyp code, resolved by its Swedish label, never '221' (holiday home)", () => {
    // '221' sits first in this fixture's ordering on purpose: picking "the first code" or
    // "the second code" instead of resolving by label would be wrong.
    const meta = fakeMeta({
      Fastighetstyp: [
        { code: '221', label: 'fritidshus' },
        { code: '220', label: 'permanentbostad (ej tomträtt)' },
      ],
    })
    expect(price(meta).Fastighetstyp).toEqual(['220'])
    expect(count(meta).Fastighetstyp).toEqual(['220'])
  })

  it('throws naming Fastighetstyp when no value carries the permanent-home label (label drift, never silently taking the wrong code)', () => {
    const meta = fakeMeta({ Fastighetstyp: [{ code: '220', label: 'something else' }] })
    expect(() => price(meta)).toThrow(/Fastighetstyp/)
  })

  it("resolves the price ContentsCode by its Swedish label 'Köpeskilling, medelvärde i tkr', not a hardcoded code", () => {
    const meta = fakeMeta({
      ContentsCode: [
        { code: 'ZZZ', label: 'Köpeskilling, medelvärde i tkr' },
        { code: 'BO0501C1', label: 'Antal' },
      ],
    })
    expect(price(meta).ContentsCode).toEqual(['ZZZ'])
  })

  it("resolves the count ContentsCode by its Swedish label 'Antal', not a hardcoded code", () => {
    const meta = fakeMeta({
      ContentsCode: [
        { code: 'BO0501C2', label: 'Köpeskilling, medelvärde i tkr' },
        { code: 'YYY', label: 'Antal' },
      ],
    })
    expect(count(meta).ContentsCode).toEqual(['YYY'])
  })

  it('selects only KNOWN municipality codes from Region, dropping a four-digit Stor-Stockholm-shaped code even though it is four digits too (trap 1)', () => {
    const sel = price(fakeMeta())
    expect(sel.Region).toEqual(['0330', '0180'])
    expect(sel.Region).not.toContain('0010')
  })
})

describe("HOUSING_YEARS: housing's own year range, distinct from population's ctx.years", () => {
  it('runs 1981 through 2025', () => {
    expect(HOUSING_YEARS[0]).toBe(1981)
    expect(HOUSING_YEARS[HOUSING_YEARS.length - 1]).toBe(2025)
  })
})
