import { describe, expect, it } from 'vitest'
import rawData from '../../public/pantry/data/indicators.json'
import { PantryData } from '../../shared/pantry'
import { lookup } from '../data/select'
import { defaultsFor, metaFrom, type AppState } from './url'
import { titleFor } from './title'

const data = PantryData.parse(rawData)
const lk = lookup(data)
const meta = metaFrom(data)
const state = (over: Partial<AppState> = {}): AppState => ({ ...defaultsFor(meta), ...over })

describe('titleFor', () => {
  it('names the indicator and year when nothing is selected', () => {
    expect(titleFor(lk, state({ lang: 'en', year: 2024 }))).toBe(
      "Population 2024 · Sweden's municipalities in data",
    )
  })

  it('puts the municipality first, because that is what the visitor came for', () => {
    expect(titleFor(lk, state({ lang: 'en', year: 2024, selected: '0180' }))).toBe(
      "Stockholm · Population 2024 · Sweden's municipalities in data",
    )
  })

  it('names both when comparing', () => {
    expect(titleFor(lk, state({ lang: 'en', year: 2024, selected: '0180', compare: '1280' }))).toBe(
      "Stockholm and Malmö · Population 2024 · Sweden's municipalities in data",
    )
  })

  it('says which view it is', () => {
    expect(titleFor(lk, state({ lang: 'en', year: 2024, view: 'cartogram' }))).toContain(
      'Population 2024 (bubble chart)',
    )
    expect(titleFor(lk, state({ lang: 'en', year: 2024, table: true }))).toContain(
      'Population 2024 (table)',
    )
  })

  it('does not say "map", because that is the ordinary case and needs no label', () => {
    expect(titleFor(lk, state({ lang: 'en', year: 2024, view: 'map' }))).toBe(
      "Population 2024 · Sweden's municipalities in data",
    )
  })

  it('speaks Swedish throughout, taking the indicator name from the pantry', () => {
    expect(titleFor(lk, state({ year: 2024, selected: '1280', indicator: 'mean-age' }))).toBe(
      'Malmö · Medelålder 2024 · Sveriges kommuner i data',
    )
  })

  it('never leaks a raw indicator id or a four-digit code into the tab', () => {
    for (const indicator of meta.indicators) {
      for (const selected of [null, '0180']) {
        const title = titleFor(lk, state({ indicator, selected, compare: null }))
        expect(title, indicator).not.toContain(indicator)
        if (selected) expect(title).not.toContain(selected)
      }
    }
  })
})
