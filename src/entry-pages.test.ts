import { describe, expect, it } from 'vitest'
import svHtml from '../sv/index.html?raw'
import enHtml from '../en/index.html?raw'
import rootHtml from '../index.html?raw'

/**
 * The language lives in the path, not in a query parameter, so that Plan 5 can pre-render a
 * genuinely Swedish page and a genuinely English page — each with the right `lang` on the very
 * first byte, before any JavaScript runs. These assertions are about the shipped HTML shape.
 *
 * The files arrive through Vite's `?raw` import rather than `node:fs` on purpose: everything
 * under `src/` compiles against `tsconfig.app.json`, which has no Node types, because site code
 * must never reach for the filesystem. A repo-shape test is not a reason to put a hole in that.
 */
const PAGES: Record<string, string> = { sv: svHtml, en: enHtml }
const page = (lang: string) => PAGES[lang]!

describe('the two language entry pages', () => {
  it.each([
    ['sv', 'Sveriges'],
    ['en', 'Sweden'],
  ])('%s/index.html declares its own language and loads the app', (lang, inTitle) => {
    const html = page(lang)
    expect(html).toContain(`<html lang="${lang}">`)
    expect(html).toMatch(new RegExp(`<title>[^<]*${inTitle}[^<]*</title>`))
    expect(html).toContain('<script type="module" src="/src/main.tsx"></script>')
  })

  it.each(['sv', 'en'])('%s/index.html carries a description in its own language', (lang) => {
    // Whitespace-tolerant: Prettier wraps a long meta tag across lines, and where the
    // attribute breaks is not something worth asserting.
    expect(page(lang)).toMatch(/<meta\s+name="description"\s+content="[^"]{20,}"/)
  })

  it.each([
    ['sv', 'en'],
    ['en', 'sv'],
  ])('%s/index.html points at itself and at %s with hreflang', (lang, other) => {
    const html = page(lang)
    expect(html).toContain(`<link rel="alternate" hreflang="${lang}" href="/${lang}/"`)
    expect(html).toContain(`<link rel="alternate" hreflang="${other}" href="/${other}/"`)
  })

  it('the two pages differ in more than their lang attribute', () => {
    // A copy-paste that forgot to translate would pass every assertion above.
    const [sv, en] = [page('sv'), page('en')]
    expect(sv.replace(/lang="sv"|hreflang="sv"|href="\/sv\/"/g, '')).not.toBe(
      en.replace(/lang="en"|hreflang="en"|href="\/en\/"/g, ''),
    )
  })
})

describe('the root page', () => {
  const root = rootHtml

  it('offers both languages as real links, so it works without JavaScript', () => {
    expect(root).toMatch(/<a[^>]+href="\/sv\/"/)
    expect(root).toMatch(/<a[^>]+href="\/en\/"/)
  })

  it('redirects with replace, so the root never becomes a back-button trap', () => {
    expect(root).toContain('location.replace')
    expect(root).not.toMatch(/location\.href\s*=/)
  })

  it('carries the query string through the redirect', () => {
    expect(root).toContain('location.search')
  })

  it('does not load the application bundle', () => {
    // The picker is three lines of inline script. Pulling in 348 kB of React to choose a
    // language would defeat the point of having a static entry page at all.
    expect(root).not.toContain('/src/main.tsx')
  })
})

describe("the root page's language choice", () => {
  /**
   * Runs the real inline script out of the shipped HTML against stub globals, rather than a
   * copy of its logic kept in sync by hand. An earlier version of this script used
   * `languages.some(isSwedish)`, which sent a browser reporting ["en-GB", "sv-SE"] to the
   * Swedish page — `navigator.languages` is ordered by preference and `.some` throws that
   * ordering away. It passed every other assertion in this file.
   */
  const script = /<script>([\s\S]*?)<\/script>/.exec(rootHtml)![1]!

  const choose = (languages: string[], search = '', hash = '') => {
    let target = ''
    const fn = new Function('navigator', 'location', `${script.replace(/^\s*\/\/.*$/gm, '')}`) as (
      n: unknown,
      l: unknown,
    ) => void
    fn(
      { languages, language: languages[0] },
      {
        search,
        hash,
        replace: (url: string) => {
          target = url
        },
      },
    )
    return target
  }

  it.each([
    [['sv-SE'], '/sv/'],
    [['en-GB'], '/en/'],
    [['en-GB', 'sv-SE'], '/en/'],
    [['sv-SE', 'en-GB'], '/sv/'],
    [['sv'], '/sv/'],
    [['SV-se'], '/sv/'],
  ])('%j goes to %s', (languages, expected) => {
    expect(choose(languages as string[])).toBe(expected)
  })

  it('falls back to English for a language we do not publish', () => {
    expect(choose(['de-DE', 'fr-FR'])).toBe('/en/')
  })

  it('prefers a later Swedish entry over a language we do not publish at all', () => {
    expect(choose(['de-DE', 'sv-SE'])).toBe('/sv/')
  })

  it('carries the query and the hash through', () => {
    expect(choose(['sv-SE'], '?i=mean-age&y=2010', '#map')).toBe('/sv/?i=mean-age&y=2010#map')
  })
})
