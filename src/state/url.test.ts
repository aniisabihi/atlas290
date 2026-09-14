import { describe, expect, it } from 'vitest'
import rawData from '../../public/pantry/data/indicators.json'
import { PantryData } from '../../shared/pantry'
import {
  DEFAULT_LANG,
  LANGS,
  defaultsFor,
  metaFrom,
  parseHref,
  parseState,
  toUrl,
  type AppState,
  type PantryMeta,
} from './url'

/** A deliberately small stand-in, so the parser's rules are tested without a fixture file. */
const meta: PantryMeta = {
  indicators: ['population', 'mean-age', 'tax-rate'],
  codes: ['0180', '0330', '1280'],
  years: { min: 1968, max: 2026 },
  defaultYear: 2025,
}

const defaults = defaultsFor(meta)
const state = (over: Partial<AppState> = {}): AppState => ({ ...defaults, ...over })

describe('parseState', () => {
  it('gives every default for a bare language path', () => {
    expect(parseState('/sv/', '', meta)).toEqual({
      lang: 'sv',
      indicator: 'population',
      year: 2025,
      selected: null,
      compare: null,
      view: null,
      table: false,
    })
  })

  it('reads the language out of the path, not a query parameter', () => {
    expect(parseState('/en/', '', meta).lang).toBe('en')
    expect(parseState('/en/', '?lang=sv', meta).lang).toBe('en')
  })

  it('reads a full state', () => {
    expect(parseState('/en/', '?i=mean-age&y=2010&m=0180', meta)).toEqual(
      state({ lang: 'en', indicator: 'mean-age', year: 2010, selected: '0180' }),
    )
  })

  it.each([
    ['an unknown indicator', '?i=not-an-indicator', { indicator: 'population' }],
    ['a non-numeric year', '?y=banana', { year: 2025 }],
    ['an empty year', '?y=', { year: 2025 }],
    ['a year before the axis', '?y=1700', { year: 1968 }],
    ['a year after the axis', '?y=3000', { year: 2026 }],
    ['a fractional year', '?y=2010.5', { year: 2010 }],
    ['an unknown municipality', '?m=9999', { selected: null }],
    ['an empty municipality', '?m=', { selected: null }],
  ])('survives %s without throwing', (_label, search, expected) => {
    expect(parseState('/sv/', search, meta)).toEqual(state(expected))
  })

  it('never accepts a three-digit code, because 0180 is a string and not the number 180', () => {
    expect(parseState('/sv/', '?m=180', meta).selected).toBeNull()
  })

  it('honours an out-of-coverage year rather than clamping it to the indicator', () => {
    // Mean age is published from 1998. 1970 is a legal URL: the map shows its empty state and
    // offers a jump. Clamping would silently rewrite a link someone shared, and would hide the
    // fact that the ten indicators do not cover the same span.
    expect(parseState('/sv/', '?i=mean-age&y=1970', meta)).toEqual(
      state({ indicator: 'mean-age', year: 1970 }),
    )
  })

  it('clamps only to the axis, which no view can render outside of', () => {
    expect(parseState('/sv/', '?y=1967', meta).year).toBe(1968)
    expect(parseState('/sv/', '?y=2027', meta).year).toBe(2026)
  })

  it('drops unknown query parameters rather than carrying them along', () => {
    // Stated as a test so that Plan 4 adding ?compare= is a deliberate change to this module
    // and not something that quietly half-works.
    expect(toUrl(parseState('/sv/', '?compare=1280&nonsense=1', meta), meta)).toBe('/sv/')
  })

  it.each(['/', '/fr/', '/sv', '', '/pantry/data/indicators.json'])(
    'falls back to the default language for the path %j instead of throwing',
    (pathname) => {
      expect(parseState(pathname, '', meta).lang).toBe(DEFAULT_LANG)
    },
  )
})

describe('toUrl', () => {
  it('omits every default, so a shared link is short and pins nothing the visitor did not choose', () => {
    expect(toUrl(defaults, meta)).toBe('/sv/')
    expect(toUrl(state({ lang: 'en' }), meta)).toBe('/en/')
  })

  it('writes only what differs from the default', () => {
    expect(toUrl(state({ selected: '0180' }), meta)).toBe('/sv/?m=0180')
    expect(toUrl(state({ year: 2010 }), meta)).toBe('/sv/?y=2010')
    expect(toUrl(state({ indicator: 'mean-age' }), meta)).toBe('/sv/?i=mean-age')
  })

  it('writes keys in a fixed order, so the same state is always the same string', () => {
    const full = state({ indicator: 'mean-age', year: 2010, selected: '0180' })
    expect(toUrl(full, meta)).toBe('/sv/?i=mean-age&y=2010&m=0180')
  })
})

describe('the round trip', () => {
  it('survives every combination of language, indicator, year and selection', () => {
    const years = [meta.years.min, 1999, meta.defaultYear, meta.years.max]
    const selections = [...meta.codes, null]
    let checked = 0
    for (const lang of LANGS) {
      for (const indicator of meta.indicators) {
        for (const year of years) {
          for (const selected of selections) {
            for (const view of [null, 'map', 'cartogram'] as const) {
              for (const table of [false, true]) {
                const compare = selected === null ? null : selected === '0180' ? '1280' : '0180'
                const before: AppState = {
                  lang,
                  indicator,
                  year,
                  selected,
                  compare,
                  view,
                  table,
                }
                expect(parseHref(toUrl(before, meta), meta)).toEqual(before)
                checked += 1
              }
            }
          }
        }
      }
    }
    expect(checked).toBe(2 * 3 * 4 * 4 * 3 * 2)
  })
})

describe('metaFrom, against the real published pantry', () => {
  const real = metaFrom(PantryData.parse(rawData))

  it('finds all ten indicators and all 290 municipalities', () => {
    expect(real.indicators).toHaveLength(10)
    expect(real.codes).toHaveLength(290)
  })

  it('spans 1968 to 2026, because tax rates run a year ahead of everything else', () => {
    expect(real.years).toEqual({ min: 1968, max: 2026 })
  })

  it('defaults to the latest year the default indicator actually covers, not the axis end', () => {
    // The axis reaches 2026 but only tax-rate goes that far. Opening on a year where the
    // default indicator has nothing to show would greet every visitor with an empty map.
    expect(real.defaultYear).toBe(2025)
    expect(defaultsFor(real)).toEqual({
      lang: 'sv',
      indicator: 'population',
      year: 2025,
      selected: null,
      compare: null,
      view: null,
      table: false,
    })
  })

  it('round-trips a real deep link', () => {
    const href = '/en/?i=house-prices&y=1990&m=0184'
    expect(toUrl(parseHref(href, real), real)).toBe(href)
  })
})

describe('the state Plan 4 adds', () => {
  it('needs something to compare against', () => {
    // ?c without ?m is not half a comparison, it is nothing.
    expect(parseState('/sv/', '?c=0180', meta).compare).toBeNull()
  })

  it('refuses to compare a municipality with itself', () => {
    // It would render a panel of identical columns and a summary of ten ties.
    expect(parseState('/sv/', '?m=0180&c=0180', meta).compare).toBeNull()
  })

  it('accepts a real pair', () => {
    const parsed = parseState('/sv/', '?m=0180&c=1280', meta)
    expect([parsed.selected, parsed.compare]).toEqual(['0180', '1280'])
  })

  it('drops a comparison against a municipality that does not exist', () => {
    expect(parseState('/sv/', '?m=0180&c=9999', meta).compare).toBeNull()
  })

  it.each(['map', 'cartogram'])('reads ?v=%s', (view) => {
    expect(parseState('/sv/', `?v=${view}`, meta).view).toBe(view)
  })

  it('leaves the view unstated when the URL does not name one', () => {
    // Unstated means "whatever suits this screen". A concrete default would make a plain link
    // mean "the geographic map", and a phone would then be overriding the URL rather than
    // filling a gap in it.
    expect(parseState('/sv/', '', meta).view).toBeNull()
    expect(parseState('/sv/', '?v=bubbles', meta).view).toBeNull()
  })

  it('reads the table only from an explicit 1', () => {
    expect(parseState('/sv/', '?t=1', meta).table).toBe(true)
    expect(parseState('/sv/', '?t=0', meta).table).toBe(false)
    expect(parseState('/sv/', '?t=yes', meta).table).toBe(false)
    expect(parseState('/sv/', '', meta).table).toBe(false)
  })

  it('keeps a plain map link short', () => {
    expect(toUrl(defaults, meta)).toBe('/sv/')
  })

  it('writes the new keys in a fixed order after the old ones', () => {
    expect(
      toUrl(
        state({ selected: '0180', compare: '1280', view: 'cartogram', table: true, year: 2010 }),
        meta,
      ),
    ).toBe('/sv/?y=2010&m=0180&c=1280&v=cartogram&t=1')
  })

  it('never writes a comparison without its subject', () => {
    expect(toUrl(state({ selected: null, compare: '1280' }), meta)).toBe('/sv/')
  })
})
