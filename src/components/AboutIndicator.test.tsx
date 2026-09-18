import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AboutIndicator } from './AboutIndicator'
import { publishedParts } from '../test/pantry'

/** The prose lives in each indicator's own file since Plan 13, which is what this renders. */
const indicatorOf = (id: string) => publishedParts.get(id)!.indicator
const draw = (indicatorId: string, lang: 'sv' | 'en' = 'en') =>
  render(<AboutIndicator indicator={indicatorOf(indicatorId)} lang={lang} />)

describe('AboutIndicator', () => {
  it('is collapsed until asked for', () => {
    const { container } = draw('population')
    expect(container.querySelector('details')?.hasAttribute('open')).toBe(false)
  })

  it('shows the description from the pantry, not from the interface strings', () => {
    draw('median-income')
    expect(screen.getByText(/Median total earned income for people aged 16 and over/)).toBeTruthy()
  })

  it('renders the caveat in full, right to the end', () => {
    // The house-price caveat is a long paragraph, and its last clause is the one that explains
    // why a rich suburb appears among sparsely populated inland municipalities. Asserting on a
    // phrase near its end is what makes truncation fail this test.
    draw('house-prices')
    expect(
      screen.getByText(
        /Solna, whose housing stock is dominated by flats rather than single-family homes/,
      ),
    ).toBeTruthy()
  })

  it('states the coverage and, for money, the year its kronor are', () => {
    draw('median-income')
    expect(screen.getByText(/1999–2024, in 2025 kronor/)).toBeTruthy()
  })

  it('states no price basis for anything that is not money', () => {
    draw('population')
    expect(screen.getByText('1968–2025')).toBeTruthy()
    expect(screen.queryByText(/kronor/)).toBeNull()
  })

  it('lists every source table with its content code', () => {
    draw('net-migration-rate')
    const sources = indicatorOf('net-migration-rate').sources
    expect(sources.length).toBeGreaterThan(1)
    for (const source of sources) {
      expect(screen.getByText(new RegExp(`${source.table}.*${source.contentCode}`))).toBeTruthy()
    }
  })

  it('says how the value was calculated', () => {
    draw('net-migration-rate')
    expect(
      screen.getByText(/never derived by subtracting in- from out-migration flows/),
    ).toBeTruthy()
  })

  it('speaks Swedish, from the pantry', () => {
    draw('house-prices', 'sv')
    expect(screen.getByText(/Avser permanentbostäder/)).toBeTruthy()
  })
  it('carries a heading of its own, so its subheadings are not orphans', () => {
    // Without this the h3s below would sit under the legend's h2, and a screen reader walking
    // the page by heading level would find "Published for" nested under "Legend".
    draw('population')
    expect(screen.getByRole('heading', { level: 2, name: 'About this measure' })).toBeTruthy()
    for (const name of ['Published for', 'Worth knowing']) {
      expect(screen.getByRole('heading', { level: 3, name })).toBeTruthy()
    }
  })
})
