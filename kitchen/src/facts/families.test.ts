import { describe, expect, it } from 'vitest'
import { DEFAULT_PANTRY_DIR, readPantryParts } from '../publish'
import { PantryData } from '../../../shared/pantry'
import {
  contextFor,
  countryCandidates,
  extremeCandidates,
  reversalCandidates,
  runCandidates,
  unusualCandidates,
  PEER_DISTANCE_QUANTILE,
  type Candidate,
} from './families'

/** The published pantry, reassembled from the files the kitchen writes (Plan 13). */
const publishedPantry = readPantryParts(DEFAULT_PANTRY_DIR)

const data = publishedPantry
const ctx = contextFor(data)
const name = new Map(data.municipalities.map((m) => [m.code, m.name.sv]))

const top = (list: Candidate[]) => list[0]!

describe('countryCandidates', () => {
  const list = countryCandidates(ctx)

  it('puts the nearest-unanimous claim first', () => {
    const first = top(list)
    expect(first.family).toBe('country')
    if (first.family !== 'country') return
    expect(first.matching).toBe(first.comparable)
  })

  it('breaks a tie on the length of the record, not the spelling of an indicator', () => {
    // Median income since 1999 and post-secondary education since 1985 are both unanimous.
    // Sorting by id would pick median-income; the longer record is the stronger statement.
    const first = top(list)
    if (first.family !== 'country') throw new Error('not a country fact')
    expect(first.indicator.id).toBe('post-secondary-education')
    expect(first.from).toBe(1985)
  })

  it('never assumes 290 as the denominator', () => {
    const tax = list.find((c) => c.id === 'country-tax-rate-higher')
    if (tax?.family !== 'country') throw new Error('no tax candidate')
    // Knivsta was created in 2003 and has no rate for 2000, so it cannot be asked.
    expect(tax.matching).toBe(288)
    expect(tax.comparable).toBe(289)
  })

  it('finds the large-minority claim too, and ranks it far below', () => {
    const shrunk = list.find((c) => c.id === 'country-population-lower')
    if (shrunk?.family !== 'country') throw new Error('no population candidate')
    // 128 of 284 at 2025, population's own last year. The hand-written strip said 124 of 284,
    // which was and remains true of 2024 — the four are municipalities that crossed back
    // below their 1968 level in the last year. Six did not exist in 1968 and so are not in
    // the denominator.
    expect(shrunk.to).toBe(2025)
    expect(shrunk.matching).toBe(128)
    expect(shrunk.comparable).toBe(284)
    expect(list.indexOf(shrunk)).toBeGreaterThan(4)
  })

  it('will not count a municipality whose endpoint change is inside the noise bound', () => {
    // No municipality's 1968-to-2025 population change is within three people, so this
    // excludes nobody today. It is asserted so a refresh that makes it matter is a decision
    // somebody sees rather than a number that quietly shifts.
    const shrunk = list.find((c) => c.id === 'country-population-lower')
    const grown = list.find((c) => c.id === 'country-population-higher')
    if (shrunk?.family !== 'country' || grown?.family !== 'country') throw new Error('missing')
    expect(shrunk.matching + grown.matching).toBe(shrunk.comparable)
  })

  it('leaves out indicators with too short a record to make a claim about', () => {
    // A twenty-year minimum: "more than in 2015" is a news item, not a fact about Sweden.
    for (const c of list) {
      if (c.family !== 'country') continue
      expect(c.to - c.from, c.indicator.id).toBeGreaterThanOrEqual(20)
    }
  })
})

describe('runCandidates', () => {
  const list = runCandidates(ctx)

  it('offers exactly one candidate per direction', () => {
    expect(list).toHaveLength(2)
    expect(new Set(list.map((c) => c.id))).toEqual(new Set(['run-growth', 'run-decline']))
  })

  it('puts the longest run first, even though the shorter one is the better sentence', () => {
    const first = top(list)
    if (first.family !== 'run') throw new Error('not a run')
    expect(first.direction).toBe(1)
    expect(first.score).toBe(57)
    expect(first.run).toEqual({ years: 57, from: 1968, to: 2025 })
  })

  it('names every municipality that shares the winning run', () => {
    const first = top(list)
    if (first.family !== 'run') throw new Error('not a run')
    expect(first.codes.map((c) => name.get(c)).sort()).toEqual([
      'Alingsås',
      'Halmstad',
      'Härryda',
      'Kungälv',
      'Lund',
      'Sollentuna',
      'Strängnäs',
      'Umeå',
      'Vallentuna',
      'Varberg',
      'Växjö',
      'Ängelholm',
    ])
  })

  it('finds the 47-year decline shared by Kramfors and Strömsund', () => {
    const decline = list.find((c) => c.id === 'run-decline')
    if (decline?.family !== 'run') throw new Error('no decline')
    expect(decline.run).toEqual({ years: 47, from: 1968, to: 2015 })
    expect(decline.codes.map((c) => name.get(c))).toEqual(['Kramfors', 'Strömsund'])
  })

  it('only names municipalities sharing the same span, not merely the same length', () => {
    // "Every year since 1968" has to be true of all of them, or the sentence is false of some.
    for (const c of list) {
      if (c.family !== 'run') continue
      expect(c.codes.length).toBeGreaterThan(0)
    }
  })
})

describe('reversalCandidates', () => {
  const list = reversalCandidates(ctx)

  it('finds 29 municipalities that fell and came back', () => {
    expect(list).toHaveLength(29)
  })

  it('ranks by depth times recovery, putting Sundbyberg first', () => {
    const first = top(list)
    if (first.family !== 'reversal') throw new Error('not a reversal')
    expect(name.get(first.code)).toBe('Sundbyberg')
    expect(first.reversal.trough.year).toBe(1981)
  })

  it('includes Stockholm, which was 15% smaller in 1981 than in 1968', () => {
    const stockholm = list.find((c) => c.family === 'reversal' && c.code === '0180')
    if (stockholm?.family !== 'reversal') throw new Error('no Stockholm')
    expect(Math.round(stockholm.reversal.fall)).toBe(-15)
    expect(stockholm.reversal.peak.year).toBe(1968)
  })
})

describe('unusualCandidates', () => {
  const list = unusualCandidates(ctx)

  it('closes the circularity: the held-out indicator did not find the neighbours', () => {
    // The point of leave-one-out. Asking "is its population unusual among places with a
    // similar population" is near self-contradictory, and all ten indicators are used to
    // find the neighbours — so the neighbours here must have been found on the other nine.
    //
    // Tested by consequence rather than by inspecting the call: a municipality's neighbours
    // for a held-out indicator must differ from its published all-ten neighbours at least
    // sometimes. If the held-out column were still in the features they would always match.
    const published = unusualCandidates(ctx).filter((c) => c.family === 'unusual')
    const byCode = new Map<string, Set<string>>()
    let differing = 0
    for (const c of published) {
      if (c.family !== 'unusual') continue
      const key = c.code
      const seen = byCode.get(key)
      const signature = c.peerCodes.join(',')
      if (seen && !seen.has(signature)) differing += 1
      byCode.set(key, (seen ?? new Set()).add(signature))
    }
    expect(differing).toBeGreaterThan(0)
  })

  it('does not put Stockholm first, because Stockholm has no close neighbours', () => {
    // Without the peer-distance cutoff the top of this family is Stockholm's population at
    // 2.61 standard scores above its neighbours — which measures the failure of the match,
    // not a fact about Stockholm.
    const first = top(list)
    if (first.family !== 'unusual') throw new Error('not unusual')
    expect(first.code).not.toBe('0180')
  })

  it('finds that Kävlinge taxes far below the places most like it', () => {
    const first = top(list)
    if (first.family !== 'unusual') throw new Error('not unusual')
    expect(name.get(first.code)).toBe('Kävlinge')
    expect(first.indicator.id).toBe('tax-rate')
    expect(first.self).toBeLessThan(first.peers)
  })

  it('keeps only the half whose neighbours are genuinely near', () => {
    const everything = data.indicators.length * data.municipalities.length
    expect(list.length).toBeLessThan(everything * PEER_DISTANCE_QUANTILE + 10)
    expect(list.length).toBeGreaterThan(100)
  })

  it('carries five peers and a real value for each candidate', () => {
    for (const c of list.slice(0, 20)) {
      if (c.family !== 'unusual') continue
      expect(c.peerCodes, c.id).toHaveLength(5)
      expect(c.peerCodes, c.id).not.toContain(c.code)
      expect(Number.isFinite(c.self), c.id).toBe(true)
      expect(Number.isFinite(c.peers), c.id).toBe(true)
    }
  })
})

describe('extremeCandidates', () => {
  const list = extremeCandidates(ctx)

  it('ranks by ratio, so density beats the money indicators', () => {
    const first = top(list)
    if (first.family !== 'extreme') throw new Error('not extreme')
    expect(first.indicator.id).toBe('density')
    expect(name.get(first.highest.code)).toBe('Sundbyberg')
    expect(name.get(first.lowest.code)).toBe('Arjeplog')
    // 2025 rather than 2024, and 32,646 rather than 32,230: plan 16 gave every extreme its own
    // indicator's last year instead of a year shared with the whole pantry, so density's extreme
    // is now quoted for the latest year density HAS.
    expect(first.year).toBe(2025)
    expect(Math.round(first.score)).toBe(32646)
  })

  it('excludes indicators that go negative, where a ratio means nothing', () => {
    const ids = list.map((c) => (c.family === 'extreme' ? c.indicator.id : ''))
    expect(ids).not.toContain('net-migration-rate')
    expect(ids).not.toContain('population-change')
  })

  it('names the real denominator, which is not 290 for house prices', () => {
    // Not every municipality has enough house sales in a year to publish a mean price, so the
    // claim has to say how many it could actually ask — 285 of 290 in both 2024 and 2025. The
    // municipality at the bottom moved with the year: Åsele in 2024, Malå in 2025.
    const prices = list.find((c) => c.family === 'extreme' && c.indicator.id === 'house-prices')
    if (prices?.family !== 'extreme') throw new Error('no house prices')
    expect(prices.year).toBe(2025)
    expect(prices.comparable).toBe(285)
    expect(prices.comparable).toBeLessThan(290)
    expect(name.get(prices.lowest.code)).toBe('Malå')
  })

  it('asks every indicator for a year it actually covers', () => {
    for (const c of list) {
      if (c.family !== 'extreme') continue
      expect(c.year, c.indicator.id).toBeLessThanOrEqual(c.indicator.coverage.to)
      expect(c.year, c.indicator.id).toBeGreaterThanOrEqual(c.indicator.coverage.from)
    }
  })
})

describe('every family', () => {
  it('is deterministic — the same pantry produces the same ranking', () => {
    for (const build of [
      countryCandidates,
      runCandidates,
      reversalCandidates,
      extremeCandidates,
      unusualCandidates,
    ]) {
      expect(build(ctx).map((c) => c.id)).toEqual(build(ctx).map((c) => c.id))
    }
  })

  it('gives every candidate a unique id within its family', () => {
    for (const build of [countryCandidates, runCandidates, reversalCandidates, extremeCandidates]) {
      const ids = build(ctx).map((c) => c.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })
})

/**
 * Three rules below cannot be exercised by the committed pantry at all: every indicator has a
 * record longer than twenty years, no municipality's population change is inside the noise
 * bound, and every municipality sharing the longest run also shares its span. Tested against
 * real data they pass whether the rule is there or not — which mutation testing showed
 * directly, by deleting each rule and watching all 25 tests stay green.
 *
 * So they get a pantry built to break them.
 */
function syntheticPantry(options: {
  years: number[]
  values: Record<string, Array<number | null>>
  statuses?: Record<string, Array<'present' | 'perturbed'>>
  unit?: 'count' | 'percent'
}): PantryData {
  const codes = Object.keys(options.values)
  return PantryData.parse({
    schemaVersion: 1,
    municipalities: codes.map((code, i) => ({
      code,
      name: { sv: `M${i}`, en: `M${i}` },
      county: '01',
    })),
    indicators: [
      {
        id: 'population',
        name: { sv: 'Folkmängd', en: 'Population' },
        description: { sv: '', en: '' },
        unit: options.unit ?? 'count',
        priceBasis: 'none',
        scale: { kind: 'sequential', breaks: [1, 2] },
        coverage: { from: options.years[0], to: options.years[options.years.length - 1] },
        caveat: { sv: '', en: '' },
        sensitivity: 'none',
        sources: [],
        derivation: '',
      },
    ],
    series: [
      {
        indicator: 'population',
        years: options.years,
        values: codes.map((c) => options.values[c]),
        status: codes.map((c) =>
          (options.statuses?.[c] ?? options.years.map(() => 'present')).map((s, i) =>
            options.values[c]![i] === null ? 1 : s === 'perturbed' ? 3 : 0,
          ),
        ),
      },
    ],
    priceIndex: { base: 2025, values: { '2025': 100 } },
  })
}

describe('the rules the committed pantry cannot exercise', () => {
  it('refuses a country claim over a record shorter than twenty years', () => {
    const years = Array.from({ length: 10 }, (_, i) => 2015 + i)
    const tiny = syntheticPantry({
      years,
      values: { '0001': years.map((_, i) => 100 + i), '0002': years.map((_, i) => 200 + i) },
    })
    expect(countryCandidates(contextFor(tiny))).toEqual([])
  })

  it('accepts one over a record of exactly twenty years', () => {
    const years = Array.from({ length: 21 }, (_, i) => 2000 + i)
    const enough = syntheticPantry({
      years,
      values: { '0001': years.map((_, i) => 100 + i), '0002': years.map((_, i) => 200 + i) },
    })
    expect(countryCandidates(contextFor(enough)).length).toBeGreaterThan(0)
  })

  it('will not count a municipality whose endpoint move is inside the noise bound', () => {
    const years = Array.from({ length: 25 }, (_, i) => 2000 + i)
    const last = years.length - 1
    const noisy = syntheticPantry({
      years,
      // 0001 rises by one person into a perturbed final year: unknowable.
      // 0002 rises by a hundred into the same year: real.
      values: {
        '0001': years.map((_, i) => (i === last ? 101 : 100)),
        '0002': years.map((_, i) => (i === last ? 200 : 100)),
      },
      statuses: {
        '0001': years.map((_, i) => (i === last ? 'perturbed' : 'present')),
        '0002': years.map((_, i) => (i === last ? 'perturbed' : 'present')),
      },
    })
    const higher = countryCandidates(contextFor(noisy)).find((c) => c.id.endsWith('-higher'))
    if (higher?.family !== 'country') throw new Error('no candidate')
    expect(higher.comparable).toBe(1)
    expect(higher.matching).toBe(1)
  })

  it('applies that bound in the indicator’s own unit, not three of whatever it measures', () => {
    const years = Array.from({ length: 25 }, (_, i) => 2000 + i)
    const last = years.length - 1
    // The same shape, but the indicator is a percentage. A one-point rise into a perturbed
    // year is real there: the count bound of three would wrongly discard it.
    const percent = syntheticPantry({
      years,
      unit: 'percent',
      values: {
        '0001': years.map((_, i) => (i === last ? 11 : 10)),
        '0002': years.map((_, i) => (i === last ? 20 : 10)),
      },
      statuses: {
        '0001': years.map((_, i) => (i === last ? 'perturbed' : 'present')),
        '0002': years.map((_, i) => (i === last ? 'perturbed' : 'present')),
      },
    })
    const higher = countryCandidates(contextFor(percent)).find((c) => c.id.endsWith('-higher'))
    if (higher?.family !== 'country') throw new Error('no candidate')
    expect(higher.comparable).toBe(2)
    expect(higher.matching).toBe(2)
  })

  it('names only the municipalities whose longest run covers the same years', () => {
    const years = Array.from({ length: 8 }, (_, i) => 2000 + i)
    // Both rise for exactly four steps, but 0001 does it over 2000-2004 and 0002 over
    // 2003-2007. Equal length is the point: a filter on length alone would name both, and
    // "every year since 2000" would then be false of one of them in the same sentence.
    const staggered = syntheticPantry({
      years,
      values: {
        '0001': [1, 2, 3, 4, 5, 5, 5, 5],
        '0002': [9, 9, 9, 9, 10, 11, 12, 13],
      },
    })
    const growth = runCandidates(contextFor(staggered)).find((c) => c.id === 'run-growth')
    if (growth?.family !== 'run') throw new Error('no growth run')
    expect(growth.score).toBe(4)
    expect(growth.run).toEqual({ years: 4, from: 2000, to: 2004 })
    expect(growth.codes).toEqual(['0001'])
  })
})
