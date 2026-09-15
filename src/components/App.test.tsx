import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import rawData from '../../public/pantry/data/indicators.json'
import rawTopology from '../../public/pantry/geometry/municipalities.topo.json'
import rawAdjacency from '../../public/pantry/geometry/adjacency.json'
import rawBubbles from '../../public/pantry/layout/bubbles.json'
import rawSimilar from '../../public/pantry/data/similar.json'
import rawFacts from '../../public/pantry/data/facts.json'
import { Adjacency, Bubbles, Facts, PantryData, Similar } from '../../shared/pantry'
import type { MunicipalityTopology } from '../../shared/geometry'
import { App } from './App'
import { SETTLE_MS } from './LiveRegion'

const data = PantryData.parse(rawData)
const topology = rawTopology as unknown as MunicipalityTopology
const adjacency = Adjacency.parse(rawAdjacency)
const bubbles = Bubbles.parse(rawBubbles)
const similar = Similar.parse(rawSimilar)
const facts = Facts.parse(rawFacts)

/**
 * Integration, at the level where the pieces are wired to each other. The unit tests all passed
 * while the live region kept saying "no neighbouring municipality that way" long after the
 * visitor had walked somewhere else, because that bug lived in the wiring rather than in any one
 * component.
 */
const open = (url: string) => {
  window.history.replaceState(null, '', url)
  return render(
    <App
      data={data}
      topology={topology}
      adjacency={adjacency}
      bubbles={bubbles}
      similar={similar}
      facts={facts}
    />,
  )
}

const live = () => document.querySelector('[data-live-region]')!
const settle = () => act(() => void vi.advanceTimersByTime(SETTLE_MS))

describe('App', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }))
  afterEach(() => {
    vi.useRealTimers()
    window.history.replaceState(null, '', '/')
  })

  it('renders the whole view from the URL alone', () => {
    open('/en/?i=house-prices&y=1990&m=0184')
    expect((screen.getByRole('combobox', { name: 'Measure' }) as HTMLSelectElement).value).toBe(
      'house-prices',
    )
    expect((screen.getByRole('slider') as HTMLInputElement).value).toBe('1990')
    expect(screen.getByRole('button', { current: true }).getAttribute('aria-label')).toMatch(
      /^Solna/,
    )
  })

  it('announces the selected municipality once things settle', () => {
    open('/en/?y=2024&m=0180')
    settle()
    expect(live().textContent).toBe('Stockholm, Population 2024: 995,574 residents, rank 1 of 290.')
  })

  it('says there is nothing that way when a key points at open sea', async () => {
    open('/en/?y=2024&m=2584')
    const kiruna = screen.getByRole('button', { current: true })
    kiruna.focus()
    await userEvent.keyboard('{ArrowUp}')
    settle()
    expect(live().textContent).toMatch(/no neighbouring municipality that way/i)
  })

  it('stops saying it as soon as a key does move', async () => {
    // The regression this file exists for. One failed press used to leave the live region stuck
    // on "nothing that way" for the rest of the session.
    open('/en/?y=2024&m=2584')
    screen.getByRole('button', { current: true }).focus()
    await userEvent.keyboard('{ArrowUp}')
    settle()
    expect(live().textContent).toMatch(/no neighbouring municipality that way/i)

    await userEvent.keyboard('{ArrowDown}')
    settle()
    expect(live().textContent).not.toMatch(/no neighbouring municipality/i)
    expect(live().textContent).toMatch(/^Kiruna/)
  })

  it('keeps the year when the indicator changes, and explains the empty map', async () => {
    open('/en/?y=1970')
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Measure' }), 'mean-age')
    expect((screen.getByRole('slider') as HTMLInputElement).value).toBe('1970')
    expect(screen.getByText(/Mean age is published for 1998–2025/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Go to 1998' })).toBeTruthy()
  })

  it('puts the whole view in the address bar', async () => {
    open('/en/?y=2024')
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Measure' }), 'mean-age')
    expect(window.location.pathname + window.location.search).toBe('/en/?i=mean-age&y=2024')
  })

  it('opens a profile for the selected municipality and puts focus on its heading', () => {
    open('/en/?y=2024&m=0180')
    const heading = screen.getByRole('heading', { level: 2, name: 'Stockholm' })
    expect(heading).toBe(document.activeElement)
    expect(screen.getByText('995,574 residents')).toBeTruthy()
  })

  it('returns focus to the map shape when the profile is closed', async () => {
    // Otherwise a keyboard visitor is dropped at the top of the document every time they close
    // a panel, which is the classic way a non-modal panel goes wrong.
    open('/en/?y=2024&m=0180')
    await userEvent.click(screen.getByRole('button', { name: /close the municipality panel/i }))
    expect(window.location.search).toBe('?y=2024')
    expect(document.activeElement?.getAttribute('aria-label')).toMatch(/^Stockholm/)
  })

  it('shows no profile when nothing is selected', () => {
    open('/en/?y=2024')
    expect(screen.queryByRole('button', { name: /close the municipality panel/i })).toBeNull()
  })

  // These two are the tests that were missing when the cartogram was first wired in: the switch
  // rendered, the import was there, and nothing actually swapped the view.
  it('shows the map when the URL does not ask for anything else', () => {
    open('/en/?y=2024')
    expect(screen.getByRole('group', { name: /map of sweden/i })).toBeTruthy()
    expect(screen.queryByRole('group', { name: /bubble chart/i })).toBeNull()
  })

  it('shows the cartogram when the URL asks for it', () => {
    open('/en/?y=2024&v=cartogram')
    expect(screen.getByRole('group', { name: /bubble chart/i })).toBeTruthy()
    expect(screen.queryByRole('group', { name: /map of sweden/i })).toBeNull()
  })

  it('switches view from the control, and puts it in the URL', async () => {
    open('/en/?y=2024')
    await userEvent.click(screen.getByRole('button', { name: 'Bubbles' }))
    expect(window.location.search).toBe('?y=2024&v=cartogram')
    expect(screen.getByRole('group', { name: /bubble chart/i })).toBeTruthy()
  })

  it('shows the table instead of either view when asked', () => {
    open('/en/?y=2024&t=1')
    expect(screen.getByRole('table', { name: 'Population, 2024' })).toBeTruthy()
    expect(screen.queryByRole('group', { name: /map of sweden/i })).toBeNull()
  })

  it('defaults to the bubbles on a narrow screen, and to the map on a wide one', async () => {
    const { stubMediaQuery } = await import('../test-setup')
    const { NARROW } = await import('./App')
    stubMediaQuery(NARROW)
    open('/en/?y=2024')
    expect(screen.getByRole('group', { name: /bubble chart/i })).toBeTruthy()
  })

  it('lets the URL override that default, because a screen size is not a decision', async () => {
    const { stubMediaQuery } = await import('../test-setup')
    const { NARROW } = await import('./App')
    stubMediaQuery(NARROW)
    open('/en/?y=2024&v=map')
    expect(screen.getByRole('group', { name: /map of sweden/i })).toBeTruthy()
  })

  it('shows the profile as a sheet on a narrow screen', async () => {
    const { stubMediaQuery } = await import('../test-setup')
    const { NARROW } = await import('./App')
    stubMediaQuery(NARROW)
    const { container } = open('/en/?y=2024&m=0180')
    expect(container.querySelector('.profile--sheet')).not.toBeNull()
  })

  it('closes the profile with Escape, and gives focus back', async () => {
    open('/en/?y=2024&m=0180')
    await userEvent.keyboard('{Escape}')
    expect(window.location.search).toBe('?y=2024')
    expect(document.activeElement?.getAttribute('aria-label')).toMatch(/^Stockholm/)
  })

  it('names the view in the page title', () => {
    open('/en/?i=mean-age&y=2010&m=1280')
    expect(document.title).toBe('Malmö · Mean age 2010 · Atlas 290')
  })

  it('updates the title when the view changes', async () => {
    open('/en/?y=2024')
    expect(document.title).toBe('Population 2024 · Atlas 290')
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Measure' }), 'mean-age')
    expect(document.title).toBe('Mean age 2024 · Atlas 290')
  })

  it('offers the other language as a link carrying the current view', () => {
    open('/en/?i=mean-age&y=2010&m=1280')
    expect(screen.getByRole('link', { name: /switch language/i }).getAttribute('href')).toBe(
      '/sv/malmo-1280/?i=mean-age&y=2010',
    )
  })
})
