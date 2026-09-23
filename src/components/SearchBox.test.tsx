import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SearchBox } from './SearchBox'
import { publishedPantry } from '../test/pantry'

const { municipalities } = publishedPantry

const draw = (lang: 'sv' | 'en' = 'en') => {
  const onSelect = vi.fn()
  const result = render(
    <SearchBox municipalities={municipalities} lang={lang} onSelect={onSelect} />,
  )
  return { onSelect, ...result }
}

const box = () => screen.getByRole('combobox')

describe('SearchBox', () => {
  it('has a real label, not just a placeholder', () => {
    draw()
    expect(screen.getByRole('combobox', { name: /search municipalities/i })).toBeTruthy()
  })

  it('starts collapsed and lists nothing', () => {
    draw()
    expect(box().getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryAllByRole('option')).toHaveLength(0)
  })

  it('opens and offers matches as you type', async () => {
    draw()
    await userEvent.type(box(), 'malmo')
    expect(box().getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('option', { name: 'Malmö' })).toBeTruthy()
  })

  it('says how many matches there are, in a region a screen reader will hear', async () => {
    draw()
    await userEvent.type(box(), 'upplands')
    expect(screen.getByRole('status').textContent).toBe('2 matches')
  })

  it('says when nothing matches', async () => {
    draw()
    await userEvent.type(box(), 'zzzz')
    expect(screen.getByRole('status').textContent).toMatch(/no municipality matches/i)
  })

  it('tracks the active option without moving focus off the text field', async () => {
    draw()
    await userEvent.type(box(), 'upplands')
    expect(document.activeElement).toBe(box())
    await userEvent.keyboard('{ArrowDown}')
    expect(document.activeElement).toBe(box())
    const active = box().getAttribute('aria-activedescendant')
    expect(screen.getByRole('option', { selected: true }).id).toBe(active)
  })

  it('wraps around the ends of the list', async () => {
    draw()
    await userEvent.type(box(), 'upplands')
    await userEvent.keyboard('{ArrowUp}')
    expect(screen.getByRole('option', { selected: true }).textContent).toBe('Upplands-Bro')
  })

  it('selects the active option with Enter', async () => {
    const { onSelect } = draw()
    await userEvent.type(box(), 'malmo{Enter}')
    expect(onSelect).toHaveBeenCalledWith('1280')
  })

  it('selects with the pointer too', async () => {
    const { onSelect } = draw()
    await userEvent.type(box(), 'kiruna')
    await userEvent.click(screen.getByRole('option', { name: 'Kiruna' }))
    expect(onSelect).toHaveBeenCalledWith('2584')
  })

  it('closes on Escape and keeps what was typed, then clears on a second Escape', async () => {
    draw()
    await userEvent.type(box(), 'malmo')
    await userEvent.keyboard('{Escape}')
    expect(box().getAttribute('aria-expanded')).toBe('false')
    expect((box() as HTMLInputElement).value).toBe('malmo')
    await userEvent.keyboard('{Escape}')
    expect((box() as HTMLInputElement).value).toBe('')
  })

  it('finds a municipality by code', async () => {
    const { onSelect } = draw()
    await userEvent.type(box(), '2584{Enter}')
    expect(onSelect).toHaveBeenCalledWith('2584')
  })

  it('works the same in Swedish', async () => {
    const { onSelect } = draw('sv')
    expect(screen.getByRole('combobox', { name: /sök kommun/i })).toBeTruthy()
    await userEvent.type(box(), 'ostersund{Enter}')
    expect(onSelect).toHaveBeenCalledWith('2380')
  })
})
