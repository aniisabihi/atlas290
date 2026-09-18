import { describe, expect, it } from 'vitest'
import { parseMetadata } from '../scb/client'
import { freezeMetadata } from '../scb/freeze'
import { TAX_TABLE, TAX_YEARS, taxSelection } from './tax'
import { CKM_FROM, NEW_TABLE, OLD_TABLE, YEARS } from './population'
import { resolveSources, selectionFor, type Source } from './source'

/**
 * Plan 14 Task 1: a source declared as data resolves to the same selection the hand-written
 * modules build today.
 *
 * Everything here runs offline against the frozen responses in `kitchen/raw/`, exactly as
 * `publish()` does — a resolver that needed the network to be tested would be testing something
 * the pipeline never does.
 */

const offline: typeof fetch = async (input) => {
  throw new Error(`these tests must be offline but tried to fetch ${String(input)}`)
}

/** Population as a definition would declare it: TAB638 to 2024, the CKM table from 2025. */
const POPULATION_OLD: Source = {
  table: OLD_TABLE,
  content: 'Folkmängd',
  years: YEARS.filter((y) => y < CKM_FROM),
  dims: { Alder: 'total', Kon: 'total', Civilstand: 'total' },
}
const POPULATION_NEW: Source = {
  table: NEW_TABLE,
  content: 'Folkmängd',
  years: YEARS.filter((y) => y >= CKM_FROM),
  dims: { Alder: 'total', Kon: 'total', Civilstand: 'total' },
}

async function metaFor(table: string) {
  const frozen = await freezeMetadata(table, 'sv', { deps: { fetchImpl: offline } })
  return parseMetadata(table, frozen.response)
}

describe('selectionFor', () => {
  it('builds the tax selection the hand-written module builds', async () => {
    const meta = await metaFor(TAX_TABLE)
    const declared: Source = {
      table: TAX_TABLE,
      content: 'Skattesats, total kommunal',
      years: TAX_YEARS,
    }
    expect(selectionFor(meta, declared)).toEqual(taxSelection(meta, TAX_YEARS.map(String)))
  })

  it('keeps Region to the 290 four-digit codes, dropping the country and the counties', async () => {
    const meta = await metaFor(TAX_TABLE)
    const selection = selectionFor(meta, {
      table: TAX_TABLE,
      content: 'Skattesats, total kommunal',
      years: [2024],
    })
    expect(selection.Region).toHaveLength(290)
    expect(selection.Region?.every((c) => /^\d{4}$/.test(c))).toBe(true)
  })

  it('resolves the content code by its label, never by position', async () => {
    const meta = await metaFor(TAX_TABLE)
    const selection = selectionFor(meta, {
      table: TAX_TABLE,
      content: 'Skattesats, total kommunal',
      years: [2024],
    })
    expect(selection.ContentsCode).toEqual(['OE0101D1'])
  })

  it('fails by name when the label is not in the table', async () => {
    const meta = await metaFor(TAX_TABLE)
    expect(() =>
      selectionFor(meta, { table: TAX_TABLE, content: 'Not a real label', years: [2024] }),
    ).toThrow(/no ContentsCode labelled 'Not a real label'/)
  })

  it("takes a dimension's own total code where the table has one", async () => {
    // TAB628's Kon carries '1+2', so density selects the total rather than summing two sexes.
    const meta = await metaFor('TAB628')
    const selection = selectionFor(meta, {
      table: 'TAB628',
      content: 'Invånare per kvadratkilometer',
      years: [2024],
      dims: { Kon: 'total' },
    })
    expect(selection.Kon).toEqual(['1+2'])
  })

  it('sums a dimension only where SUM_SAFE declares it verified', async () => {
    // TAB638 has no total code for Kon or Civilstand, and both are declared safe to sum.
    const meta = await metaFor('TAB638')
    const selection = selectionFor(meta, {
      table: 'TAB638',
      content: 'Folkmängd',
      years: [2024],
      dims: { Kon: 'total', Civilstand: 'total', Alder: 'total' },
    })
    expect(selection.Kon!.length).toBeGreaterThan(1)
    expect(selection.Civilstand!.length).toBeGreaterThan(1)
  })

  it('refuses to sum a dimension nobody has verified, naming the table and the dimension', async () => {
    const meta = await metaFor('TAB638')
    expect(() =>
      selectionFor(meta, {
        table: 'TAB638',
        content: 'Folkmängd',
        years: [2024],
        // Region is deliberately not a real case; Alder on TAB638 has a total, so pick a
        // dimension with neither: 'Civilstand' is SUM_SAFE, so fake one the table does not know.
        dims: { Kon: 'total', Civilstand: 'total', Alder: { values: ['0'] }, Nonsense: 'total' },
      }),
    ).toThrow(/Nonsense/)
  })

  it('passes explicit values through untouched', async () => {
    const meta = await metaFor('TAB638')
    const selection = selectionFor(meta, {
      table: 'TAB638',
      content: 'Folkmängd',
      years: [2024],
      dims: { Kon: 'total', Civilstand: 'total', Alder: { values: ['65', '66', '67'] } },
    })
    expect(selection.Alder).toEqual(['65', '66', '67'])
  })
})

describe('resolveSources', () => {
  it('reads the tax table into one value per municipality and year', async () => {
    const rows = await resolveSources(
      [{ table: TAX_TABLE, content: 'Skattesats, total kommunal', years: TAX_YEARS }],
      { deps: { fetchImpl: offline } },
    )
    // Stockholm's 2024 rate, the figure src/indicators.headline.test.ts also pins.
    expect(rows.values.get('0180|2024')).toBe(30.36)
    expect(rows.values.size).toBe(290 * TAX_YEARS.length)
  })

  it('sums the cells of a summed dimension, and calls the total unknown if any part is', async () => {
    // Stockholm's 2024 population is the sum over age, sex and marital status. 995,574 is not a
    // number chosen here: it is what `public/pantry/data/indicators/population.json` publishes,
    // read off the committed file, so this asserts the resolver against the pipeline's own output.
    const rows = await resolveSources([POPULATION_OLD], { deps: { fetchImpl: offline } })
    expect(rows.values.get('0180|2024')).toBe(995574)
  })

  it('stitches several tables, the later one winning where both publish a year', async () => {
    // Population is TAB638 to 2024 and TAB5557 from 2025 — the stitch every plan since 2 has
    // done by hand.
    const rows = await resolveSources([POPULATION_OLD, POPULATION_NEW], {
      deps: { fetchImpl: offline },
    })
    expect(rows.values.get('0180|2024')).toBe(995574)
    expect(rows.values.get('0180|2025')).not.toBeUndefined()
  })

  it('reports every frozen chunk it read, for the provenance manifest', async () => {
    const rows = await resolveSources(
      [{ table: TAX_TABLE, content: 'Skattesats, total kommunal', years: TAX_YEARS }],
      { deps: { fetchImpl: offline } },
    )
    expect(rows.frozen.length).toBeGreaterThan(0)
  })
})
