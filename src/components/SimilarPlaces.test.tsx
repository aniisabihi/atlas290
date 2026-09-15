import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import rawData from '../../public/pantry/data/indicators.json'
import rawSimilar from '../../public/pantry/data/similar.json'
import { PantryData, Similar } from '../../shared/pantry'
import { lookup } from '../data/select'
import { defaultsFor, metaFrom, parseHref, type AppState } from '../state/url'
import { SimilarPlaces } from './SimilarPlaces'

const data = PantryData.parse(rawData)
const similar = Similar.parse(rawSimilar)
const lk = lookup(data)
const meta = metaFrom(data)
const base = defaultsFor(meta)

function show(state: Partial<AppState> = {}, lang: 'sv' | 'en' = 'sv') {
  return render(
    <SimilarPlaces
      lk={lk}
      similar={similar}
      meta={meta}
      state={{ ...base, lang, selected: '1281', ...state }}
      lang={lang}
    />,
  )
}

describe('SimilarPlaces', () => {
  it('lists the five the kitchen published, by name', () => {
    show()
    // Lund: Uppsala, Linköping, Umeå, Malmö, Göteborg.
    const links = screen.getAllByRole('link')
    expect(links.map((a) => a.textContent)).toEqual([
      'Uppsala',
      'Linköping',
      'Umeå',
      'Malmö',
      'Göteborg',
    ])
  })

  it('links to a state that selects that municipality and keeps the indicator and year', () => {
    show({ indicator: 'mean-age', year: 2010 })
    const uppsala = screen.getByRole('link', { name: 'Uppsala' })
    const landed = parseHref(uppsala.getAttribute('href')!, meta)
    expect(landed.selected).toBe('0380')
    expect(landed.indicator).toBe('mean-age')
    expect(landed.year).toBe(2010)
  })

  it('clears the comparison partner rather than carrying it across', () => {
    // Carrying it would leave Uppsala compared against whatever Lund was compared against,
    // which is a statement nobody asked for.
    show({ compare: '0180' })
    const landed = parseHref(
      screen.getByRole('link', { name: 'Uppsala' }).getAttribute('href')!,
      meta,
    )
    expect(landed.compare).toBeNull()
  })

  it('presents them as a set: no ordinals, no numbering, no distances', () => {
    // The measured median gap between the fifth and sixth nearest is 0.032 against typical
    // distances near 1.0, so any ordering language would be false precision.
    const { container } = show()
    const text = container.textContent ?? ''
    expect(text).not.toMatch(/\b1\.|\b2\.|\bmest\b|\bmost\b|\bfrämst\b/)
    expect(container.querySelector('ol')).toBeNull()
    expect(container.querySelector('ul')).not.toBeNull()
  })

  it('states the method from the published file, not from a literal in the component', () => {
    show()
    // Ten indicators over 2015-2024, read off similar.method rather than written here.
    expect(screen.getByText(/10 mått, 2015–2024/)).toBeTruthy()
  })

  it('renders nothing at all for a municipality the file does not cover', () => {
    const { container } = show({ selected: '9999' })
    expect(container.innerHTML).toBe('')
  })

  it('renders nothing when no municipality is selected', () => {
    const { container } = show({ selected: null })
    expect(container.innerHTML).toBe('')
  })

  it('names the places and the method in English too', () => {
    show({}, 'en')
    expect(screen.getByRole('heading', { name: 'Places like this one' })).toBeTruthy()
    expect(screen.getByText(/Closest across 10 measures, 2015–2024/)).toBeTruthy()
  })
})
