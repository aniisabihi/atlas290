import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { stubMediaQuery } from '../test-setup'
import { DARK_QUERY, storedTheme, THEME_KEY, useTheme } from './theme'

/**
 * The three states a visitor can be in. Light is the standard: nothing stored and nothing asked
 * for gives the light page, which is a deliberate change from the site's dark-first past.
 */

afterEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
  vi.restoreAllMocks()
})

describe('which theme applies', () => {
  it('is light when nothing is stored and nothing is preferred', () => {
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('light')
  })

  it('is dark when the system asks and the visitor has not chosen', () => {
    stubMediaQuery(DARK_QUERY)
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('dark')
  })

  it('lets a stored light choice beat a dark system', () => {
    // The case the old two-state stylesheet could not express at all.
    stubMediaQuery(DARK_QUERY)
    localStorage.setItem(THEME_KEY, 'light')
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('light')
  })

  it('lets a stored dark choice beat a light system', () => {
    localStorage.setItem(THEME_KEY, 'dark')
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('dark')
  })

  it('ignores a stored value that is not a theme', () => {
    localStorage.setItem(THEME_KEY, 'aubergine')
    expect(storedTheme()).toBeNull()
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('light')
  })
})

describe('choosing', () => {
  it('writes the attribute the stylesheet reads, and remembers it', () => {
    const { result } = renderHook(() => useTheme())
    act(() => {
      result.current.setTheme('dark')
    })
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(localStorage.getItem(THEME_KEY)).toBe('dark')
    expect(result.current.theme).toBe('dark')
  })

  it('still applies the choice when storage refuses to keep it', () => {
    // A private window, or site data blocked outright. The visitor loses the memory of the
    // choice, not the choice itself.
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied')
    })
    const { result } = renderHook(() => useTheme())
    expect(() =>
      act(() => {
        result.current.setTheme('dark')
      }),
    ).not.toThrow()
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(result.current.theme).toBe('dark')
  })

  it('reads as no choice at all when storage cannot be read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    expect(storedTheme()).toBeNull()
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('light')
  })
})
