import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { lookup } from '../data/select'
import { IndicatorPicker } from './IndicatorPicker'
import { publishedPantry } from '../test/pantry'

const lk = lookup(publishedPantry)

const draw = (selected = 'population', lang: 'sv' | 'en' = 'en') => {
  const onChange = vi.fn()
  const result = render(
    <IndicatorPicker lk={lk} selected={selected} lang={lang} onChange={onChange} />,
  )
  return { onChange, ...result }
}

describe('IndicatorPicker', () => {
  it('is a labelled select of ten indicators', () => {
    draw()
    const select = screen.getByRole('combobox', { name: 'Measure' })
    expect(select).toBeTruthy()
    expect(screen.getAllByRole('option')).toHaveLength(10)
  })

  it('shows exactly the one the URL says', () => {
    draw('house-prices')
    const select = screen.getByRole('combobox', { name: 'Measure' }) as HTMLSelectElement
    expect(select.value).toBe('house-prices')
    const selected = screen.getAllByRole('option').filter((o) => (o as HTMLOptionElement).selected)
    expect(selected).toHaveLength(1)
    expect((selected[0] as HTMLOptionElement).textContent).toBe('House prices')
  })

  it('reports the new indicator when one is chosen', async () => {
    const { onChange } = draw()
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Measure' }), 'mean-age')
    expect(onChange).toHaveBeenCalledWith('mean-age')
  })

  it('carries the indicator id as the value, not its name', () => {
    // The id is what goes in the URL. Reading the visible name back out of the control would
    // put "Mean age" in the address bar, and break the moment the page is in Swedish.
    draw()
    const options = screen.getAllByRole('option') as HTMLOptionElement[]
    expect(options.map((o) => o.value)).toEqual(lk.data.indicators.map((i) => i.id))
  })

  it('names every indicator in Swedish too', () => {
    draw('population', 'sv')
    expect(screen.getByRole('combobox', { name: 'Mått' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'Medelålder' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'Småhuspriser' })).toBeTruthy()
  })

  it('ties the label to the control, so the name is not guessed from proximity', () => {
    // getByRole with a name would also pass on an aria-label or on nothing at all in some
    // engines; this asserts the actual for/id pair a screen reader follows.
    const { container } = draw()
    const label = container.querySelector('label')!
    const select = container.querySelector('select')!
    expect(label.getAttribute('for')).toBe(select.id)
    expect(select.id).not.toBe('')
  })

  it('lists the indicators in the pantry’s own order', () => {
    draw()
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(
      lk.data.indicators.map((i) => i.name.en),
    )
  })
})
