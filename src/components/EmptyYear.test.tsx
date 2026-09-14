import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import rawData from '../../public/pantry/data/indicators.json'
import { PantryData } from '../../shared/pantry'
import { lookup } from '../data/select'
import { EmptyYear } from './EmptyYear'

const lk = lookup(PantryData.parse(rawData))

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
