import { describe, expect, it } from 'vitest'
import { type Indicator } from '../../shared/pantry'
import { formatValue, formatWithUnit, priceBasisYear, statusPhrase, unitSuffix } from './format'
import { publishedPantry } from '../test/pantry'

const data = publishedPantry
const byId = (id: string): Indicator => {
  const i = data.indicators.find((x) => x.id === id)
  if (!i) throw new Error(`no indicator ${id}`)
  return i
}

/** Intl's sv-SE groups thousands with a no-break space (U+00A0), not an ordinary one. */
const NBSP = '\u00a0'

describe('formatValue', () => {
  it('groups thousands the Swedish way and the English way', () => {
    expect(formatValue(984_748, byId('population'), 'sv')).toBe(`984${NBSP}748`)
    expect(formatValue(984_748, byId('population'), 'en')).toBe('984,748')
  })

  it('uses a comma decimal separator in Swedish and a point in English', () => {
    expect(formatValue(32.38, byId('tax-rate'), 'sv')).toBe('32,38')
    expect(formatValue(32.38, byId('tax-rate'), 'en')).toBe('32.38')
  })

  it('always signs a diverging value, because the direction is the whole point', () => {
    expect(formatValue(6.15, byId('net-migration-rate'), 'en')).toBe('+6.15')
    expect(formatValue(-6.47, byId('net-migration-rate'), 'en')).toBe('-6.47')
    expect(formatValue(0, byId('net-migration-rate'), 'en')).toBe('0.00')
  })

  it('does not sign a sequential value', () => {
    expect(formatValue(41.2, byId('mean-age'), 'en')).toBe('41.2')
  })

  it('never renders an absent value as zero', () => {
    expect(formatValue(null, byId('population'), 'sv')).not.toMatch(/0/)
    expect(formatValue(null, byId('population'), 'sv')).toBe('–')
  })
})

describe('unitSuffix', () => {
  it.each([
    ['population', 'sv', 'invånare'],
    ['population', 'en', 'residents'],
    ['tax-rate', 'sv', '%'],
    ['tax-rate', 'en', '%'],
    ['mean-age', 'sv', 'år'],
    ['mean-age', 'en', 'years'],
    ['density', 'sv', 'inv/km²'],
    ['density', 'en', 'people/km²'],
    ['net-migration-rate', 'sv', 'per 1 000 invånare'],
    ['net-migration-rate', 'en', 'per 1,000 residents'],
    ['median-income', 'sv', 'kr'],
    ['median-income', 'en', 'SEK'],
  ])('%s in %s is "%s"', (id, lang, expected) => {
    expect(unitSuffix(byId(id), lang as 'sv' | 'en')).toBe(expected)
  })
})

describe('priceBasisYear', () => {
  it('reads the year off the indicator rather than inferring it from coverage', () => {
    expect(priceBasisYear(byId('median-income'))).toBe(2025)
    expect(priceBasisYear(byId('house-prices'))).toBe(2025)
  })

  it('is the reason the year is stored at all: income stops a year before its own price basis', () => {
    // Inferring the basis from coverage.to would print "2024 kronor" for median income —
    // wrong by a year of inflation, and a false statement about money. Verified against the
    // frozen SCB source: house prices for 2025 equal SCB's nominal figure exactly, while 2024
    // values carry a 1.0068 uplift.
    const income = byId('median-income')
    expect(income.coverage.to).toBe(2024)
    expect(income.priceBasisYear).toBe(2025)
    expect(income.priceBasisYear).not.toBe(income.coverage.to)
  })

  it('is absent for everything that is not money', () => {
    expect(priceBasisYear(byId('population'))).toBeNull()
    expect(priceBasisYear(byId('mean-age'))).toBeNull()
  })
})

describe('formatWithUnit', () => {
  it('states the price basis year for money, in both languages', () => {
    expect(formatWithUnit(397_491, byId('median-income'), 'sv')).toBe(
      `397${NBSP}491 kr (2025 års penningvärde)`,
    )
    expect(formatWithUnit(397_491, byId('median-income'), 'en')).toBe(
      '397,491 SEK (in 2025 kronor)',
    )
  })

  it('states no price basis for anything that is not money', () => {
    expect(formatWithUnit(32.38, byId('tax-rate'), 'en')).toBe('32.38%')
    expect(formatWithUnit(984_748, byId('population'), 'en')).toBe('984,748 residents')
  })
})

describe('statusPhrase', () => {
  it.each([
    ['did-not-exist', 'sv', /fanns inte/i],
    ['did-not-exist', 'en', /did not exist/i],
    ['not-yet-published', 'sv', /publicerat/i],
    ['not-yet-published', 'en', /not.*published/i],
    ['too-few-cases', 'sv', /för få/i],
    ['too-few-cases', 'en', /too few/i],
    ['perturbed', 'sv', /brus|slump/i],
    ['perturbed', 'en', /noise|random/i],
    ['structural-break', 'sv', /kommungräns|gräns/i],
    ['structural-break', 'en', /boundar/i],
  ])('explains %s in %s', (status, lang, pattern) => {
    expect(statusPhrase(status as never, lang as 'sv' | 'en')).toMatch(pattern)
  })

  it('says something for every status, so no cell can go unexplained', () => {
    for (const lang of ['sv', 'en'] as const) {
      for (const s of [
        'present',
        'not-yet-published',
        'did-not-exist',
        'perturbed',
        'too-few-cases',
        'structural-break',
      ] as const) {
        expect(statusPhrase(s, lang).length).toBeGreaterThan(0)
      }
    }
  })
})
