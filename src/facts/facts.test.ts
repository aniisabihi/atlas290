import { describe, expect, it } from 'vitest'
import { lookup } from '../data/select'
import { metaFrom, parseHref, LANGS } from '../state/url'
import rawFacts from '../../public/pantry/data/facts.json'
import { Facts } from '../../shared/pantry'
import { factsFrom } from './facts'
import { publishedPantry } from '../test/pantry'

const data = publishedPantry
const lk = lookup(data)
const meta = metaFrom(data)
const FACTS = factsFrom(Facts.parse(rawFacts))

/**
 * The point of the whole module, and more important now than when the sentences were written
 * by hand.
 *
 * A hand-written fact has an author who would notice it going stale. A generated one has
 * nobody. So every published claim is recomputed here from `indicators.json` alone, by a route
 * that does not call the kitchen — not `longestRun`, not `reversal`, not `shareOf`, just the
 * arithmetic written out again. A generator and a checker that share an implementation check
 * nothing.
 */
describe('every published claim re-derives from the pantry', () => {
  const series = (id: string) => data.series.find((s) => s.indicator === id)!
  const rowOf = (code: string) => data.municipalities.findIndex((m) => m.code === code)
  const at = (id: string, code: string, year: number) => {
    const s = series(id)
    const col = s.years.indexOf(year)
    return col === -1 ? null : (s.values[rowOf(code)]?.[col] ?? null)
  }
  const claimOf = (id: string) => FACTS.find((f) => f.id === id)!.claim

  it('country: the education gap has widened everywhere since 1985', () => {
    // Plan 16: the published country fact is now the GAP rather than the level. Both are
    // unanimous over the same 284 municipalities and the same 1985-2025 record, so the ranking
    // ties down to the last tier. The re-derivation below is the same either way — what it
    // proves is that the claim on the page can be rebuilt from the pantry.
    let matching = 0
    let comparable = 0
    for (const m of data.municipalities) {
      const then = at('post-secondary-education-gap', m.code, 1985)
      const now = at('post-secondary-education-gap', m.code, 2025)
      if (then === null || now === null) continue
      comparable += 1
      if (now > then) matching += 1
    }
    expect(claimOf('country-post-secondary-education-gap-higher')).toBe(
      `${matching} of ${comparable} higher in 2025 than 1985`,
    )
  })

  it('run: twelve municipalities have risen every year for 57 years', () => {
    // Walked by hand rather than through the kitchen's longestRun.
    const s = series('population')
    const rising: string[] = []
    for (const m of data.municipalities) {
      const row = s.values[rowOf(m.code)]!
      let unbroken = true
      for (let i = 1; i < row.length; i++) {
        const before = row[i - 1]
        const after = row[i]
        if (before == null || after == null || after <= before) {
          unbroken = false
          break
        }
      }
      if (unbroken) rising.push(m.code)
    }
    const years = s.years.length - 1
    expect(claimOf('run-growth')).toBe(
      `growth ${years} years ${s.years[0]}-${s.years[s.years.length - 1]}, ${rising.length} municipalities`,
    )
  })

  it('reversal: Sundbyberg fell to 1981 and more than doubled since', () => {
    const s = series('population')
    const row = s.values[rowOf('0183')]!
    const points = s.years
      .map((year, i) => ({ year, value: row[i] }))
      .filter((p): p is { year: number; value: number } => p.value !== null)
    let trough = points[0]!
    for (const p of points) if (p.value < trough.value) trough = p
    let peak = points[0]!
    for (const p of points) if (p.year <= trough.year && p.value > peak.value) peak = p
    const latest = points[points.length - 1]!
    const fall = Math.round(((peak.value - trough.value) / peak.value) * 100)
    const back = Math.round(((latest.value - trough.value) / trough.value) * 100)
    expect(claimOf('reversal-0183')).toBe(
      `0183 peak ${peak.year} trough ${trough.year} fall ${fall}% recovery ${back}%`,
    )
  })

  it('extreme: Sundbyberg against Arjeplog on density, of 290', () => {
    const s = series('density')
    // The indicator's own last year, read from the pantry rather than written down. Plan 16 gave
    // each extreme fact its own indicator's latest year instead of one shared across the pantry,
    // and a literal here would pin the year this test was written rather than the rule it checks.
    const year = s.years[s.years.length - 1]!
    const col = s.years.indexOf(year)
    const present = data.municipalities
      .map((m) => ({ code: m.code, value: s.values[rowOf(m.code)]?.[col] ?? null }))
      .filter((x): x is { code: string; value: number } => x.value !== null)
      .sort((a, b) => b.value - a.value || a.code.localeCompare(b.code))
    const high = present[0]!
    const low = present[present.length - 1]!
    expect(claimOf('extreme-density')).toBe(
      `density ${year}: ${high.code} ${high.value} vs ${low.code} ${low.value}, of ${present.length}`,
    )
  })

  /**
   * The one claim only half re-derived here, said plainly rather than papered over.
   *
   * Kävlinge's own tax rate is checked against the pantry below, which is the figure a reader
   * would check. The neighbours' average is not: those neighbours come from a leave-one-out
   * run of Plan 6's distance metric, and recomputing them here would mean a second copy of
   * that metric in the site — which would then need its own test, and would drift. It is
   * checked where it is computed, in kitchen/src/facts/families.test.ts.
   */
  it('unusual: Kävlinge\u2019s own figure re-derives; the peer mean is checked in the kitchen', () => {
    const claim = claimOf('unusual-1261-tax-rate')
    const own = at('tax-rate', '1261', 2024)
    expect(own).not.toBeNull()
    expect(claim).toMatch(new RegExp(`^1261 tax-rate 2024: ${own} vs peers `))
    const peers = Number(claim.split('vs peers ')[1])
    expect(Number.isFinite(peers)).toBe(true)
    // It must at least be inside the range the country actually spans, so a broken peer
    // calculation cannot publish a number no municipality has.
    const s = series('tax-rate')
    const col = s.years.indexOf(2024)
    const all = data.municipalities
      .map((m) => s.values[rowOf(m.code)]?.[col] ?? null)
      .filter((v): v is number => v !== null)
    expect(peers).toBeGreaterThanOrEqual(Math.min(...all))
    expect(peers).toBeLessThanOrEqual(Math.max(...all))
  })
})

describe('every fact leads somewhere that shows it', () => {
  it.each(FACTS.map((f) => [f.id, f] as const))(
    '%s links to a view the site can render',
    (_id, fact) => {
      const state = parseHref(`/sv${fact.href}`, meta)
      // A link that parses to the defaults would silently drop the visitor on the front page.
      expect(meta.indicators).toContain(state.indicator)
      expect(fact.href).toContain(`i=${state.indicator}`)
      expect(fact.href).toContain(`y=${state.year}`)
    },
  )

  it.each(FACTS.map((f) => [f.id, f] as const))(
    '%s selects the municipality it is about, where it names one',
    (_id, fact) => {
      const state = parseHref(`/sv${fact.href}`, meta)
      if (!fact.href.includes('m=')) return
      expect(state.selected).not.toBeNull()
      const name = lk.municipality(state.selected!)!.name.sv
      expect(fact.text.sv).toContain(name)
    },
  )

  it.each(FACTS.map((f) => [f.id, f] as const))(
    '%s asks for a year its indicator actually covers',
    (_id, fact) => {
      const state = parseHref(`/sv${fact.href}`, meta)
      const { coverage } = lk.indicator(state.indicator)
      expect(state.year).toBeGreaterThanOrEqual(coverage.from)
      expect(state.year).toBeLessThanOrEqual(coverage.to)
    },
  )
})

describe('the strip itself', () => {
  it('has the five the architect chose', () => {
    expect(FACTS).toHaveLength(5)
    expect(new Set(FACTS.map((f) => f.id)).size).toBe(5)
  })

  it.each(LANGS)('says every fact in %s', (lang) => {
    for (const fact of FACTS) expect(fact.text[lang].length).toBeGreaterThan(20)
  })

  it('says something different in each language', () => {
    for (const fact of FACTS) expect(fact.text.sv).not.toBe(fact.text.en)
  })
})
