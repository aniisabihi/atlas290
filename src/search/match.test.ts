import { describe, expect, it } from 'vitest'
import { fold, searchMunicipalities } from './match'
import { publishedPantry } from '../test/pantry'

const { municipalities } = publishedPantry
const find = (q: string, lang: 'sv' | 'en' = 'sv') =>
  searchMunicipalities(q, municipalities, lang).map((m) => m.name[lang])

describe('fold', () => {
  it.each([
    ['Malmö', 'malmo'],
    ['Ängelholm', 'angelholm'],
    ['Östersund', 'ostersund'],
    ['Sävsjö', 'savsjo'],
    ['Härnösand', 'harnosand'],
  ])('strips the accents from %s', (name, folded) => {
    expect(fold(name)).toBe(folded)
  })
})

describe('searchMunicipalities', () => {
  it.each([
    ['Malmo', 'Malmö'],
    ['malmö', 'Malmö'],
    ['MALMÖ', 'Malmö'],
    ['Ostersund', 'Östersund'],
    ['Angelholm', 'Ängelholm'],
    ['Savsjo', 'Sävsjö'],
    ['Harnosand', 'Härnösand'],
  ])('finds %s without a Swedish keyboard', (query, expected) => {
    expect(find(query)[0]).toBe(expected)
  })

  it('finds a municipality by its four-digit code', () => {
    expect(find('0180')).toEqual(['Stockholm'])
  })

  it('does not accept a three-digit code, because 0180 is a string and not the number 180', () => {
    // No municipality name contains a digit either, verified against all 290, so this can only
    // ever have been a mistyped code.
    expect(find('180')).toEqual([])
  })

  it('puts a prefix match before a match in the middle of a name', () => {
    const results = find('köping')
    expect(results[0]).toBe('Köping')
    expect(results).toContain('Nyköping')
    expect(results.indexOf('Köping')).toBeLessThan(results.indexOf('Nyköping'))
  })

  it('returns both of the Upplands municipalities', () => {
    expect(find('Upplands')).toEqual(['Upplands Väsby', 'Upplands-Bro'])
  })

  it('sorts by the Swedish alphabet, where å, ä and ö come after z', () => {
    // English collation would file Åre under A and put it first. A Swedish reader notices.
    const results = find('s').filter((n) =>
      ['Vansbro', 'Ystad', 'Åstorp', 'Älvsbyn', 'Örnsköldsvik'].includes(n),
    )
    expect(results).toEqual(['Vansbro', 'Ystad', 'Åstorp', 'Älvsbyn', 'Örnsköldsvik'])
  })

  it('returns nothing for an empty query, rather than all 290', () => {
    expect(find('')).toEqual([])
    expect(find('   ')).toEqual([])
  })

  it('returns nothing when nothing matches', () => {
    expect(find('zzzz')).toEqual([])
  })

  it('gives the same answers in English, because the names are the same in both', () => {
    expect(find('Malmo', 'en')).toEqual(find('Malmo', 'sv'))
  })
})

describe('what was typed, letter for letter, comes first', () => {
  it('puts Söderhamn before Sollefteå when the visitor typed "sö"', () => {
    // Folding makes "sö" match "so", which is right — nobody should have to find the ö key — but
    // it also ranked Sollefteå, Sollentuna and Solna above every name that actually begins with
    // what was typed. The folded match decides WHETHER a name is offered; the literal one decides
    // which of the offered names come first.
    const names = searchMunicipalities('sö', municipalities, 'sv').map((m) => m.name.sv)
    const firstSo = names.findIndex((n) => n.startsWith('So'))
    const lastSo = names.map((n) => n.startsWith('Sö')).lastIndexOf(true)
    expect(names[0]).toMatch(/^Sö/)
    expect(lastSo).toBeLessThan(firstSo)
  })

  it('still offers the folded matches, after the literal ones', () => {
    const names = searchMunicipalities('sö', municipalities, 'sv').map((m) => m.name.sv)
    expect(names).toContain('Solna')
  })

  it('leaves a query with no diacritic in alphabetical order, as before', () => {
    const names = searchMunicipalities('so', municipalities, 'sv').map((m) => m.name.sv)
    expect(names.indexOf('Solna')).toBeLessThan(names.indexOf('Söderhamn'))
  })
})
