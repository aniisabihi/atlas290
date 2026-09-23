import { describe, expect, it } from 'vitest'
import { lookup, observationAt, rankOf } from '../data/select'
import { EXTREME_SHARE, MIN_FALL_PERCENT, storyFor, type Sentence } from './story'
import { partialPantry, publishedPantry } from '../test/pantry'

const data = publishedPantry
const lk = lookup(data)
const YEAR = 2024

const story = (code: string, year = YEAR) => storyFor(lk, code, year, 'sv')
const sentence = (code: string, id: Sentence['id'], year = YEAR) =>
  story(code, year).find((s) => s.id === id)

/** The whole published population history of one municipality, absences removed. */
function population(code: string, upTo = YEAR): Array<{ year: number; value: number }> {
  const series = lk.series('population')
  const row = lk.data.municipalities.findIndex((m) => m.code === code)
  return series.years
    .map((year, col) => ({ year, value: series.values[row]?.[col] ?? null }))
    .filter((p): p is { year: number; value: number } => p.value !== null && p.year <= upTo)
}

/**
 * The point of this file. Every sentence states a claim the pantry can be asked to confirm,
 * and each one is re-derived here from the published data by a route independent of the rule
 * that produced it — so a monthly refresh that falsifies a sentence fails the build instead of
 * publishing a confident lie.
 */
describe('every sentence re-derives from the pantry', () => {
  const codes = [
    '0180', // Stockholm
    '2463', // Åsele, the largest decline
    '0305', // Håbo, the largest growth
    '0330', // Knivsta, which did not exist in 1968
    '2506', // Arjeplog, lowest density
    '1281', // Lund
    '0980', // Gotland
    '2403', // Bjurholm, suppressed house prices
    '2425', // Dorotea, no house price anywhere in the window
    '1272', // Bromölla, an interior peak with a real fall
  ]

  it.each(codes)('%s: the arc matches the first and last published figures', (code) => {
    const points = population(code)
    const arc = sentence(code, 'arc')
    const first = points[0]!
    const last = points[points.length - 1]!
    expect(arc?.claim).toBe(`${first.year} ${first.value} -> ${last.year} ${last.value}`)
  })

  it.each(codes)('%s: the turn matches the maximum, or declines for a reason', (code) => {
    const points = population(code)
    const turn = sentence(code, 'turn')
    let peak = points[0]!
    for (const p of points) if (p.value > peak.value) peak = p
    const first = points[0]!
    const last = points[points.length - 1]!
    const fall = Math.abs(Math.round(((last.value - peak.value) / peak.value) * 100))
    const interior = peak.year !== first.year && peak.year !== last.year

    if (interior && fall >= MIN_FALL_PERCENT) {
      expect(turn?.claim).toBe(`peak ${peak.year} ${peak.value}`)
    } else {
      expect(turn).toBeUndefined()
    }
  })

  it.each(codes)('%s: the standing matches a real rank, or declines', (code) => {
    const standing = sentence(code, 'standing')
    if (!standing) {
      // Declining is a claim too: it says nothing is inside the extreme tenth.
      for (const indicator of data.indicators) {
        const rank = rankOf(lk, indicator.id, YEAR, code)
        if (!rank) continue
        const share = Math.min(rank.rank, rank.outOf - rank.rank + 1) / rank.outOf
        expect(share, indicator.id).toBeGreaterThan(EXTREME_SHARE)
      }
      return
    }
    const [id, rank, , outOf] = standing.claim.split(' ')
    const real = rankOf(lk, id!, YEAR, code)
    expect(real).toEqual({ rank: Number(rank), outOf: Number(outOf) })
  })
})

describe('the arc', () => {
  it('counts from a municipality’s own first year, not from 1968', () => {
    // Knivsta was created in 2003 and has no figure for 1968. "Since 1968" would be false.
    expect(sentence('0330', 'arc')?.text.sv).toMatch(/sedan 200\d/)
    expect(sentence('0330', 'arc')?.text.sv).not.toMatch(/1968/)
    expect(observationAt(lk, 'population', '0330', 1968).value).toBeNull()
  })

  it('says shrunk, not grown, for a municipality that has lost people', () => {
    expect(sentence('2463', 'arc')?.text.sv).toMatch(/krympt 53\u00a0%/)
    expect(sentence('2463', 'arc')?.text.en).toMatch(/shrunk 53%/)
  })

  it('says grown for one that has gained', () => {
    expect(sentence('0305', 'arc')?.text.sv).toMatch(/vuxit 406\u00a0%/)
    expect(sentence('0305', 'arc')?.text.en).toMatch(/grown 406%/)
  })

  it('respects the selected year rather than always using the last one', () => {
    // Dragging the slider back has to move the endpoint of the sentence with it.
    const at1990 = sentence('0180', 'arc', 1990)
    expect(at1990?.claim).toMatch(/-> 1990 /)
    expect(at1990?.text.sv).not.toMatch(/2024|2025/)
  })
})

describe('the turn', () => {
  it('declines when the population is still at its peak', () => {
    // Stockholm has grown almost every year; its maximum is the last year, which rule 1
    // already says.
    const points = population('0180')
    let peak = points[0]!
    for (const p of points) if (p.value > peak.value) peak = p
    expect(peak.year).toBe(points[points.length - 1]!.year)
    expect(sentence('0180', 'turn')).toBeUndefined()
  })

  it('declines when the fall since the peak rounds to nothing', () => {
    // Håbo peaked at 22,974 in 2023 against 22,973 in 2024 — one person. The first version of
    // this rule published "0 % fler än i dag", which is not a fact.
    const points = population('0305')
    let peak = points[0]!
    for (const p of points) if (p.value > peak.value) peak = p
    expect(peak.year).not.toBe(points[points.length - 1]!.year)
    expect(peak.value - points[points.length - 1]!.value).toBeLessThan(peak.value * 0.01)
    expect(sentence('0305', 'turn')).toBeUndefined()
  })

  it('fires with a real figure when the fall is real', () => {
    expect(sentence('1272', 'turn')?.text.sv).toMatch(/Folkmängden var som störst 2018/)
    expect(sentence('1272', 'turn')?.text.sv).toMatch(/3\u00a0% fler än i dag/)
  })

  it('never says a fall of zero per cent', () => {
    for (const m of data.municipalities) {
      const turn = sentence(m.code, 'turn')
      if (!turn) continue
      expect(turn.text.sv, m.name.sv).not.toMatch(/\b0\s% fler/)
      expect(turn.text.en, m.name.en).not.toMatch(/\b0% more/)
    }
  })
})

describe('the standing', () => {
  it('names the measure first and uses the uninflected form, so Swedish agreement cannot go wrong', () => {
    // "landets 2:e högsta eftergymnasial utbildning" is what the obvious phrasing produced,
    // and it should be "eftergymnasiala". Naming the measure first avoids the agreement.
    //
    // This pinned Lund's whole sentence until plan 16, which is a snapshot of WHICH fact won
    // rather than of the phrasing the test is about. Lund's strongest standing is now its
    // employment rate — the lowest in the country, because a university town's 20-64 year olds
    // are disproportionately students — and that is the facts engine working, not breaking.
    //
    // So the assertion is now the shape: the measure's own name, then an em dash, then the
    // standing. No measure name is ever inflected into the sentence.
    const lund = sentence('1281', 'standing')?.text.sv
    expect(lund).toMatch(/^[A-ZÅÄÖ][^—]+ — (näst |)(högst|lägst) i landet, av 290 kommuner/)
    expect(lund).not.toMatch(/landets \d/)
  })

  it('says näst rather than 2:a for second place in Swedish', () => {
    expect(sentence('1480', 'standing')?.text.sv).toMatch(/näst högst/)
    expect(sentence('1480', 'standing')?.text.sv).not.toMatch(/2:a/)
  })

  it('names the real denominator, which is not always 290', () => {
    // House prices are suppressed for too few sales in five municipalities, so ANY standing
    // claim about them is of 285 rather than 290.
    //
    // This pinned Åsele until plan 17, whose distance-to-protected-nature gave Åsele a stronger
    // standing and quietly turned the test into a check that Åsele's top fact had not changed —
    // which is not what it is for. It now finds whichever municipality the house-price standing
    // belongs to, so it keeps testing the rule as the pantry grows.
    const housePrices = data.municipalities
      .map((m) => sentence(m.code, 'standing')?.text.sv)
      .filter((t): t is string => t !== undefined && /Småhuspriser/.test(t))
    expect(housePrices.length).toBeGreaterThan(0)
    for (const claim of housePrices) expect(claim).toMatch(/av 285 kommuner/)
    expect(sentence('0180', 'standing')?.text.sv).toMatch(/av 290 kommuner/)
  })

  it('says lowest without implying it is bad, and highest without implying it is good', () => {
    const sv = data.municipalities
      .map((m) => sentence(m.code, 'standing')?.text.sv)
      .filter((s): s is string => s !== undefined)
    expect(sv.length).toBeGreaterThan(0)
    for (const s of sv) expect(s).not.toMatch(/bäst|sämst|vinner|bättre|sämre/i)
  })
})

describe('coverage across the whole country', () => {
  /**
   * Asserted so that a refresh which quietly changes the SHAPE of the prose — a rule that
   * starts firing for everyone, or stops firing at all — fails here rather than being noticed
   * by someone reading the site. Bands rather than exact numbers: the figures move a little
   * with the data, and what matters is that two of the three rules still decline often.
   */
  const counts = { arc: 0, turn: 0, standing: 0 }
  for (const m of data.municipalities) for (const s of story(m.code)) counts[s.id] += 1

  it('tells every municipality its arc', () => {
    expect(counts.arc).toBe(290)
  })

  it('tells about half of them their turning point', () => {
    expect(counts.turn).toBe(127)
    expect(counts.turn).toBeGreaterThan(80)
    expect(counts.turn).toBeLessThan(200)
  })

  it('tells most of them where they stand', () => {
    // 185 before plan 16, 249 after it and 267 after plan 17: the rise is the point rather than a
    // regression, because a standing needs a municipality near the top or bottom of SOME measure,
    // and there are more measures now. Design D4 predicted exactly this — "the facts may simply
    // become different overnight, which is correct behaviour and will still be surprising".
    //
    // The bounds are what the test really defends: every municipality having a standing would
    // mean the threshold is meaningless, and very few would mean the sentence never fires.
    expect(counts.standing).toBe(267)
    expect(counts.standing).toBeGreaterThan(120)
    expect(counts.standing).toBeLessThan(280)
  })

  it('always says something, and never more than three things', () => {
    for (const m of data.municipalities) {
      const s = story(m.code)
      expect(s.length, m.name.sv).toBeGreaterThan(0)
      expect(s.length, m.name.sv).toBeLessThanOrEqual(3)
    }
  })

  it('writes every sentence in both languages, and never the same string in both', () => {
    for (const m of data.municipalities) {
      for (const s of story(m.code)) {
        expect(s.text.sv.length, `${m.name.sv} ${s.id}`).toBeGreaterThan(0)
        expect(s.text.en.length, `${m.name.en} ${s.id}`).toBeGreaterThan(0)
        // The arc and the turn always differ; the standing can coincide when the indicator
        // name happens to be identical in both languages, so it is excluded rather than
        // asserted falsely.
        if (s.id !== 'standing') expect(s.text.sv).not.toBe(s.text.en)
      }
    }
  })
})

describe('while the pantry is still loading', () => {
  /**
   * Plan 13, and the defect the browser suite caught that every unit test had missed: the arc and
   * the turn are built from population whatever indicator is on the map, so a profile deep-linked
   * with a different indicator — `/en/?i=house-prices&m=0184` — reached them before population had
   * been fetched. `lk.series` threw, React unwound the whole tree, and the page went blank.
   *
   * The unit suite could not have caught it, because every site fixture holds a complete pantry.
   * These three use a partial one, which is the state the site is genuinely in on every visit.
   */
  it('says nothing rather than throwing when population has not arrived', () => {
    const partial = lookup(partialPantry(['house-prices']))
    expect(() => storyFor(partial, '0184', YEAR, 'sv')).not.toThrow()
  })

  it('offers no arc and no turn until population is in hand', () => {
    const partial = lookup(partialPantry(['house-prices']))
    const ids = storyFor(partial, '0184', YEAR, 'sv').map((entry) => entry.id)
    expect(ids).not.toContain('arc')
    expect(ids).not.toContain('turn')
  })

  it('tells the whole story once population has arrived', () => {
    const withPopulation = lookup(partialPantry(['population', 'house-prices']))
    const ids = storyFor(withPopulation, '0184', YEAR, 'sv').map((entry) => entry.id)
    expect(ids).toContain('arc')
  })

  it('never reads a series it does not hold, for any municipality', () => {
    // The standing rule walks every indicator, so it is the other way this could have thrown.
    const partial = lookup(partialPantry(['mean-age']))
    for (const m of publishedPantry.municipalities.slice(0, 40)) {
      expect(() => storyFor(partial, m.code, YEAR, 'en')).not.toThrow()
    }
  })
})
