import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { lookup } from '../data/select'
import { ProfileStory } from './ProfileStory'
import { publishedPantry } from '../test/pantry'

const data = publishedPantry
const lk = lookup(data)

const show = (code: string, year = 2024, lang: 'sv' | 'en' = 'sv') =>
  render(<ProfileStory lk={lk} code={code} year={year} lang={lang} />)

describe('ProfileStory', () => {
  it('writes a paragraph per sentence under one heading', () => {
    const { container } = show('0125') // Ekerö: one of the 57 where all three rules fire
    expect(screen.getByRole('heading', { name: 'Kort om kommunen' })).toBeTruthy()
    expect(container.querySelectorAll('p')).toHaveLength(3)
  })

  it('is prose, not a bulleted list', () => {
    const { container } = show('0125')
    expect(container.querySelector('ul')).toBeNull()
    expect(container.querySelector('ol')).toBeNull()
  })

  it('writes only the rules that fire', () => {
    // Stockholm has no turning point: it is at its largest now.
    const { container } = show('0180')
    expect(container.querySelectorAll('p')).toHaveLength(2)
    expect(container.textContent).not.toMatch(/som störst/)
  })

  it('follows the selected year', () => {
    show('0180', 1990)
    expect(screen.getByText(/sedan 1968, från 758 930 till/)).toBeTruthy()
    expect(screen.queryByText(/995 574/)).toBeNull()
  })

  it('writes English under an English heading', () => {
    show('2463', 2024, 'en')
    expect(screen.getByRole('heading', { name: 'In short' })).toBeTruthy()
    expect(screen.getByText(/It has shrunk 53% since 1968/)).toBeTruthy()
  })

  it('renders nothing rather than an empty heading when no rule fires', () => {
    // A code the pantry does not have: every rule declines, so there is no section at all.
    const { container } = show('9999')
    expect(container.innerHTML).toBe('')
  })
})
