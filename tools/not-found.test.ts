import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * The contract with Cloudflare Pages, checked offline.
 *
 * This is the test that was missing. `e2e/municipality-pages.spec.ts` asserted that an unknown
 * municipality 404s, and it passed — against `vite preview`, whose behaviour came from a
 * middleware written to match what production was ASSUMED to do. Production disagreed: with no
 * top-level `404.html`, Pages treats the site as a single-page application and answers 200 with
 * the root page for every unmatched path.
 *
 * So this asserts the property Cloudflare actually reads, in the place it actually reads it,
 * rather than asserting the behaviour of a server we wrote ourselves.
 */

const file = new URL('../public/404.html', import.meta.url)
// Read lazily and only where it exists, so a missing file fails as a readable assertion below
// rather than as an ENOENT while the module is still being imported.
const page = existsSync(file) ? readFileSync(file, 'utf8') : ''

describe('the 404 page', () => {
  it('exists in public/, which is what puts it at the root of the build', () => {
    // `publicDir: 'public'` copies this verbatim to `dist/404.html`. Cloudflare looks up the
    // directory tree "ending in /404.html" — so the root copy covers every path on the site.
    // Delete this file and the site silently answers 200 with the front page for every wrong
    // address; that is not a hypothetical, it is what production did until 2026-09-16.
    expect(existsSync(file), 'public/404.html is missing').toBe(true)
    expect(page).toContain('<!doctype html>')
    expect(page).toContain('</html>')
  })

  it('carries no script at all', () => {
    // The root page redirects to the visitor's language. If this one did the same, a mistyped
    // address would bounce straight to the front page and look like a working link — which is
    // precisely the bug a whole plan was spent removing.
    expect(page).not.toContain('<script')
    expect(page).not.toContain('location.replace')
  })

  it('speaks both languages, because a path that matched nothing names no language', () => {
    expect(page).toContain('Sidan finns inte')
    expect(page).toContain('Page not found')
    expect(page).toContain('href="/sv/"')
    expect(page).toContain('href="/en/"')
  })

  it('asks not to be indexed', () => {
    // Every unmatched URL serves this one document. Without this, a crawler can index an
    // unbounded number of distinct addresses that all show the same page.
    expect(page).toContain('name="robots" content="noindex"')
  })
})
