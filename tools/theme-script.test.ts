import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * The script that applies a stored theme choice before the first paint.
 *
 * Without it the page paints light, then swaps to dark the moment the bundle boots — a flash on
 * every visit for everyone who chose dark. It has to be inline in the head, and it has to use the
 * same storage key as `src/state/theme.ts`, which is the invariant these assertions exist for:
 * the constant and the literal live in different files and nothing but a test keeps them equal.
 */

const root = new URL('../', import.meta.url)
const read = (path: string) => readFileSync(new URL(path, root), 'utf8')

const themeModule = read('src/state/theme.ts')
const KEY = /THEME_KEY = '([^']+)'/.exec(themeModule)?.[1]

const ENTRY_PAGES = ['index.html', 'sv/index.html', 'en/index.html']

describe('the pre-paint theme script', () => {
  it('has a key to check against', () => {
    expect(KEY, 'THEME_KEY not found in src/state/theme.ts').toBeTruthy()
  })

  it.each(ENTRY_PAGES)('%s reads the same storage key the application writes', (file) => {
    expect(read(file)).toContain(`localStorage.getItem('${KEY}')`)
  })

  it.each(ENTRY_PAGES)('%s applies it in the head, before anything renders', (file) => {
    // In the head, not at the end of the body: the point is to beat the first paint. The root
    // page carries no bundle at all — it is the language picker — so `</head>` is the boundary
    // that means the same thing on all three.
    const html = read(file)
    expect(html).toContain("setAttribute('data-theme'")
    expect(html.indexOf("setAttribute('data-theme'")).toBeLessThan(html.indexOf('</head>'))
  })

  it.each(ENTRY_PAGES)('%s trusts only the two real values', (file) => {
    // A stale or hand-edited value must not become an attribute the stylesheet half-matches.
    const html = read(file)
    expect(html).toMatch(/t === 'dark' \|\| t === 'light'/)
  })

  it.each(ENTRY_PAGES)('%s survives storage being unavailable', (file) => {
    // Reading localStorage throws outright in some privacy modes; unguarded, that kills the
    // script and everything after it in the head.
    expect(read(file)).toMatch(/try\s*\{[\s\S]*localStorage[\s\S]*\}\s*catch/)
  })
})
