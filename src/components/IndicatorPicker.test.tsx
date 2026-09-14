import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import rawData from '../../public/pantry/data/indicators.json'
import { PantryData } from '../../shared/pantry'
import { lookup } from '../data/select'
import { IndicatorPicker } from './IndicatorPicker'

const lk = lookup(PantryData.parse(rawData))

const draw = (selected = 'population', lang: 'sv' | 'en' = 'en') => {
  const onChange = vi.fn()
  const result = render(
    <IndicatorPicker lk={lk} selected={selected} lang={lang} onChange={onChange} />,
  )
  return { onChange, ...result }
}

describe('IndicatorPicker', () => {
  it('is a named group of ten radios', () => {
    draw()
    expect(screen.getByRole('group', { name: 'Measure' })).toBeTruthy()
    expect(screen.getAllByRole('radio')).toHaveLength(10)
  })

  it('checks exactly the one the URL says', () => {
    draw('house-prices')
    const checked = screen.getAllByRole('radio').filter((r) => (r as HTMLInputElement).checked)
    expect(checked).toHaveLength(1)
    expect(screen.getByRole('radio', { name: 'House prices' })).toBe(checked[0])
  })

  it('reports the new indicator when one is chosen', async () => {
    const { onChange } = draw()
    await userEvent.click(screen.getByRole('radio', { name: 'Mean age' }))
    expect(onChange).toHaveBeenCalledWith('mean-age')
  })

  it('names every indicator in Swedish too', () => {
    draw('population', 'sv')
    expect(screen.getByRole('group', { name: 'Mått' })).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'Medelålder' })).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'Småhuspriser' })).toBeTruthy()
  })
})
