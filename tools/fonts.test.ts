import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * The typefaces, and the promise the README makes about them.
 *
 * "No server, no runtime API, no tracking" is only true while every byte the browser fetches
 * comes from this origin. A font CDN is the easiest way to break that by accident — one `<link>`
 * and every page view tells somebody else who is reading.
 */

const root = new URL('../', import.meta.url)
const read = (path: string) => readFileSync(new URL(path, root), 'utf8')
const fontsDir = new URL('public/fonts/', root)

describe('the fonts', () => {
  it('are all present, as the stylesheet declares them', () => {
    const css = read('src/styles/fonts.css')
    const declared = [...css.matchAll(/url\('\/fonts\/([^']+)'\)/g)].map((m) => m[1]!)
    expect(declared.length).toBeGreaterThan(0)
    for (const file of declared) {
      expect(existsSync(new URL(file, fontsDir)), `public/fonts/${file}`).toBe(true)
    }
  })

  it('fit the budget Plan 10 set', () => {
    // 120 kB for every face together. Over it, `tools/build-fonts.mjs` fails rather than quietly
    // costing a visitor on a slow connection a second of blank page.
    const total = readdirSync(fontsDir)
      .filter((f) => f.endsWith('.woff2'))
      .reduce((sum, f) => sum + statSync(new URL(f, fontsDir)).size, 0)
    expect(total).toBeLessThanOrEqual(120 * 1024)
  })

  it('carry the licence the OFL requires to travel with them', () => {
    // SIL OFL 1.1 permits redistribution only with the licence included. Shipping the files
    // without it is a licence breach, not an oversight.
    for (const file of ['newsreader-OFL.txt', 'ibm-plex-OFL.txt']) {
      const text = readFileSync(new URL(file, fontsDir), 'utf8')
      expect(text, file).toContain('SIL OPEN FONT LICENSE Version 1.1')
    }
  })
})

describe('nothing is fetched from a third party', () => {
  const cssFiles = readdirSync(new URL('src/styles/', root)).filter((f) => f.endsWith('.css'))

  it.each(cssFiles)('%s loads no remote font or stylesheet', (file) => {
    const css = read(`src/styles/${file}`)
    expect(css).not.toMatch(/url\(\s*['"]?https?:/i)
    expect(css).not.toMatch(/@import\s+url\(\s*['"]?https?:/i)
  })

  it.each(['index.html', 'sv/index.html', 'en/index.html', 'public/404.html'])(
    '%s links no remote stylesheet',
    (file) => {
      const html = read(file)
      const links = [...html.matchAll(/<link[^>]*>/g)].map((m) => m[0])
      const remote = links.filter(
        (tag) => /rel="(stylesheet|preconnect)"/.test(tag) && /href="https?:/.test(tag),
      )
      expect(remote).toEqual([])
    },
  )
})
