import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { metaFrom, type AppState } from '../state/url'
import { LanguageSwitch } from './LanguageSwitch'
import { publishedPantry } from '../test/pantry'

const meta = metaFrom(publishedPantry)
const state: AppState = {
  lang: 'sv',
  indicator: 'house-prices',
  year: 1990,
  selected: '1280',
  compare: null,
  view: null,
  table: false,
}

describe('LanguageSwitch', () => {
  it('is an anchor, so it works without JavaScript and behaves like a page change', () => {
    render(<LanguageSwitch state={state} meta={meta} />)
    const link = screen.getByRole('link')
    expect(link.tagName).toBe('A')
    expect(link.getAttribute('href')).toBe('/en/malmo-1280/?i=house-prices&y=1990')
  })

  it('carries the whole current view across, so nobody loses their place', () => {
    render(<LanguageSwitch state={state} meta={meta} />)
    const href = screen.getByRole('link').getAttribute('href')!
    expect(href).toContain('i=house-prices')
    expect(href).toContain('y=1990')
    // The selection lives in the path now, not in a query key (Plan 9).
    expect(href).toContain('malmo-1280')
  })

  it('goes back the other way from English', () => {
    render(<LanguageSwitch state={{ ...state, lang: 'en' }} meta={meta} />)
    expect(screen.getByRole('link').getAttribute('href')).toBe(
      '/sv/malmo-1280/?i=house-prices&y=1990',
    )
  })

  it('marks the link with the language it leads to, for a screen reader that switches voice', () => {
    render(<LanguageSwitch state={state} meta={meta} />)
    const link = screen.getByRole('link')
    expect(link.getAttribute('hreflang')).toBe('en')
    expect(link.getAttribute('lang')).toBe('en')
    expect(link.textContent).toBe('English')
  })

  it('starts its accessible name with the words a visitor can see', () => {
    // WCAG 2.5.3, Label in Name: someone using voice control says what is on screen. If the link
    // reads "English" and its accessible name is only "byt språk till engelska", saying "click
    // English" does nothing. Found by Lighthouse; axe's WCAG rule set did not flag it.
    render(<LanguageSwitch state={state} meta={meta} />)
    const link = screen.getByRole('link', { name: 'English — byt språk till engelska' })
    expect(link.textContent).toBe('English')
    expect(link.getAttribute('aria-label')!.startsWith(link.textContent!)).toBe(true)
  })
})
