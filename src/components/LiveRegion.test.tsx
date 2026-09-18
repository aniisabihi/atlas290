import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render } from '@testing-library/react'
import { lookup, observationSentence } from '../data/select'
import { LiveRegion, SETTLE_MS } from './LiveRegion'
import { publishedPantry } from '../test/pantry'

const lk = lookup(publishedPantry)

describe('observationSentence', () => {
  it('gives name, indicator, year, value with unit and rank', () => {
    expect(observationSentence(lk, 'population', '0180', 2024, 'en')).toBe(
      'Stockholm, Population 2024: 995,574 residents, rank 1 of 290.',
    )
  })

  it('says why a value is missing instead of saying zero', () => {
    const sentence = observationSentence(lk, 'house-prices', '0128', 1989, 'en')
    expect(sentence).toMatch(/too few sales/i)
    expect(sentence).not.toMatch(/\b0\b/)
  })

  it('gives the value and the noise for a perturbed cell, not one or the other', () => {
    const sentence = observationSentence(lk, 'population', '0180', 2025, 'en')
    expect(sentence).toMatch(/999,239 residents/)
    expect(sentence).toMatch(/random noise/i)
  })

  it('gives no rank where there is no value to rank', () => {
    expect(observationSentence(lk, 'population', '0330', 2000, 'en')).not.toMatch(/rank/)
  })

  it('speaks Swedish', () => {
    expect(observationSentence(lk, 'population', '0180', 2024, 'sv')).toBe(
      'Stockholm, Folkmängd 2024: 995 574 invånare, plats 1 av 290.',
    )
  })
})

describe('LiveRegion', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  const live = () => document.querySelector('[data-live-region]')!

  /**
   * React batches state updates inside its own scheduler, so advancing a fake timer that ends in
   * a setState has to be wrapped in `act` or the render it triggers never flushes and the region
   * reads empty however long the clock is moved forward.
   */
  const settle = (ms: number) => act(() => void vi.advanceTimersByTime(ms))

  it('is a polite, atomic region', () => {
    render(<LiveRegion message="hello" />)
    expect(live().getAttribute('aria-live')).toBe('polite')
    expect(live().getAttribute('aria-atomic')).toBe('true')
  })

  it('says nothing until things settle', () => {
    render(<LiveRegion message="hello" />)
    expect(live().textContent).toBe('')
    settle(SETTLE_MS)
    expect(live().textContent).toBe('hello')
  })

  it('makes one announcement out of nine rapid changes, not nine', () => {
    const { rerender } = render(<LiveRegion message="year 1968" />)
    for (let year = 1969; year <= 1977; year += 1) {
      settle(50)
      rerender(<LiveRegion message={`year ${year}`} />)
      // Nothing has been said yet at any point during the drag.
      expect(live().textContent).toBe('')
    }
    settle(SETTLE_MS)
    expect(live().textContent).toBe('year 1977')
  })

  it('stays silent while the year is playing', () => {
    const { rerender } = render(<LiveRegion message="year 1968" silent />)
    settle(SETTLE_MS * 4)
    expect(live().textContent).toBe('')
    rerender(<LiveRegion message="year 1972" silent={false} />)
    settle(SETTLE_MS)
    expect(live().textContent).toBe('year 1972')
  })
})
