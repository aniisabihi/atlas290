import { describe, expect, it } from 'vitest'
import type { TableMeta } from '../scb/client'
import { incomeDefined, INCOME_TABLE, INCOME_YEARS } from './income'
import { selectionFor } from './source'
/** The municipality codes these fixtures offer, as a definition's resolver takes them. */
const KNOWN = ['0330', '0180']

/** Minimal fake TableMeta, mirroring tax.test.ts's/density.test.ts's fakeMeta helper. */
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
    Kon: [
      { code: '1', label: 'män' },
      { code: '2', label: 'kvinnor' },
      { code: '1+2', label: 'totalt' },
    ],
    Alder: [
      { code: '16-19', label: '16–19 år' },
      { code: 'tot16+', label: 'totalt 16+ år' },
    ],
    Inkomstklass: [
      { code: '0', label: '0' },
      { code: 'TOT', label: 'totalt' },
    ],
    ContentsCode: [{ code: 'HE0110J8', label: 'Medianinkomst, tkr' }],
  }
  const vars = { ...defaults, ...overrides }
  return {
    id: INCOME_TABLE,
    label: INCOME_TABLE,
    variables: Object.entries(vars).map(([code, values]) => ({ code, label: code, values })),
  }
}

describe("median-income's declared source, resolved", () => {
  // Plan 15: these asserted `incomeSelection`, deleted with the hand-written builder. They now
  // assert the declaration the pipeline uses, through the shared resolver.
  const resolve = (meta: TableMeta) => selectionFor(meta, incomeDefined().sources[0]!, KNOWN)

  it("resolves the ContentsCode by its Swedish label 'Medianinkomst, tkr', not a hardcoded HE0110J8", () => {
    const meta = fakeMeta({ ContentsCode: [{ code: 'ZZZ999', label: 'Medianinkomst, tkr' }] })
    const sel = resolve(meta)
    expect(sel.ContentsCode).toEqual(['ZZZ999'])
  })

  it('throws naming the label when no ContentsCode carries it (label drift, not silently taking the wrong code)', () => {
    const meta = fakeMeta({ ContentsCode: [{ code: 'X', label: 'Something else' }] })
    expect(() => resolve(meta)).toThrow(/Medianinkomst, tkr/)
  })

  it("selects the 'tot16+' age total, not any other age code, and not summing", () => {
    const sel = resolve(fakeMeta())
    expect(sel.Alder).toEqual(['tot16+'])
  })

  it('throws naming the Alder dimension when the table offers no recognised age total (never silently summing a median)', () => {
    const meta = fakeMeta({ Alder: [{ code: '16-19', label: '16–19 år' }] })
    expect(() => resolve(meta)).toThrow(/dimension Alder has no recognised total code/)
  })

  it("selects the '1+2' sex total, not any other Kon code", () => {
    const sel = resolve(fakeMeta())
    expect(sel.Kon).toEqual(['1+2'])
  })

  it("selects the 'TOT' income-class total, not any single bracket", () => {
    const sel = resolve(fakeMeta())
    expect(sel.Inkomstklass).toEqual(['TOT'])
  })

  it('throws naming the Inkomstklass dimension when the table offers no recognised total (distinct wording from the Alder guard, so a loose match on one cannot hide a break in the other)', () => {
    const meta = fakeMeta({ Inkomstklass: [{ code: '0', label: '0' }] })
    expect(() => resolve(meta)).toThrow(/dimension Inkomstklass has no recognised total code/)
  })

  it('selects only KNOWN municipality codes from Region, dropping a four-digit Stor-Stockholm-shaped code even though it is four digits too (trap 1)', () => {
    const sel = resolve(fakeMeta())
    expect(sel.Region).toEqual(['0330', '0180'])
    expect(sel.Region).not.toContain('0010')
  })

  it('drops a known municipality code the table itself does not offer, rather than requesting a value that would fail', () => {
    const meta = fakeMeta({
      Region: [
        { code: '00', label: 'Riket' },
        { code: '0180', label: 'Stockholm' },
      ],
    })
    const sel = resolve(meta)
    expect(sel.Region).toEqual(['0180'])
  })
})

describe("INCOME_YEARS: income's own year range, distinct from population's ctx.years", () => {
  it('runs 1999 through 2024', () => {
    expect(INCOME_YEARS[0]).toBe(1999)
    expect(INCOME_YEARS[INCOME_YEARS.length - 1]).toBe(2024)
  })
})
