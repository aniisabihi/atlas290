import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import rawData from '../../public/pantry/data/indicators.json'
import { PantryData } from '../../shared/pantry'
import { metaFrom, type AppState } from '../state/url'
import { LanguageSwitch } from './LanguageSwitch'

const meta = metaFrom(PantryData.parse(rawData))
const state: AppState = { lang: 'sv', indicator: 'house-prices', year: 1990, selected: '1280' }

describe('LanguageSwitch', () => {
  it('is an anchor, so it works without JavaScript and behaves like a page change', () => {
    render(<LanguageSwitch state={state} meta={meta} />)
    const link = screen.getByRole('link')
    expect(link.tagName).toBe('A')
    expect(link.getAttribute('href')).toBe('/en/?i=house-prices&y=1990&m=1280')
  })

  it('carries the whole current view across, so nobody loses their place', () => {
    render(<LanguageSwitch state={state} meta={meta} />)
    const href = screen.getByRole('link').getAttribute('href')!
    expect(href).toContain('i=house-prices')
    expect(href).toContain('y=1990')
    expect(href).toContain('m=1280')
  })

  it('goes back the other way from English', () => {
    render(<LanguageSwitch state={{ ...state, lang: 'en' }} meta={meta} />)
    expect(screen.getByRole('link').getAttribute('href')).toBe('/sv/?i=house-prices&y=1990&m=1280')
  })

  it('marks the link with the language it leads to, for a screen reader that switches voice', () => {
    render(<LanguageSwitch state={state} meta={meta} />)
    const link = screen.getByRole('link')
    expect(link.getAttribute('hreflang')).toBe('en')
    expect(link.getAttribute('lang')).toBe('en')
    expect(link.textContent).toBe('English')
  })

  it('names what it does rather than leaving the language name to speak for itself', () => {
    render(<LanguageSwitch state={state} meta={meta} />)
    expect(screen.getByRole('link', { name: 'Byt språk till engelska' })).toBeTruthy()
  })
})
