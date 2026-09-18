import { describe, expect, it } from 'vitest'
import type { TableMeta } from '../scb/client'
import {
  migrationDefined,
  MIGRATION_TABLE_OLD,
  MIGRATION_TABLE_MID,
  MIGRATION_TABLE_NEW,
  MIGRATION_YEARS,
} from './migration'
import { selectionFor } from './source'
/** The municipality codes these fixtures offer, as a definition's resolver takes them. */
const KNOWN = ['0330', '0180']

/** Minimal fake TableMeta, mirroring tax.test.ts's/density.test.ts's fakeMeta helper. */
function fakeMeta(
  table: string,
  overrides: Record<string, Array<{ code: string; label: string }>> = {},
): TableMeta {
  const defaults: Record<string, Array<{ code: string; label: string }>> = {
    Region: [
      { code: '00', label: 'Riket' },
      { code: '0010', label: 'Stor-Stockholm' },
      { code: '0020', label: 'Stor-Göteborg' },
      { code: '0030', label: 'Stor-Malmö' },
      { code: '0330', label: 'Knivsta' },
      { code: '0180', label: 'Stockholm' },
    ],
    Alder: [
      { code: '0', label: '0 år' },
      { code: 'tot', label: 'totalt ålder' },
    ],
    Kon: [
      { code: '1', label: 'män' },
      { code: '2', label: 'kvinnor' },
    ],
    ContentsCode: [{ code: 'BE0101C5', label: 'Flyttningsöverskott' }],
  }
  const vars = { ...defaults, ...overrides }
  return {
    id: table,
    label: table,
    variables: Object.entries(vars).map(([code, values]) => ({ code, label: code, values })),
  }
}

describe("net-migration-rate's declared sources, resolved", () => {
  // Plan 15: these asserted `migrationSelection`, deleted with the hand-written builder. The
  // three stitched tables declare the same dimension rules, so sources[0] resolves them all —
  // what differs between the fixtures is the table's own metadata, which is the point.
  const resolve = (meta: TableMeta) => selectionFor(meta, migrationDefined().sources[0]!, KNOWN)

  it("resolves the ContentsCode by its Swedish label 'Flyttningsöverskott', not a hardcoded code", () => {
    const meta = fakeMeta(MIGRATION_TABLE_OLD, {
      ContentsCode: [{ code: 'ZZZ999', label: 'Flyttningsöverskott' }],
    })
    const sel = resolve(meta)
    expect(sel.ContentsCode).toEqual(['ZZZ999'])
  })

  it('throws naming the label when no ContentsCode carries it (label drift, not silently taking the wrong code)', () => {
    const meta = fakeMeta(MIGRATION_TABLE_OLD, {
      ContentsCode: [{ code: 'X', label: 'Something else' }],
    })
    expect(() => resolve(meta)).toThrow(/Flyttningsöverskott/)
  })

  it('selects only KNOWN municipality codes from Region, dropping Stor-Stockholm/Göteborg/Malmö even though they are four digits too (trap 1, also verified on TAB6640)', () => {
    const sel = resolve(fakeMeta(MIGRATION_TABLE_MID))
    expect(sel.Region).toEqual(['0330', '0180'])
    expect(sel.Region).not.toContain('0010')
    expect(sel.Region).not.toContain('0020')
    expect(sel.Region).not.toContain('0030')
  })

  it('drops a known municipality code the table itself does not offer, rather than requesting a value that would fail (TAB1211 pre-1998-renumbering gap)', () => {
    // 0330 (Knivsta) is a real, current municipality code, but is simply absent from this
    // fixture's Region list — standing in for TAB1211's real 49 renamed-municipality gap.
    const meta = fakeMeta(MIGRATION_TABLE_OLD, {
      Region: [
        { code: '00', label: 'Riket' },
        { code: '0180', label: 'Stockholm' },
      ],
    })
    const sel = resolve(meta)
    expect(sel.Region).toEqual(['0180'])
  })

  it('sums the two sexes when the table has no Kon total, rather than throwing or picking one (TAB1211/TAB1212 via SUM_SAFE)', () => {
    const sel = resolve(fakeMeta(MIGRATION_TABLE_OLD))
    expect(sel.Kon).toEqual(['1', '2'])
  })

  it("selects the 'TotSa' sex total directly when the table has one (TAB6640), instead of summing", () => {
    const meta = fakeMeta(MIGRATION_TABLE_NEW, {
      Kon: [
        { code: 'TotSa', label: 'totalt, samtliga män och kvinnor' },
        { code: '1', label: 'män' },
        { code: '2', label: 'kvinnor' },
      ],
      ContentsCode: [{ code: '00000868', label: 'Flyttningsöverskott' }],
    })
    const sel = resolve(meta)
    expect(sel.Kon).toEqual(['TotSa'])
  })

  it("resolves the age total by label ('tot'), not by array position", () => {
    const sel = resolve(fakeMeta(MIGRATION_TABLE_OLD))
    expect(sel.Alder).toEqual(['tot'])
  })
})

describe("MIGRATION_YEARS: migration's own year range, distinct from population's ctx.years", () => {
  it('runs 1968 through 2025', () => {
    expect(MIGRATION_YEARS[0]).toBe(1968)
    expect(MIGRATION_YEARS[MIGRATION_YEARS.length - 1]).toBe(2025)
  })
})
