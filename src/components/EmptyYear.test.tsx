import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { lookup } from '../data/select'
import { EmptyYear } from './EmptyYear'
import { pantryWithSparse, publishedPantry } from '../test/pantry'

const lk = lookup(publishedPantry)

describe('EmptyYear', () => {
  it('names the indicator and its real coverage', () => {
    render(<EmptyYear lk={lk} indicatorId="mean-age" year={1970} lang="en" onYear={() => {}} />)
    expect(screen.getByText(/Mean age is published for 1998–2025/)).toBeTruthy()
  })

  it('offers one click forward to the first covered year', async () => {
    const onYear = vi.fn()
    render(<EmptyYear lk={lk} indicatorId="mean-age" year={1970} lang="en" onYear={onYear} />)
    await userEvent.click(screen.getByRole('button', { name: 'Go to 1998' }))
    expect(onYear).toHaveBeenCalledWith(1998)
  })

  it('offers one click back when the year is past the end instead', async () => {
    const onYear = vi.fn()
    // Median income stops in 2024 while the axis runs to 2026, so the nearest covered year is
    // behind rather than ahead. Always jumping to the first year would go the wrong way.
    render(<EmptyYear lk={lk} indicatorId="median-income" year={2026} lang="en" onYear={onYear} />)
    await userEvent.click(screen.getByRole('button', { name: 'Go to 2024' }))
    expect(onYear).toHaveBeenCalledWith(2024)
  })

  it('speaks Swedish too', () => {
    render(<EmptyYear lk={lk} indicatorId="mean-age" year={1970} lang="sv" onYear={() => {}} />)
    expect(screen.getByText(/Medelålder publiceras för 1998–2025/)).toBeTruthy()
  })
})

/**
 * Plan 19. For a sparse indicator the empty year is usually INSIDE the range, and the sentence
 * that names a range would be true and useless — "published for 1973–2022" tells a visitor
 * looking at an empty 1974 nothing about why.
 */
describe('EmptyYear, a sparse indicator', () => {
  const sparseLk = lookup(pantryWithSparse([2015, 2020]))

  it('names the years it has rather than the span they sit in', () => {
    render(
      <EmptyYear
        lk={sparseLk}
        indicatorId="fabricated-sparse"
        year={2017}
        lang="en"
        onYear={vi.fn()}
      />,
    )
    expect(
      screen.getByText(/Fabricated sparse measure is published for 2015 and 2020/),
    ).toBeTruthy()
  })

  it('jumps into the gap toward the nearer value, not to the edge of the range', async () => {
    const onYear = vi.fn()
    render(
      <EmptyYear
        lk={sparseLk}
        indicatorId="fabricated-sparse"
        year={2019}
        lang="en"
        onYear={onYear}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Go to 2020' }))
    expect(onYear).toHaveBeenCalledWith(2020)
  })

  it('speaks Swedish too', () => {
    render(
      <EmptyYear
        lk={sparseLk}
        indicatorId="fabricated-sparse"
        year={2017}
        lang="sv"
        onYear={vi.fn()}
      />,
    )
    expect(screen.getByText(/Påhittat glest mått publiceras för 2015 och 2020/)).toBeTruthy()
  })
})
