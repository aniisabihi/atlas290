import { describe, expect, it } from 'vitest'
import {
  Indicator,
  IndicatorMeta,
  IndicatorSeries,
  PantryData,
  PantryIndex,
  PantryIndicator,
  PantryView,
  assemblePantry,
  splitPantry,
  viewOf,
} from './pantry'

/**
 * Plan 13 Task 1: the pantry stops being one file.
 *
 * Everything here is about the CONTAINER. No value semantic changes: `Indicator`,
 * `IndicatorSeries`, `Municipality` and `OBSERVATION_STATUS` are untouched, and the tests that
 * prove them live in pantry.test.ts exactly as before.
 *
 * The property that matters most is at the bottom: split and assemble are inverse, so the
 * published pantry can be taken apart into files and put back together without losing a byte.
 */

const stockholm = { code: '0180', name: { sv: 'Stockholm', en: 'Stockholm' }, county: '01' }
const goteborg = { code: '1480', name: { sv: 'Göteborg', en: 'Gothenburg' }, county: '14' }
const priceIndex = { base: 2025, values: { '2024': 100, '2025': 101 } }

function indicatorOf(id: string, extra: Record<string, unknown> = {}) {
  return Indicator.parse({
    id,
    name: { sv: id, en: id },
    description: { sv: `Beskrivning av ${id}.`, en: `Description of ${id}.` },
    unit: 'count',
    priceBasis: 'none',
    scale: { kind: 'sequential', breaks: [1, 2, 3, 4, 5, 6] },
    coverage: { from: 2024, to: 2025 },
    caveat: { sv: 'Förbehåll.', en: 'Caveat.' },
    sensitivity: 'none',
    sources: [{ table: 'TAB638', contentCode: 'BE0101N1', note: '2024–2025' }],
    derivation: `How ${id} was computed.`,
    ...extra,
  })
}

function seriesOf(id: string) {
  return IndicatorSeries.parse({
    indicator: id,
    years: [2024, 2025],
    values: [
      [1, 2],
      [3, 4],
    ],
    status: [
      [0, 0],
      [0, 0],
    ],
  })
}

function pantryOf(ids: readonly string[]) {
  return PantryData.parse({
    schemaVersion: 1,
    municipalities: [stockholm, goteborg],
    indicators: ids.map((id) => indicatorOf(id)),
    series: ids.map((id) => seriesOf(id)),
    priceIndex,
  })
}

describe('IndicatorMeta', () => {
  it('is an Indicator with its prose removed, and nothing else removed', () => {
    const full = indicatorOf('population')
    const meta = IndicatorMeta.parse(full)
    expect(Object.keys(meta).sort()).toEqual(
      Object.keys(full)
        .filter((k) => !['description', 'caveat', 'derivation', 'sources'].includes(k))
        .sort(),
    )
  })

  it('keeps every field the map, legend, picker and URL parser read', () => {
    const meta = IndicatorMeta.parse(
      indicatorOf('house-prices', {
        unit: 'sek',
        priceBasis: 'fixed-latest-year',
        priceBasisYear: 2025,
        publishedStep: 1000,
        minCount: 20,
        scale: { kind: 'diverging', reference: 'national-median', breaks: [1, 2, 3, 4, 5, 6] },
      }),
    )
    expect(meta.unit).toBe('sek')
    expect(meta.priceBasisYear).toBe(2025)
    expect(meta.publishedStep).toBe(1000)
    expect(meta.minCount).toBe(20)
    expect(meta.scale.reference).toBe('national-median')
    expect(meta.coverage).toEqual({ from: 2024, to: 2025 })
  })

  it('still enforces the price-basis rules the full Indicator enforces', () => {
    // The refinement is shared rather than restated, so an indicator claiming a price basis
    // year without an adjustment cannot slip through the index just because its prose is gone.
    expect(() =>
      IndicatorMeta.parse({
        ...IndicatorMeta.parse(indicatorOf('x')),
        priceBasisYear: 2025,
      }),
    ).toThrow(/priceBasisYear is set/)
  })
})

describe('PantryIndicator', () => {
  it('pairs one indicator with its own series', () => {
    const part = PantryIndicator.parse({
      indicator: indicatorOf('population'),
      series: seriesOf('population'),
    })
    expect(part.series.indicator).toBe('population')
  })

  it('refuses a file whose series belongs to a different indicator', () => {
    // Only possible once each indicator is its own file: nothing else would notice that
    // data/indicators/population.json actually contained the tax rate.
    expect(() =>
      PantryIndicator.parse({
        indicator: indicatorOf('population'),
        series: seriesOf('tax-rate'),
      }),
    ).toThrow(/tax-rate/)
  })
})

describe('PantryIndex', () => {
  it('carries the municipalities, the price index and every indicator as metadata', () => {
    const { index } = splitPantry(pantryOf(['population', 'tax-rate']))
    expect(index.municipalities).toHaveLength(2)
    expect(index.indicators.map((i) => i.id)).toEqual(['population', 'tax-rate'])
    expect(index.priceIndex.base).toBe(2025)
  })

  it('refuses duplicate indicator ids, because the id is the file name', () => {
    const { index } = splitPantry(pantryOf(['population']))
    expect(() =>
      PantryIndex.parse({ ...index, indicators: [...index.indicators, ...index.indicators] }),
    ).toThrow(/population/)
  })
})

describe('splitPantry and assemblePantry are inverse', () => {
  it('takes a pantry apart and puts it back together unchanged', () => {
    const pantry = pantryOf(['population', 'tax-rate', 'density'])
    const { index, parts } = splitPantry(pantry)
    expect(parts.map((p) => p.indicator.id)).toEqual(['population', 'tax-rate', 'density'])
    expect(assemblePantry(index, parts)).toEqual(pantry)
  })

  it("restores the index's indicator order, whatever order the parts arrive in", () => {
    // Order is load-bearing: src/state/url.ts takes the FIRST indicator as the default view,
    // so a pantry reassembled in a different order would open on a different map.
    const pantry = pantryOf(['population', 'tax-rate', 'density'])
    const { index, parts } = splitPantry(pantry)
    const shuffled = [parts[2]!, parts[0]!, parts[1]!]
    expect(assemblePantry(index, shuffled)).toEqual(pantry)
  })

  it('refuses to assemble when a part is missing', () => {
    const { index, parts } = splitPantry(pantryOf(['population', 'tax-rate']))
    expect(() => assemblePantry(index, [parts[0]!])).toThrow(/tax-rate/)
  })

  it('refuses to assemble a part the index does not list', () => {
    const { index, parts } = splitPantry(pantryOf(['population']))
    const stray = PantryIndicator.parse({
      indicator: indicatorOf('stowaway'),
      series: seriesOf('stowaway'),
    })
    expect(() => assemblePantry(index, [...parts, stray])).toThrow(/stowaway/)
  })

  it('refuses a part whose rows do not match the municipality count', () => {
    const { index, parts } = splitPantry(pantryOf(['population']))
    const short = {
      indicator: parts[0]!.indicator,
      series: { ...parts[0]!.series, values: [[1, 2]], status: [[0, 0]] },
    }
    expect(() => assemblePantry(index, [short])).toThrow(/rows/)
  })
})

describe('viewOf', () => {
  it('builds what the site renders from the index plus the series it has so far', () => {
    // The site cannot hold a PantryData until every file has arrived, because an indicator it
    // has not fetched has no prose. It does not need one: only AboutIndicator reads prose, and
    // only for the indicator on screen, which is by definition loaded.
    const { index, parts } = splitPantry(pantryOf(['population', 'tax-rate', 'density']))
    const view = viewOf(index, [parts[0]!])
    expect(view.indicators.map((i) => i.id)).toEqual(['population', 'tax-rate', 'density'])
    expect(view.series.map((s) => s.indicator)).toEqual(['population'])
    expect(PantryView.parse(view)).toEqual(view)
  })

  it('accepts a fully assembled pantry, so every existing caller keeps working', () => {
    // PantryData is structurally a PantryView with extra prose on each indicator, so the tools,
    // the kitchen and the 34 test files that hold a whole pantry need no second code path.
    const pantry = pantryOf(['population'])
    const view: PantryView = pantry
    expect(view.indicators[0]?.id).toBe('population')
  })

  it('refuses a loaded series with no indicator in the index', () => {
    const { index } = splitPantry(pantryOf(['population']))
    const stray = PantryIndicator.parse({
      indicator: indicatorOf('stowaway'),
      series: seriesOf('stowaway'),
    })
    expect(() => viewOf(index, [stray])).toThrow(/stowaway/)
  })
})
