import { describe, expect, it } from 'vitest'
import rawData from '../../public/pantry/data/indicators.json'
import { PantryData } from '../../shared/pantry'
import { lookup } from '../data/select'
import { metaFrom, parseHref, LANGS } from '../state/url'
import { FACTS } from './facts'

const data = PantryData.parse(rawData)
const lk = lookup(data)
const meta = metaFrom(data)

describe('every fact still holds', () => {
  /**
   * The point of the whole module. A confident sentence on the front page that the data no
   * longer supports is worse than no sentence, and a monthly refresh is exactly when that
   * happens — so each fact is re-derived from the published pantry here.
   */
  it.each(FACTS.map((f) => [f.id, f] as const))('%s', (_id, fact) => {
    expect(fact.check(lk)).toBe(fact.claim)
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
