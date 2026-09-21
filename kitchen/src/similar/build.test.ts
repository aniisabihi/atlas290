import { describe, expect, it } from 'vitest'
import { DEFAULT_PANTRY_DIR, readPantryParts } from '../publish'
import rawSimilar from '../../../public/pantry/data/similar.json'
import { PantryData, Similar, type Indicator } from '../../../shared/pantry'
import {
  assertUsable,
  buildSimilar,
  CORE_INDICATORS,
  coreOf,
  featuresFor,
  MAX_MISSING,
  NEIGHBOURS,
  windowFor,
  WINDOW_YEARS,
} from './build'

/** The published pantry, reassembled from the files the kitchen writes (Plan 13). */
const publishedPantry = readPantryParts(DEFAULT_PANTRY_DIR)

const data = publishedPantry
const name = new Map(data.municipalities.map((m) => [m.code, m.name.sv]))
const built = buildSimilar(data)

describe('windowFor', () => {
  it('ends at the last year every indicator covers, not the last year any of them covers', () => {
    // tax-rate reaches 2026 and median-income stops at 2024. Ending on 2026 would average
    // median income over eight years while calling it ten.
    expect(windowFor(data)).toEqual({ from: 2015, to: 2024 })
    expect(Math.max(...data.indicators.map((i) => i.coverage.to))).toBe(2026)
  })

  it('spans exactly the declared number of years', () => {
    const w = windowFor(data)
    expect(w.to - w.from + 1).toBe(WINDOW_YEARS)
  })
})

describe('buildSimilar against the committed pantry', () => {
  it('gives every one of the 290 municipalities five neighbours', () => {
    expect(Object.keys(built.nearest)).toHaveLength(290)
    for (const [code, list] of Object.entries(built.nearest)) {
      expect(list, code).toHaveLength(NEIGHBOURS)
    }
  })

  it('passes its own published schema', () => {
    expect(() => Similar.parse(built)).not.toThrow()
  })

  it('records the method it actually used', () => {
    // The CORE set in published order — not every indicator the pantry carries. Since plan 16
    // those differ, and a method description naming an indicator the metric never reads is a
    // published claim that is simply untrue.
    expect(built.method.indicators).toEqual(
      data.indicators.map((i) => i.id).filter((id) => CORE_INDICATORS.includes(id)),
    )
    expect(built.method.logged).toEqual(['population', 'density', 'median-income', 'house-prices'])
    expect(built.method.window).toEqual({ from: 2015, to: 2024 })
    expect(built.method.neighbours).toBe(NEIGHBOURS)
  })

  /**
   * Not a test of the arithmetic — distance.test.ts does that — but of whether the metric
   * finds kinds of place a Swede would recognise. It was never told that university towns or
   * far-north municipalities exist.
   *
   * Written as "contains", not "equals", deliberately: the fifth and sixth nearest differ by a
   * measured median of 0.032, so pinning the exact five would make this test fail on a data
   * refresh for a reason that says nothing about whether the metric still works.
   */
  it.each([
    ['1281', 'Lund', ['0380', '0580']], // Uppsala, Linköping — university towns
    ['2506', 'Arjeplog', ['2510', '2422']], // Jokkmokk, Sorsele — the sparse north
    ['0162', 'Danderyd', ['0186']], // Lidingö — wealthy Stockholm suburbs
    ['1280', 'Malmö', ['1480']], // Göteborg — the other big cities
  ])('%s (%s) finds places of its own kind', (code, _label, expected) => {
    const found = built.nearest[code]!
    for (const e of expected) {
      expect(found, `${name.get(code)} -> ${found.map((c) => name.get(c)).join(', ')}`).toContain(e)
    }
  })

  /**
   * The test that actually holds the log transform in place.
   *
   * The "finds places of its own kind" cases above do NOT: turning the transform off entirely
   * leaves every one of them green, because the ten-year window is doing much of the work on
   * its own. What the log changes is density, whose raw distribution runs from 0.2 to 6,446 —
   * next to Stockholm, the difference between 0.2 and 10 per square kilometre rounds to
   * nothing, so an unlogged metric cannot tell the empty north apart from a small southern
   * town.
   *
   * Arjeplog is the emptiest municipality in Sweden at 0.2 per square kilometre. Logged, its
   * five are 0.3, 0.3, 0.8, 0.8 and 1.1. Unlogged, it is given Storfors at 9.6 — forty-eight
   * times denser — and Sollefteå at 3.4. The threshold below sits between the two with a
   * factor of two of margin on each side.
   */
  it('does not match the emptiest municipality in Sweden with a town fifty times denser', () => {
    const density = data.series.find((s) => s.indicator === 'density')!
    const col = density.years.indexOf(2024)
    const valueOf = (code: string) =>
      density.values[data.municipalities.findIndex((m) => m.code === code)]![col]!
    expect(valueOf('2506')).toBe(0.2)
    for (const code of built.nearest['2506']!) {
      expect(valueOf(code), `${name.get(code)}`).toBeLessThan(2)
    }
  })

  it('never lists a municipality as its own neighbour', () => {
    for (const [code, list] of Object.entries(built.nearest)) expect(list).not.toContain(code)
  })

  it('is deterministic — the same pantry builds the same file', () => {
    expect(buildSimilar(data)).toEqual(built)
  })

  /**
   * The committed file and this code must not drift apart. `yarn kitchen publish` is what
   * writes it, and CI already refuses a rebuild that changes any pantry byte — but that check
   * only fires if someone runs publish. This one fires on every test run, so a change to the
   * metric that nobody republishes fails here rather than shipping a file computed by an
   * older version of this module.
   */
  it('matches the file committed under public/pantry', () => {
    expect(Similar.parse(rawSimilar)).toEqual(built)
  })

  it('loses the house-price dimension for Dorotea alone, and keeps it for the other four', () => {
    // Five municipalities are `too-few-cases` for house prices in 2024 — Bjurholm, Malå,
    // Sorsele, Dorotea, Arjeplog — which is what a single-year snapshot shows. Averaged over
    // the window, only Dorotea has no price in ANY of 2015-2024; the other four have between
    // three and six years. So the window is not only what makes the metric stable, it also
    // repairs four fifths of the hole.
    //
    // What must never happen is a zero being substituted: that would put all five at the
    // bottom of the price distribution together and make them each other's neighbours for a
    // reason that is not a fact about them.
    const features = featuresFor(data, windowFor(data))
    const priceColumn = data.indicators.findIndex((i) => i.id === 'house-prices')
    const withoutPrice = data.municipalities
      .map((m, i) => [m.code, features[i]![priceColumn]] as const)
      .filter(([, v]) => v === null)
      .map(([code]) => code)
    expect(withoutPrice).toEqual(['2425'])
    expect(name.get('2425')).toBe('Dorotea')
  })
})

/** A deliberately small pantry, so each guard can be violated on its own. */
/** The fabricated pantry's own core set: it names its four indicators, not the published ten. */
const TINY_CORE = ['a', 'b', 'c', 'd']

function tinyPantry(overrides: { coverageTo?: number; coverageFrom?: number } = {}): PantryData {
  const indicator = (id: string): Indicator => ({
    id,
    name: { sv: id, en: id },
    description: { sv: '', en: '' },
    unit: 'count',
    priceBasis: 'none',
    scale: { kind: 'sequential', breaks: [1, 2] },
    coverage: { from: overrides.coverageFrom ?? 2000, to: overrides.coverageTo ?? 2024 },
    caveat: { sv: '', en: '' },
    sensitivity: 'none',
    sources: [],
    derivation: '',
  })
  const years = Array.from({ length: 25 }, (_, i) => 2000 + i)
  const codes = ['0001', '0002', '0003', '0004', '0005', '0006']
  return PantryData.parse({
    schemaVersion: 1,
    municipalities: codes.map((code, i) => ({
      code,
      name: { sv: `M${i}`, en: `M${i}` },
      county: '01',
    })),
    // Four, not two: MAX_MISSING is two, so a fixture with two indicators cannot express
    // "more than two are missing" at all.
    indicators: ['a', 'b', 'c', 'd'].map(indicator),
    series: ['a', 'b', 'c', 'd'].map((id) => ({
      indicator: id,
      years,
      // Distinct per municipality so no year is degenerate.
      values: codes.map((_, m) => years.map((y) => m + 1 + (y - 2000) * 0.1)),
      status: codes.map(() => years.map(() => 0)),
    })),
    priceIndex: { base: 2025, values: { '2025': 100 } },
  })
}

describe('the guards', () => {
  it('builds the tiny pantry cleanly, so the failures below are the guards and nothing else', () => {
    expect(() => buildSimilar(tinyPantry(), TINY_CORE)).not.toThrow()
  })

  it('refuses a window shorter than the declared span', () => {
    const tiny = tinyPantry()
    const features = featuresFor(tiny, { from: 2020, to: 2024 }, TINY_CORE)
    expect(() => assertUsable(tiny, features, {}, { from: 2020, to: 2024 }, TINY_CORE)).toThrow(
      /window 2020-2024 is 5 years, and 10 are needed/,
    )
  })

  it('refuses a window that starts before an indicator does', () => {
    const tiny = tinyPantry({ coverageFrom: 2010 })
    const features = featuresFor(tiny, { from: 2000, to: 2024 }, TINY_CORE)
    expect(() => assertUsable(tiny, features, {}, { from: 2000, to: 2024 }, TINY_CORE)).toThrow(
      /starts in 2000, before a, b, c, d begin/,
    )
  })

  it('refuses a municipality with the wrong number of neighbours', () => {
    const tiny = tinyPantry()
    const window = windowFor(tiny, TINY_CORE)
    const features = featuresFor(tiny, window, TINY_CORE)
    const short = Object.fromEntries(
      tiny.municipalities.map((m) => [m.code, ['0002', '0003', '0004', '0005']]),
    )
    expect(() => assertUsable(tiny, features, short, window, TINY_CORE)).toThrow(
      /0001 \(M0\) has 4 neighbours, not 5/,
    )
  })

  it('refuses a neighbour compared on too few indicators', () => {
    // Every municipality keeps indicator 'a'; only the first keeps b, c and d. So any pair
    // involving another shares one dimension of four — three missing, one more than
    // MAX_MISSING allows.
    const tiny = tinyPantry()
    const window = windowFor(tiny, TINY_CORE)
    const features = featuresFor(tiny, window, TINY_CORE).map((f, i) =>
      i === 0 ? f : [f[0]!, null, null, null],
    )
    const result = Object.fromEntries(
      tiny.municipalities.map((m) => [
        m.code,
        tiny.municipalities
          .filter((o) => o.code !== m.code)
          .slice(0, 5)
          .map((o) => o.code),
      ]),
    )
    expect(() => assertUsable(tiny, features, result, window, TINY_CORE)).toThrow(
      new RegExp(`compared on only 1 of 4 indicators, and at most ${MAX_MISSING} may be missing`),
    )
  })
})

describe('the core set (Plan 14)', () => {
  /**
   * Decision 0002 measured this metric on exactly ten indicators. Until now the set was
   * "whatever the pantry contains", which was the same ten by accident. Plan 15 adds fifteen
   * more, and each one would have silently moved every neighbour on the site — including the
   * ones people have already shared links to.
   */
  it('names exactly the ten the published metric was measured on', () => {
    // Written out rather than compared against whatever the pantry holds. Until plan 16 the two
    // were the same list, and asserting one against the other could not have caught a core set
    // that silently grew — which is the entire failure this pinning exists to prevent. The ten
    // are decision 0002's, and they are a fact about the METRIC, not about the pantry.
    expect([...CORE_INDICATORS].sort()).toEqual(
      [
        'density',
        'house-prices',
        'mean-age',
        'median-income',
        'net-migration-rate',
        'population',
        'population-change',
        'post-secondary-education',
        'share-65-plus',
        'tax-rate',
      ].sort(),
    )
    for (const id of CORE_INDICATORS) {
      expect(data.indicators.map((i) => i.id)).toContain(id)
    }
  })

  it('keeps every neighbour unchanged when an eleventh indicator joins the pantry', () => {
    const extra: Indicator = {
      ...data.indicators[0]!,
      id: 'an-eleventh-indicator',
      coverage: { from: 2015, to: 2024 },
    }
    const withExtra = PantryData.parse({
      ...data,
      indicators: [...data.indicators, extra],
      series: [...data.series, { ...data.series[0]!, indicator: extra.id }],
    })
    expect(buildSimilar(withExtra)).toEqual(built)
  })

  it('refuses a pantry missing one of the ten, rather than measuring over nine', () => {
    const short = PantryData.parse({
      ...data,
      indicators: data.indicators.filter((i) => i.id !== 'density'),
      series: data.series.filter((s) => s.indicator !== 'density'),
      // The layout goes with its indicator, or the contract's own cross-reference check
      // refuses the pantry before the similarity builder gets to.
      layouts: data.layouts?.filter((l) => l.indicator !== 'density'),
    })
    expect(() => buildSimilar(short)).toThrow(/density/)
  })

  it('returns the core in the pantry’s own published order, not the order it is listed in', () => {
    const published = data.indicators.map((i) => i.id)
    expect(coreOf(data).map((i) => i.id)).toEqual(
      published.filter((id) => CORE_INDICATORS.includes(id)),
    )
  })

  it('is not disturbed by an indicator whose coverage starts after the window does', () => {
    // Plan 16 adds employment-rate and unemployment-rate, whose register begins in 2020 — well
    // inside a window that starts in 2015. The usability guard read EVERY published indicator's
    // coverage rather than the core set it actually measures, so a short new series made the
    // whole pantry unpublishable. The metric never looked at it.
    const late: Indicator = {
      ...data.indicators[0]!,
      id: 'a-short-new-series',
      coverage: { from: 2020, to: 2024 },
    }
    const withLate = PantryData.parse({
      ...data,
      indicators: [...data.indicators, late],
      series: [...data.series, { ...data.series[0]!, indicator: late.id }],
    })
    expect(buildSimilar(withLate)).toEqual(built)
  })
})
