import { describe, expect, it } from 'vitest'
import { UNIT_DECIMALS } from './pantry'
import { UNIT_WORDS, withUnit } from './units'

describe('unit words', () => {
  it('names every unit the pantry can publish, in both languages', () => {
    // UNIT_DECIMALS is the contract's own list of units, so a unit added there and not here
    // would render as "undefined" beside every figure.
    expect(Object.keys(UNIT_WORDS).sort()).toEqual(Object.keys(UNIT_DECIMALS).sort())
    for (const words of Object.values(UNIT_WORDS)) {
      expect(words.sv.length).toBeGreaterThan(0)
      expect(words.en.length).toBeGreaterThan(0)
    }
  })
})

describe('withUnit', () => {
  it('spaces the percent sign in Swedish, with a non-breaking space', () => {
    expect(withUnit('32,42', 'percent', 'sv')).toBe('32,42 %')
  })

  it('hugs the percent sign in English', () => {
    expect(withUnit('32.42', 'percent', 'en')).toBe('32.42%')
  })

  it('separates a unit word with an ordinary space in both languages', () => {
    expect(withUnit('6 529,2', 'per-km2', 'sv')).toBe('6 529,2 inv/km²')
    expect(withUnit('6,529.2', 'per-km2', 'en')).toBe('6,529.2 people/km²')
  })
})
