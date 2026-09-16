import { useCallback, useState } from 'react'
import { useMediaQuery } from './useMediaQuery'

/**
 * Which theme the page is in, and how a visitor changes it.
 *
 * There are three situations, not two, and `src/styles/tokens.css` has a block for each:
 *
 *   1. No choice stored and no system preference — **light**, the standard.
 *   2. No choice stored and a system that asks for dark — dark.
 *   3. A choice stored — that choice, whatever the system says.
 *
 * The choice lives on `data-theme` on the root element, which is the same attribute the CSS
 * keys off, so there is exactly one source of truth and no way for the two to disagree.
 *
 * Nothing here throws. Storage is unavailable in a private window, and can be blocked outright;
 * either way that is a visitor with no stored choice, which is a state the page already handles.
 */

export type Theme = 'light' | 'dark'

export const THEME_KEY = 'atlas-theme'
export const DARK_QUERY = '(prefers-color-scheme: dark)'

const isTheme = (value: unknown): value is Theme => value === 'light' || value === 'dark'

/** The stored choice, or null where there is none — including when storage itself is unusable. */
export function storedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(THEME_KEY)
    return isTheme(value) ? value : null
  } catch {
    return null
  }
}

/** Remembers the choice if it can. A failure here costs the next visit, not this one. */
export function storeTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    // Nothing useful to do, and nothing broken: the attribute below still applies.
  }
}

/** Writes the choice where the stylesheet reads it. */
export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme)
}

/**
 * The theme, and a way to change it.
 *
 * The explicit choice is React state so a toggle re-renders the label; the system preference
 * comes from `useMediaQuery`, so a visitor who changes their system setting while the page is
 * open — and who has expressed no choice of their own — follows along.
 */
export function useTheme(): { theme: Theme; setTheme: (theme: Theme) => void } {
  const [chosen, setChosen] = useState<Theme | null>(() => storedTheme())
  const systemDark = useMediaQuery(DARK_QUERY)
  const theme: Theme = chosen ?? (systemDark ? 'dark' : 'light')

  const setTheme = useCallback((next: Theme) => {
    applyTheme(next)
    storeTheme(next)
    setChosen(next)
  }, [])

  return { theme, setTheme }
}
