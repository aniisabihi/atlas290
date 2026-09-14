import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import rawData from '../../public/pantry/data/indicators.json'
import { PantryData } from '../../shared/pantry'
import { lookup } from '../data/select'
import { metaFrom } from '../state/url'
import { YearSlider } from './YearSlider'

const data = PantryData.parse(rawData)
const lk = lookup(data)
const meta = metaFrom(data)

const draw = (over: Partial<Parameters<typeof YearSlider>[0]> = {}) => {
  const onYear = vi.fn()
  const onPlayingChange = vi.fn()
  const result = render(
    <YearSlider
      lk={lk}
      meta={meta}
      indicatorId="population"
      year={2000}
      lang="en"
      playing={false}
      onYear={onYear}
      onPlayingChange={onPlayingChange}
      {...over}
    />,
  )
  return { onYear, onPlayingChange, ...result }
}

const slider = () => screen.getByRole('slider')

describe('YearSlider', () => {
  it('spans the whole axis whatever indicator is chosen', () => {
    // The axis is 1968-2026 because municipal tax rates are set a year ahead. Ragged coverage is
    // a fact about the data, and showing it is more useful than hiding it.
    draw({ indicatorId: 'mean-age' })
    expect(slider().getAttribute('min')).toBe('1968')
    expect(slider().getAttribute('max')).toBe('2026')
  })

  it('has an accessible name and reports the year as text, not just a number', () => {
    draw()
    expect(screen.getByRole('slider', { name: /year/i })).toBeTruthy()
    expect(slider().getAttribute('aria-valuetext')).toBe('2000')
  })

  it('says why a year is empty in the value text, where a screen reader will reach it', () => {
    draw({ indicatorId: 'mean-age', year: 1970 })
    expect(slider().getAttribute('aria-valuetext')).toMatch(
      /1970.*Mean age is published for 1998–2025.*nothing to show/i,
    )
  })

  it('reports a new year when dragged', () => {
    // fireEvent rather than userEvent: jsdom does not implement a range input's native
    // arrow-key or pointer-drag behaviour, so userEvent can move focus to the slider but can
    // never change its value. Driving the change event directly is the honest way to test the
    // handler; that the browser's own slider works is the browser's business.
    const { onYear } = draw()
    fireEvent.change(slider(), { target: { value: '2001' } })
    expect(onYear).toHaveBeenCalledWith(2001)
  })

  it('dims the years the current indicator does not cover', () => {
    const { container } = draw({ indicatorId: 'mean-age' })
    const ticks = container.querySelectorAll('[data-year-tick]')
    expect(ticks).toHaveLength(59)
    const uncovered = [...ticks].filter((t) => t.getAttribute('data-covered') === 'false')
    // Mean age runs 1998-2025: thirty years before it, and 2026 after.
    expect(uncovered).toHaveLength(31)
  })

  it('hides the tick strip from assistive technology, which already has the value text', () => {
    const { container } = draw()
    expect(container.querySelector('[data-year-ticks]')?.getAttribute('aria-hidden')).toBe('true')
  })
})

describe('YearSlider play', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }))
  afterEach(() => vi.useRealTimers())

  it('offers play when stopped and pause when running', () => {
    const { rerender } = draw()
    expect(screen.getByRole('button', { name: 'Play' })).toBeTruthy()
    rerender(
      <YearSlider
        lk={lk}
        meta={meta}
        indicatorId="population"
        year={2000}
        lang="en"
        playing
        onYear={() => {}}
        onPlayingChange={() => {}}
      />,
    )
    expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy()
  })

  it('advances a year at a time while playing', () => {
    const { onYear } = draw({ playing: true })
    vi.advanceTimersByTime(1000)
    expect(onYear).toHaveBeenCalledWith(2001, true)
  })

  it('marks a played step as one that should not add a history entry', () => {
    // Playing from 1968 to 2026 would otherwise leave 58 entries behind it, and what a visitor
    // wants the back button to reach is wherever they were before they pressed play.
    const { onYear } = draw({ playing: true })
    vi.advanceTimersByTime(1000)
    expect(onYear.mock.calls[0]?.[1]).toBe(true)
  })

  it('does not mark a dragged year that way, since that is a deliberate move', () => {
    const { onYear } = draw()
    fireEvent.change(slider(), { target: { value: '2001' } })
    expect(onYear.mock.calls[0]?.[1]).toBeUndefined()
  })

  it('stops at the end of the axis rather than running past it', () => {
    const { onYear, onPlayingChange } = draw({ playing: true, year: 2026 })
    vi.advanceTimersByTime(3000)
    expect(onYear).not.toHaveBeenCalled()
    expect(onPlayingChange).toHaveBeenCalledWith(false)
  })

  it('stops playing when the visitor takes hold of the slider', () => {
    const { onPlayingChange } = draw({ playing: true })
    fireEvent.change(slider(), { target: { value: '1990' } })
    expect(onPlayingChange).toHaveBeenCalledWith(false)
  })
})

describe('YearSlider motion', () => {
  it('lets the map ease between years by default', () => {
    const { container } = draw()
    expect(container.querySelector('[data-animate="true"]')).not.toBeNull()
  })

  it('steps instead of easing when the visitor asked for less movement', async () => {
    const { stubMediaQuery } = await import('../test-setup')
    stubMediaQuery('(prefers-reduced-motion: reduce)')
    const { container } = draw()
    expect(container.querySelector('[data-animate="false"]')).not.toBeNull()
  })
})
