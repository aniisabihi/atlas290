import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import rawFacts from '../../public/pantry/data/facts.json'
import { Facts } from '../../shared/pantry'
import { FactsStrip } from './FactsStrip'

const facts = Facts.parse(rawFacts)
const FACTS = facts.facts

describe('FactsStrip', () => {
  it('is a named list of five facts', () => {
    render(<FactsStrip lang="en" facts={facts} />)
    expect(
      screen.getByRole('heading', { level: 2, name: /things you did not think to ask/i }),
    ).toBeTruthy()
    expect(screen.getAllByRole('link')).toHaveLength(5)
  })

  it('makes each fact a real link into the site, carrying the language', () => {
    render(<FactsStrip lang="en" facts={facts} />)
    for (const fact of FACTS) {
      const link = screen.getByRole('link', { name: fact.text.en })
      expect(link.getAttribute('href')).toBe(`/en${fact.href}`)
    }
  })

  it('speaks Swedish, and links into the Swedish pages', () => {
    render(<FactsStrip lang="sv" facts={facts} />)
    expect(screen.getByRole('link', { name: FACTS[0]!.text.sv })).toBeTruthy()
    expect(screen.getAllByRole('link')[0]!.getAttribute('href')).toMatch(/^\/sv\//)
  })

  it('shows the fact itself as the link text, not "read more"', () => {
    // A link named "read more" five times over is useless in a screen reader's link list.
    render(<FactsStrip lang="en" facts={facts} />)
    for (const link of screen.getAllByRole('link')) {
      expect(link.textContent!.length).toBeGreaterThan(20)
    }
  })
})
