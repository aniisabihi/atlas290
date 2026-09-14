import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import rawData from '../../public/pantry/data/indicators.json'
import { PantryData } from '../../shared/pantry'
import { lookup } from '../data/select'
import { ComparePanel } from './ComparePanel'

const lk = lookup(PantryData.parse(rawData))
const draw = (compare: string | null, year = 2024, lang: 'sv' | 'en' = 'en') => {
  const onCompare = vi.fn()
  const result = render(
    <ComparePanel
      lk={lk}
      selected="0180"
      compare={compare}
      year={year}
      lang={lang}
      onCompare={onCompare}
    />,
  )
  return { onCompare, ...result }
}

describe('ComparePanel before a partner is chosen', () => {
  it('offers a search box asking for one', () => {
    draw(null)
    expect(screen.getByRole('combobox', { name: 'Compare with…' })).toBeTruthy()
  })

  it('does not offer the municipality already chosen', async () => {
    draw(null)
    await userEvent.type(screen.getByRole('combobox'), 'stockholm')
    expect(screen.queryByRole('option', { name: 'Stockholm' })).toBeNull()
  })

  it('reports the partner that was picked', async () => {
    const { onCompare } = draw(null)
    await userEvent.type(screen.getByRole('combobox'), 'malmo{Enter}')
    expect(onCompare).toHaveBeenCalledWith('1280')
  })
})

describe('ComparePanel with a partner', () => {
  it('names both municipalities', () => {
    draw('1280')
    expect(screen.getByRole('heading', { level: 2, name: 'Stockholm and Malmö' })).toBeTruthy()
  })

  it('is a real table with row and column headers', () => {
    draw('1280')
    const table = screen.getByRole('table')
    expect(within(table).getAllByRole('columnheader')).toHaveLength(3)
    expect(within(table).getAllByRole('rowheader')).toHaveLength(10)
  })

  it('states how many measures are higher, and out of how many were comparable', () => {
    draw('1280')
    expect(screen.getByText(/Higher on \d+ of \d+ comparable measures/)).toBeTruthy()
  })

  it('says how many could not be compared, rather than quietly counting them as ties', () => {
    // 1970: six of the ten indicators do not reach back that far.
    draw('1280', 1970)
    expect(screen.getByText(/measures cannot be compared this year/)).toBeTruthy()
  })

  it('never tells the visitor who won', () => {
    const { container } = draw('1280')
    expect(container.textContent).not.toMatch(/\b(better|worse|wins|winner|loses|beats)\b/i)
  })

  it('stops comparing when asked', async () => {
    const { onCompare } = draw('1280')
    await userEvent.click(screen.getByRole('button', { name: 'Stop comparing' }))
    expect(onCompare).toHaveBeenCalledWith(null)
  })

  it('speaks Swedish', () => {
    draw('1280', 2024, 'sv')
    expect(screen.getByRole('heading', { level: 2, name: 'Stockholm och Malmö' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Sluta jämföra' })).toBeTruthy()
  })
})
