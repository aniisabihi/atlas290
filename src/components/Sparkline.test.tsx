import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { lookup } from '../data/select'
import { Sparkline, segmentsFor } from './Sparkline'
import { publishedPantry } from '../test/pantry'

const lk = lookup(publishedPantry)
const draw = (indicatorId: string, code: string, year = 2024) =>
  render(<Sparkline lk={lk} indicatorId={indicatorId} code={code} year={year} />)

describe('segmentsFor', () => {
  it('gives one unbroken run for a complete series', () => {
    const segments = segmentsFor(lk, 'population', '0180')
    expect(segments).toHaveLength(1)
    expect(segments[0]).toHaveLength(lk.series('population').years.length)
  })

  it('starts where the municipality starts, not where the axis starts', () => {
    // Knivsta's population is published from 2002 — SCB carries the year before the formal
    // 2003 split under the new code. Drawing from 1968 would invent a history.
    const segments = segmentsFor(lk, 'population', '0330')
    expect(segments).toHaveLength(1)
    expect(segments[0]![0]!.year).toBe(2002)
  })

  it('breaks the line at a hole rather than drawing across it', () => {
    // Salem's house prices run 1983–2025 with 1989 and 1992 suppressed for too few sales.
    // Joining across them would draw a price that was never published.
    const segments = segmentsFor(lk, 'house-prices', '0128')
    expect(segments).toHaveLength(3)
    expect(segments[0]![0]!.year).toBe(1983)
    expect(segments.map((s) => s[s.length - 1]!.year)).toEqual([1988, 1991, 2025])
    expect(segments.map((s) => s[0]!.year)).toEqual([1983, 1990, 1993])
  })

  it('gives nothing at all where the indicator has nothing for that municipality', () => {
    expect(segmentsFor(lk, 'mean-age', '0330').every((s) => s.length > 0)).toBe(true)
  })
})

describe('Sparkline', () => {
  it('draws one path per unbroken run', () => {
    const { container } = draw('house-prices', '0128')
    expect(container.querySelectorAll('[data-segment]')).toHaveLength(3)
  })

  it('draws a single path for a complete series', () => {
    const { container } = draw('population', '0180')
    expect(container.querySelectorAll('[data-segment]')).toHaveLength(1)
  })

  it('is hidden from assistive technology, because the numbers are already text', () => {
    const { container } = draw('population', '0180')
    const svg = container.querySelector('svg')!
    expect(svg.getAttribute('aria-hidden')).toBe('true')
    expect(svg.getAttribute('focusable')).toBe('false')
  })

  it('marks the current year, and moves the mark when the year changes', () => {
    const at = (year: number) =>
      draw('population', '0180', year).container.querySelector('[data-cursor]')!.getAttribute('x1')
    const early = Number(at(1970))
    const late = Number(at(2020))
    expect(early).toBeLessThan(late)
  })

  it('drops the cursor for a year outside the indicator', () => {
    const { container } = draw('mean-age', '0180', 1970)
    expect(container.querySelector('[data-cursor]')).toBeNull()
  })

  it('scales to the municipality own range, so a small one is not a flat line', () => {
    // Dorotea's population runs from about 4,600 down to 2,300. On a national scale that is a
    // flat line next to Stockholm; on its own it is the story of the place.
    const { container } = draw('population', '2425')
    const d = container.querySelector('[data-segment]')!.getAttribute('d')!
    const ys = [...d.matchAll(/,([\d.]+)/g)].map((m) => Number(m[1]))
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(20)
  })

  it('has something to draw everywhere except the one pair SCB publishes nothing for', () => {
    // The component returns null when a series is wholly empty, and that branch was purely
    // defensive until plan 16: no municipality was missing an entire indicator.
    //
    // Bjurholm is now. It is Sweden's smallest municipality, at about 2,400 residents, and SCB
    // publishes no total fertility rate for it in any of the twenty-six years — too few births
    // for the measure to mean anything. That is SCB's own judgement, not a gap in this pipeline,
    // and the honest thing is to name it rather than loosen the assertion to "mostly".
    //
    // Listing the exceptions keeps the guarantee: a second one appearing still fails here.
    const empty: string[] = []
    for (const indicator of lk.data.indicators) {
      for (const m of lk.data.municipalities) {
        if (segmentsFor(lk, indicator.id, m.code).length === 0)
          empty.push(`${indicator.id}/${m.code}`)
      }
    }
    expect(empty).toEqual(['fertility-rate/2403'])
  })
})
