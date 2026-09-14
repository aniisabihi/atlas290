import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

/**
 * Testing Library only auto-cleans when vitest runs with globals enabled, which this repo does
 * not do. Without this, one test's DOM survives into the next and `getByRole` starts finding two
 * of everything — a failure that reads like a component bug and is not one.
 */
afterEach(cleanup)

/**
 * jsdom implements no media queries at all, so anything reading `prefers-reduced-motion` or
 * `prefers-color-scheme` throws rather than returning a default. The stub answers "no" to every
 * query; a test that cares calls `stubMediaQuery` to say otherwise.
 */
const listeners = new Set<MediaQueryList>()
let matching: string[] = []

function makeList(query: string): MediaQueryList {
  const list: MediaQueryList = {
    media: query,
    matches: matching.includes(query),
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }
  listeners.add(list)
  return list
}

vi.stubGlobal(
  'matchMedia',
  vi.fn((query: string) => makeList(query)),
)

/** Makes the named media queries match for the rest of the test. */
export function stubMediaQuery(...queries: string[]): void {
  matching = queries
}

afterEach(() => {
  matching = []
  listeners.clear()
})
