import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { lookup } from '../data/select'
import { Legend } from './Legend'
import { publishedPantry } from '../test/pantry'

const lk = lookup(publishedPantry)

let currentLang: 'sv' | 'en' = 'en'
const draw = (indicatorId: string, year: number, lang: 'sv' | 'en' = 'en') => {
  currentLang = lang
  return render(<Legend lk={lk} indicatorId={indicatorId} year={year} lang={lang} />)
}

const classList = () =>
  screen.getByRole('list', { name: currentLang === 'sv' ? 'Färgklasser' : 'Colour classes' })
const classItems = () => within(classList()).getAllByRole('listitem')

describe('Legend', () => {
  it('is a real list with an accessible name, not a row of unlabelled boxes', () => {
    draw('population', 2024)
    expect(classList()).toBeTruthy()
  })

  it('names the class list and the absence list separately', () => {
    draw('population', 2000)
    expect(screen.getByRole('list', { name: 'Colour classes' })).toBeTruthy()
    expect(screen.getByRole('list', { name: 'Why values are missing' })).toBeTruthy()
  })

  it('shows one entry per class, which is one more than the breaks', () => {
    draw('population', 2024)
    expect(classItems()).toHaveLength(lk.indicator('population').scale.breaks.length + 1)
  })

  it('labels the classes with the real break values, formatted for the language', () => {
    draw('population', 2024)
    const labels = classItems().map((li) => li.textContent)
    // Population breaks are [7810, 10715, 13521, 18867, 28557, 50194].
    expect(labels[0]).toContain('under 7,810')
    expect(labels[1]).toContain('7,810–10,715')
    expect(labels[6]).toContain('50,194 and over')
  })

  it('formats the same breaks the Swedish way in Swedish', () => {
    draw('population', 2024, 'sv')
    expect(classItems()[0]!.textContent).toContain('under 7 810')
  })

  it('states the unit once rather than on every class', () => {
    const { container } = draw('population', 2024)
    expect(container.textContent).toContain('residents')
    expect(classItems()[0]!.textContent).not.toContain('residents')
    expect(classItems().filter((li) => /residents/.test(li.textContent ?? ''))).toHaveLength(0)
  })

  it('names the price basis year where the values are money', () => {
    draw('house-prices', 2000)
    expect(screen.getByText(/2025 kronor/)).toBeTruthy()
  })

  it('marks where zero falls on a diverging scale', () => {
    // Net migration breaks are [-6.47, -2.32, 0.61, 3.28, 6.15, 10.5], so zero sits inside the
    // third class rather than on a break. The legend says where it actually is.
    draw('net-migration-rate', 2024)
    const zeroMarked = classItems().filter((li) => /zero falls here/i.test(li.textContent ?? ''))
    expect(zeroMarked).toHaveLength(1)
    expect(zeroMarked[0]!.textContent).toContain('-2.32')
  })

  it('does not mark zero on a sequential scale', () => {
    draw('population', 2024)
    expect(screen.queryByText(/zero falls here/i)).toBeNull()
  })

  it('shows a key for an absence only in a year where it actually occurs', () => {
    draw('house-prices', 1989)
    expect(screen.getByText(/too few sales/i)).toBeTruthy()
  })

  it('shows no suppression key on a map that has none', () => {
    draw('population', 2024)
    expect(screen.queryByText(/too few sales/i)).toBeNull()
  })

  it('shows a did-not-exist key in a year some municipalities are missing', () => {
    draw('population', 2000)
    expect(screen.getByText(/did not exist/i)).toBeTruthy()
  })

  it('explains perturbation as a note rather than a swatch, since those cells keep their colour', () => {
    draw('population', 2025)
    expect(screen.getByText(/adds random noise/i)).toBeTruthy()
    // It must not appear as one of the absence keys, because the value is there.
    const absences = screen.queryAllByRole('listitem').map((li) => li.textContent ?? '')
    expect(absences.filter((a) => /random noise/i.test(a))).toHaveLength(0)
  })

  it('says nothing about classes at all for a year the indicator does not cover', () => {
    draw('mean-age', 1970)
    expect(screen.queryByRole('list')).toBeNull()
  })
})

/**
 * The ramp answering "how big is that, then".
 *
 * Marked, never recoloured: the seven class colours are calibrated against the white plate and
 * carry the whole meaning of the map, so a legend that changed one of them to show a hover
 * would be changing the data's own key.
 */
describe('Legend, marking the class under the pointer', () => {
  const marked = () => classItems().filter((li) => li.hasAttribute('data-highlight'))

  it('marks nothing when the pointer is nowhere', () => {
    draw('population', 2024)
    expect(marked()).toHaveLength(0)
  })

  it('marks exactly one class, the one it was given', () => {
    render(<Legend lk={lk} indicatorId="population" year={2024} lang="en" highlightClass={3} />)
    const items = classItems()
    expect(items.filter((li) => li.hasAttribute('data-highlight'))).toHaveLength(1)
    expect(items[3]?.hasAttribute('data-highlight')).toBe(true)
  })

  it('leaves the class text alone, because the mark is not the meaning', () => {
    const plain = render(<Legend lk={lk} indicatorId="population" year={2024} lang="en" />)
      .container.textContent
    const lit = render(
      <Legend lk={lk} indicatorId="population" year={2024} lang="en" highlightClass={3} />,
    ).container.textContent
    expect(lit).toBe(plain)
  })
})
