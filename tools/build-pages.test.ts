import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import rawData from '../public/pantry/data/indicators.json'
import { PantryData } from '../shared/pantry'
import { segmentFor } from '../shared/slug'
import {
  cspFor,
  entryPageFor,
  headersFor,
  inlineScriptHashes,
  pageFor,
  robotsFor,
  sitemapFor,
} from './build-pages.mjs'

const data = PantryData.parse(rawData)

/** The real built entry page, so these test the shape that actually ships. */
const entry = readFileSync(new URL('../en/index.html', import.meta.url), 'utf8')
const malmo = data.municipalities.find((m) => m.code === '1280')!

const render = (over: Partial<{ lang: string; name: string; code: string }> = {}) =>
  pageFor(entry, { lang: 'en', name: malmo.name.en, code: malmo.code, ...over })

describe('pageFor', () => {
  const html = render()

  it('gives the page the municipality’s own title', () => {
    expect(html).toContain('<title>Malmö · Atlas 290</title>')
  })

  it('replaces the site description rather than adding a second one', () => {
    // Two <title> or two description tags is not an error a browser reports — it quietly uses
    // one, and a crawler may use the other.
    expect(html.match(/<title>/g)).toHaveLength(1)
    expect(html.match(/name="description"/g)).toHaveLength(1)
    expect(html).toContain('Malmö in ten measures')
  })

  it('names itself canonical and points at both languages', () => {
    expect(html).toContain('<link rel="canonical" href="/en/malmo-1280/" />')
    expect(html).toContain('hreflang="sv" href="/sv/malmo-1280/"')
    expect(html).toContain('hreflang="en" href="/en/malmo-1280/"')
  })

  it('replaces the site-wide alternates rather than leaving both sets', () => {
    expect(html.match(/rel="alternate"/g)).toHaveLength(2)
    expect(html).not.toContain('hreflang="x-default"')
  })

  it('carries the preview card and its dimensions', () => {
    expect(html).toContain('<meta property="og:image" content="/share/1280.png" />')
    expect(html).toContain('og:image:width" content="1200"')
    expect(html).toContain('og:image:height" content="630"')
    expect(html).toContain('name="twitter:card" content="summary_large_image"')
  })

  it('keeps the bundle the entry page loads', () => {
    // Every municipality page is the same application. If this ever stops being true the page
    // is a static document that looks right and does nothing.
    expect(html).toContain('src/main.tsx')
  })

  it('keeps the language the entry page declared', () => {
    expect(html).toContain('<html lang="en">')
    expect(
      pageFor(readFileSync(new URL('../sv/index.html', import.meta.url), 'utf8'), {
        lang: 'sv',
        name: malmo.name.sv,
        code: malmo.code,
      }),
    ).toContain('<html lang="sv">')
  })

  it('writes Swedish copy on the Swedish page', () => {
    const sv = pageFor(readFileSync(new URL('../sv/index.html', import.meta.url), 'utf8'), {
      lang: 'sv',
      name: malmo.name.sv,
      code: malmo.code,
    })
    expect(sv).toContain('i tio mått från SCB')
    expect(sv).toContain('og:locale" content="sv_SE"')
  })

  it('escapes a name that would otherwise break the attribute', () => {
    const nasty = render({ name: 'A "quoted" & <angled> place' })
    expect(nasty).toContain('&quot;quoted&quot;')
    expect(nasty).toContain('&amp;')
    expect(nasty).not.toMatch(/content="[^"]*"quoted"/)
  })

  it('refuses a language it has no copy for, rather than writing an English page', () => {
    expect(() => render({ lang: 'de' })).toThrow(/no copy for language 'de'/)
  })

  it('throws if the entry page changed shape and nothing was rewritten', () => {
    expect(() =>
      pageFor('<html><body>nothing here</body></html>', {
        lang: 'en',
        name: 'Malmö',
        code: '1280',
      }),
    ).toThrow(/nothing was rewritten/)
  })
})

describe('across all 290', () => {
  it('gives every municipality a page that names it', () => {
    for (const m of data.municipalities) {
      const html = pageFor(entry, { lang: 'en', name: m.name.en, code: m.code })
      const segment = segmentFor(m.name.en, m.code)
      expect(html, m.code).toContain(`<link rel="canonical" href="/en/${segment}/" />`)
      expect(html, m.code).toContain(`content="/share/${m.code}.png"`)
      expect(html, m.code).toContain(m.name.en)
    }
  })

  it('names a card that exists on disk for every one of them', () => {
    // A preview pointing at a missing image is worse than none: the crawler shows a broken
    // card rather than falling back to text.
    for (const m of data.municipalities) {
      const read = () => readFileSync(new URL(`../public/share/${m.code}.png`, import.meta.url))
      expect(read, m.code).not.toThrow()
      expect(read().length, m.code).toBeGreaterThan(1000)
    }
  })
})

describe('with SITE_ORIGIN set', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  const withOrigin = (origin: string) => {
    vi.stubEnv('SITE_ORIGIN', origin)
    return render()
  }

  it('makes every tag a crawler follows absolute', () => {
    // The whole point of the variable. A crawler cannot resolve a root-relative og:image, so
    // without this a pasted link shows no card at all — the failure the cards were built for.
    const html = withOrigin('https://atlas290.pages.dev')
    expect(html).toContain('og:image" content="https://atlas290.pages.dev/share/1280.png"')
    expect(html).toContain('rel="canonical" href="https://atlas290.pages.dev/en/malmo-1280/"')
    expect(html).toContain('og:url" content="https://atlas290.pages.dev/en/malmo-1280/"')
    expect(html).toContain('hreflang="sv" href="https://atlas290.pages.dev/sv/malmo-1280/"')
  })

  it('does not double the slash when the origin carries one', () => {
    expect(withOrigin('https://atlas290.pages.dev/')).toContain(
      'content="https://atlas290.pages.dev/share/1280.png"',
    )
  })
})

describe('entryPageFor', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  const entrySv = readFileSync(new URL('../sv/index.html', import.meta.url), 'utf8')

  it('leaves the page alone when there is no origin', () => {
    // A local build has no domain and must not invent one. Unchanged, not almost unchanged.
    expect(entryPageFor(entrySv, '/sv/')).toBe(entrySv)
  })

  it('makes hreflang absolute, which is what the specification requires', () => {
    vi.stubEnv('SITE_ORIGIN', 'https://atlas290.pages.dev')
    const html = entryPageFor(entrySv, '/sv/')
    expect(html).toContain('hreflang="sv" href="https://atlas290.pages.dev/sv/"')
    expect(html).toContain('hreflang="en" href="https://atlas290.pages.dev/en/"')
    expect(html).toContain('hreflang="x-default" href="https://atlas290.pages.dev/"')
    expect(html).not.toMatch(/href="\/(sv|en)?\/?"/)
  })

  it('names itself canonical, exactly once', () => {
    vi.stubEnv('SITE_ORIGIN', 'https://atlas290.pages.dev')
    const once = entryPageFor(entrySv, '/sv/')
    expect(once.match(/rel="canonical"/g)).toHaveLength(1)
    // Running twice must not stack a second one, which is what a rebuild over a dirty dist does.
    expect(entryPageFor(once, '/sv/').match(/rel="canonical"/g)).toHaveLength(1)
    expect(once).toContain('rel="canonical" href="https://atlas290.pages.dev/sv/"')
  })
})

describe('sitemapFor', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  const withOrigin = () => {
    vi.stubEnv('SITE_ORIGIN', 'https://atlas290.pages.dev')
    return sitemapFor(data.municipalities)!
  }

  it('writes none without an origin, because a relative sitemap is invalid rather than lenient', () => {
    expect(sitemapFor(data.municipalities)).toBeNull()
  })

  it('lists both language roots and all 580 municipality pages', () => {
    const xml = withOrigin()
    expect(xml.match(/<loc>/g)).toHaveLength(2 + data.municipalities.length * 2)
    expect(xml).toContain('<loc>https://atlas290.pages.dev/sv/</loc>')
    expect(xml).toContain('<loc>https://atlas290.pages.dev/en/</loc>')
  })

  it('gives every municipality both of its pages, each naming the other as its alternate', () => {
    const xml = withOrigin()
    for (const m of data.municipalities) {
      const sv = `https://atlas290.pages.dev/sv/${segmentFor(m.name.sv, m.code)}/`
      const en = `https://atlas290.pages.dev/en/${segmentFor(m.name.en, m.code)}/`
      expect(xml, m.code).toContain(`<loc>${sv}</loc>`)
      expect(xml, m.code).toContain(`<loc>${en}</loc>`)
      expect(xml, m.code).toContain(`hreflang="sv" href="${sv}"`)
      expect(xml, m.code).toContain(`hreflang="en" href="${en}"`)
    }
  })

  it('is a sitemap a crawler will accept, not just well-formed XML', () => {
    const xml = withOrigin()
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true)
    expect(xml).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"')
    expect(xml).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"')
    // Every URL absolute: the one rule the protocol will not bend on.
    expect(xml).not.toMatch(/<loc>\//)
  })
})

describe('robotsFor', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  const robots = 'User-agent: *\nAllow: /\n'

  it('leaves the file alone when there is no sitemap to name', () => {
    expect(robotsFor(robots)).toBe(robots)
  })

  it('names the sitemap absolutely, which is the only form robots.txt accepts', () => {
    vi.stubEnv('SITE_ORIGIN', 'https://atlas290.pages.dev')
    expect(robotsFor(robots)).toContain('Sitemap: https://atlas290.pages.dev/sitemap.xml')
  })

  it('replaces the line rather than stacking one per build', () => {
    vi.stubEnv('SITE_ORIGIN', 'https://atlas290.pages.dev')
    const once = robotsFor(robots)
    expect(robotsFor(once).match(/^Sitemap:/gm)).toHaveLength(1)
    expect(robotsFor(once)).toBe(once)
  })

  it('keeps what the committed file already said', () => {
    vi.stubEnv('SITE_ORIGIN', 'https://atlas290.pages.dev')
    expect(robotsFor(robots)).toContain('User-agent: *')
    expect(robotsFor(robots)).toContain('Allow: /')
  })
})

describe('the Content Security Policy', () => {
  /** The real root page, which is the one document on the site with an inline script. */
  const rootEntry = readFileSync(new URL('../index.html', import.meta.url), 'utf8')

  it('finds the inline script the language picker ships', () => {
    const hashes = inlineScriptHashes(rootEntry)
    expect(hashes).toHaveLength(1)
    expect(hashes[0]).toMatch(/^sha256-[A-Za-z0-9+/]+=*$/)
  })

  it('ignores a script that has a src, which needs no hash', () => {
    expect(inlineScriptHashes(entry)).toHaveLength(0)
    expect(entry).toContain('<script type="module"')
  })

  it('denies everything it has not been asked for', () => {
    const csp = cspFor([])
    expect(csp).toContain("default-src 'none'")
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("base-uri 'none'")
    expect(csp).toContain("form-action 'none'")
  })

  it('never gives scripts the blanket permission styles get', () => {
    // The style attribute has no hash and two components set one. A script has neither excuse,
    // and 'unsafe-inline' in script-src would undo most of what this header is for.
    const csp = cspFor(inlineScriptHashes(rootEntry))
    const scriptSrc = /script-src ([^;]*)/.exec(csp)![1]!
    expect(scriptSrc).not.toContain('unsafe-inline')
    expect(scriptSrc).not.toContain('unsafe-eval')
    expect(csp).toContain("style-src 'self' 'unsafe-inline'")
  })

  it('carries the hash of the picker, so the bare domain is not the one page that breaks', () => {
    const [hash] = inlineScriptHashes(rootEntry)
    expect(cspFor(inlineScriptHashes(rootEntry))).toContain(`'${hash}'`)
  })

  it('writes a _headers Cloudflare will read, with the rest of the headers too', () => {
    const headers = headersFor(inlineScriptHashes(rootEntry))
    expect(headers).toContain('/*\n')
    expect(headers).toContain('  X-Content-Type-Options: nosniff')
    expect(headers).toContain('  Referrer-Policy: no-referrer')
    expect(headers).toContain('  X-Frame-Options: DENY')
    expect(headers).toContain('  Cross-Origin-Opener-Policy: same-origin')
    expect(headers).toContain('  Permissions-Policy: ')
    expect(headers).toContain('  Content-Security-Policy: ')
  })
})
