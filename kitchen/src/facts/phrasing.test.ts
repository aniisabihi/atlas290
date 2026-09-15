import { describe, expect, it } from 'vitest'
import rawData from '../../../public/pantry/data/indicators.json'
import { PantryData, type Municipality } from '../../../shared/pantry'
import { contextFor, FAMILIES } from './families'
import { MAX_NAMED, phrase } from './phrasing'

const data = PantryData.parse(rawData)
const ctx = contextFor(data)
const byCode = new Map(data.municipalities.map((m) => [m.code, m]))
const lookup = { municipality: (code: string): Municipality | undefined => byCode.get(code) }
const best = (family: keyof typeof FAMILIES) => phrase(FAMILIES[family](ctx)[0]!, lookup)

describe('every family renders', () => {
  it.each(Object.keys(FAMILIES) as Array<keyof typeof FAMILIES>)(
    '%s produces a finished sentence in both languages',
    (family) => {
      const { text } = best(family)
      for (const lang of ['sv', 'en'] as const) {
        expect(text[lang], lang).toMatch(/\.$/)
        expect(text[lang], lang).toMatch(/\d/)
        expect(text[lang], lang).not.toMatch(/undefined|NaN|Infinity/)
      }
      expect(text.sv).not.toBe(text.en)
    },
  )

  it.each(Object.keys(FAMILIES) as Array<keyof typeof FAMILIES>)(
    '%s links somewhere with an indicator and a year',
    (family) => {
      const { href } = best(family)
      expect(href).toMatch(/^\/\?/)
      expect(href).toMatch(/i=/)
      expect(href).toMatch(/y=/)
    },
  )
})

describe('the country sentence', () => {
  it('makes the measure the subject and the movement a verb', () => {
    // "Alla 284 kommuner har högre eftergymnasial utbildning än 1985" reads as though a
    // municipality possesses an education. The indicator is a share of residents, and only
    // some of the ten are things a place can have more of.
    const { text } = best('country')
    expect(text.sv).toBe('Eftergymnasial utbildning har stigit i alla 284 kommuner sedan 1985.')
    expect(text.en).toBe('Post-secondary education has risen in all 284 municipalities since 1985.')
  })

  it('says "all" rather than "284 of 284" when the country is unanimous', () => {
    expect(best('country').text.sv).not.toMatch(/284 av 284/)
  })
})

describe('the run sentence', () => {
  it('counts the municipalities rather than listing twelve names', () => {
    const { text } = best('run')
    expect(text.sv).toBe('12 kommuner har vuxit varje år sedan 1968 — 57 år i rad.')
    expect(text.en).toBe('12 municipalities have grown every year since 1968 — 57 years running.')
  })

  it('names them when there are few enough, and links to the first', () => {
    const decline = FAMILIES.run(ctx).find((c) => c.id === 'run-decline')!
    const { text, href } = phrase(decline, lookup)
    expect(text.sv).toBe('Kramfors och Strömsund har krympt varje år sedan 1968 — 47 år i rad.')
    expect(text.en).toContain('Kramfors and Strömsund')
    expect(href).toContain('m=2282')
  })

  it('agrees the verb with a single municipality in English', () => {
    const one = FAMILIES.run(ctx).find((c) => c.id === 'run-decline')!
    if (one.family !== 'run') throw new Error('not a run')
    const { text } = phrase({ ...one, codes: ['2282'] }, lookup)
    expect(text.en).toMatch(/^Kramfors has shrunk/)
  })

  it('switches from names to a count above the threshold', () => {
    const growth = FAMILIES.run(ctx).find((c) => c.id === 'run-growth')!
    if (growth.family !== 'run') throw new Error('not a run')
    expect(growth.codes.length).toBeGreaterThan(MAX_NAMED)
    const trimmed = phrase({ ...growth, codes: growth.codes.slice(0, MAX_NAMED) }, lookup)
    expect(trimmed.text.sv).toContain('och')
    expect(trimmed.text.sv).not.toMatch(/^3 kommuner/)
  })
})

describe('the other three sentences', () => {
  it('states the reversal in both directions', () => {
    const { text } = best('reversal')
    expect(text.sv).toBe('Sundbyberg var 11 % mindre 1981 än 1972 — och är nu 123 % större än då.')
  })

  it('states the unusual one against its twins, with both figures', () => {
    const { text } = best('unusual')
    expect(text.sv).toBe(
      'Kommunal skattesats i Kävlinge — lägre än i platserna som liknar den: 29,69 mot 32,64.',
    )
    expect(text.en).toBe(
      'Municipal tax rate in Kävlinge — lower than in the places most like it: 29.69 against 32.64.',
    )
    // The article trap this phrasing avoids: "has lower municipal tax rate" is missing an "a",
    // and adding one breaks "lower house prices", which is plural.
    expect(text.en).not.toMatch(/has (lower|higher)/)
  })

  it('formats numbers for each locale', () => {
    const { text } = best('extreme')
    // Swedish groups thousands with a NON-BREAKING space (U+00A0) and uses a comma for
    // decimals; English groups with a comma and uses a full stop. Written as an escape
    // rather than a literal space, because the two are indistinguishable in a diff and the
    // non-breaking one is what stops a figure splitting across two lines.
    expect(text.sv).toContain('6\u00a0446,0')
    expect(text.sv).not.toContain('6 446,0')
    expect(text.en).toContain('6,446.0')
  })

  it('shows each value at its own indicator precision, never more', () => {
    // Density publishes one decimal; the sentence must not assert a second.
    const { text } = best('extreme')
    expect(text.sv).toContain('0,2')
    expect(text.sv).not.toMatch(/0,20/)
  })
})

describe('no sentence says whether anything is good', () => {
  it.each(Object.keys(FAMILIES) as Array<keyof typeof FAMILIES>)('%s', (family) => {
    const { text } = best(family)
    expect(text.sv).not.toMatch(/bäst|sämst|bättre|sämre|tyvärr|lyckligtvis/i)
    expect(text.en).not.toMatch(/\bbest\b|\bworst\b|better|worse|sadly|fortunately/i)
  })
})
