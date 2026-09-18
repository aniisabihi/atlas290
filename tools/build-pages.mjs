#!/usr/bin/env node
/**
 * Everything written into `dist/` after Vite has built: the 580 municipality pages, the sitemap,
 * the `Sitemap:` line in robots.txt, and the response headers Cloudflare serves.
 *
 * Each municipality page is that language's entry page with its head rewritten: its own title,
 * its own description, a canonical link, the two `hreflang` alternates, and the Open Graph and X
 * card tags that make a pasted link show the place rather than the front page.
 *
 * **Written here rather than by Vite.** Vite would need 580 entries in `rollupOptions.input`,
 * each producing a document identical to its language's except for three strings, and the build
 * would carry that for ever. This is a copy and a few replacements.
 *
 * The bundle is untouched: every page loads the same JavaScript and the same pantry, and
 * `src/state/url.ts` reads the municipality out of the path exactly as it reads `?m=`.
 */
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { readPantry } from './read-pantry.mjs'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { segmentFor } from '../shared/slug.ts'

const root = resolve(import.meta.dirname, '..')

/**
 * The absolute origin the preview tags need, or null while the project has no domain.
 *
 * `og:image` only resolves for a crawler when it is absolute. The domain is blocked on the
 * project name, which `docs/plans/README.md` lists as still undecided — so this is one constant
 * to change on the day it is, not 580 files to regenerate by hand.
 */
export const origin = () => process.env['SITE_ORIGIN'] ?? null

/**
 * Read per call rather than captured at import, so a test can set the variable and see the
 * difference. A module-level constant would freeze whatever the environment happened to be when
 * the file was first imported, which for a test runner is "never set".
 */
const absolute = (path) => {
  const base = origin()
  return base ? `${base.replace(/\/$/, '')}${path}` : path
}

const COPY = {
  sv: {
    title: (name, site) => `${name} · ${site}`,
    description: (name) =>
      `${name} i tio mått från SCB, år för år från 1968 till i dag: folkmängd, medelålder, ` +
      `inkomst, skattesats och mer.`,
    site: 'Atlas 290',
  },
  en: {
    title: (name, site) => `${name} · ${site}`,
    description: (name) =>
      `${name} in ten measures from Statistics Sweden, year by year from 1968 to today: ` +
      `population, mean age, income, tax rate and more.`,
    site: 'Atlas 290',
  },
}

const escapeAttribute = (s) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

/**
 * Rewrites one entry page's head for one municipality.
 *
 * The title and description are REPLACED rather than appended to: two `<title>` elements is not
 * an error a browser reports, it just uses the first, and a crawler may use either.
 */
export function pageFor(html, { lang, name, code }) {
  const copy = COPY[lang]
  if (!copy) throw new Error(`no copy for language '${lang}'`)
  const segment = segmentFor(name, code)
  const title = copy.title(name, copy.site)
  const description = copy.description(name)
  const path = `/${lang}/${segment}/`
  const image = absolute(`/share/${code}.png`)

  const head = [
    `<link rel="canonical" href="${absolute(path)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${escapeAttribute(copy.site)}" />`,
    `<meta property="og:locale" content="${lang === 'sv' ? 'sv_SE' : 'en_GB'}" />`,
    `<meta property="og:url" content="${absolute(path)}" />`,
    `<meta property="og:title" content="${escapeAttribute(title)}" />`,
    `<meta property="og:description" content="${escapeAttribute(description)}" />`,
    `<meta property="og:image" content="${image}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${escapeAttribute(title)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeAttribute(title)}" />`,
    `<meta name="twitter:description" content="${escapeAttribute(description)}" />`,
    `<meta name="twitter:image" content="${image}" />`,
  ].join('\n    ')

  let out = html
    .replace(/<title>[^<]*<\/title>/, `<title>${escapeAttribute(title)}</title>`)
    .replace(
      /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/s,
      `<meta name="description" content="${escapeAttribute(description)}" />`,
    )
  // The entry pages carry site-wide alternates; a municipality page's point at its own two.
  out = out.replace(/\s*<link rel="alternate"[^>]*>/g, '')
  // Defensive rather than currently necessary: two canonicals is a silent conflict, and this
  // file also rewrites the entry pages, so one could acquire a canonical between the two steps.
  out = out.replace(/\s*<link rel="canonical"[^>]*>/g, '')
  out = out.replace(
    '</head>',
    `  <link rel="alternate" hreflang="sv" href="${absolute(`/sv/${segment}/`)}" />\n` +
      `    <link rel="alternate" hreflang="en" href="${absolute(`/en/${segment}/`)}" />\n` +
      `    ${head}\n  </head>`,
  )
  if (out === html) throw new Error(`${lang}/${segment}: nothing was rewritten`)
  return out
}

/**
 * The three entry pages — `/`, `/sv/`, `/en/` — given absolute alternates and a canonical.
 *
 * `hreflang` is the reason this exists: Google's specification requires a fully-qualified URL,
 * and the entry pages ship root-relative ones because they are hand-written HTML with no origin
 * to write. Without an origin this is a no-op and the file is returned unchanged, which is
 * exactly what a local build should do.
 */
export function entryPageFor(html, path) {
  if (!origin()) return html
  let out = html.replace(
    /(<link rel="alternate"[^>]*?href=")([^"]*)(")/g,
    (_match, before, href, after) => `${before}${absolute(href)}${after}`,
  )
  out = out.replace(/\s*<link rel="canonical"[^>]*>/g, '')
  return out.replace('</head>', `  <link rel="canonical" href="${absolute(path)}" />\n  </head>`)
}

const escapeXml = (s) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c],
  )

/**
 * The sitemap: 582 URLs, each declaring the other language as its alternate.
 *
 * **Why this has to exist at all.** Every page this site serves is a shell — `<div id="root">`
 * and a bundle — so a crawler that does not run JavaScript sees no links anywhere, and the 580
 * municipality pages have nothing pointing at them from anywhere on the web. The preview cards
 * Plan 9 built make a PASTED link show the place; they do nothing to make an unpasted one
 * findable. A sitemap is the only discovery path a static site of shells has.
 *
 * `xhtml:link` rather than only `hreflang` in the head, because the sitemap protocol wants the
 * pair declared reciprocally and the two pages are genuinely the same page in two languages.
 *
 * Returns null without an origin: the protocol requires fully-qualified URLs, and a sitemap of
 * relative paths is not a lenient sitemap but an invalid one. A local build writes none.
 */
export function sitemapFor(municipalities) {
  if (!origin()) return null
  const urls = []
  // The language roots first, in the order a reader would meet them, then the municipalities.
  for (const lang of ['sv', 'en']) {
    urls.push({ loc: `/${lang}/`, alternates: { sv: '/sv/', en: '/en/' } })
  }
  for (const m of municipalities) {
    const alternates = {
      sv: `/sv/${segmentFor(m.name.sv, m.code)}/`,
      en: `/en/${segmentFor(m.name.en, m.code)}/`,
    }
    for (const lang of ['sv', 'en']) urls.push({ loc: alternates[lang], alternates })
  }

  const entries = urls.map(({ loc, alternates }) => {
    const links = ['sv', 'en'].map(
      (lang) =>
        `    <xhtml:link rel="alternate" hreflang="${lang}" href="${escapeXml(absolute(alternates[lang]))}" />`,
    )
    return ['  <url>', `    <loc>${escapeXml(absolute(loc))}</loc>`, ...links, '  </url>'].join(
      '\n',
    )
  })

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...entries,
    '</urlset>',
    '',
  ].join('\n')
}

/**
 * robots.txt with the sitemap named, or unchanged when there is no origin to name it with.
 *
 * The line is appended at build time rather than committed, for the same reason the sitemap is
 * generated: `Sitemap:` takes an absolute URL, and the checked-in file has no domain to write.
 */
export function robotsFor(robots) {
  if (!origin()) return robots
  const withoutSitemap = robots.replace(/^Sitemap:.*$/gm, '').trimEnd()
  return `${withoutSitemap}\n\nSitemap: ${absolute('/sitemap.xml')}\n`
}

/**
 * The Content Security Policy, built around whatever inline script the root page actually ships.
 *
 * The site is an unusually easy CSP target: one self-hosted bundle, one self-hosted stylesheet,
 * no third-party origin, no `data:` URI, nothing fetched cross-origin. So the policy denies
 * everything by default and names the four things that are real.
 *
 * Two entries are not obvious:
 *
 * - **The hash.** `/index.html` is a static language picker with an inline script, which is the
 *   one thing on the site that `script-src 'self'` would block — and it would break the bare
 *   domain for every visitor while every other page kept working, which is the worst shape a
 *   failure can have. The hash is computed from the built file rather than written down, so
 *   editing the picker cannot silently lock it out.
 * - **`'unsafe-inline'` for styles, and only styles.** Two components set a React `style` prop
 *   (`Legend`'s colour swatch and `NoDataPatterns`' offscreen SVG), which becomes a `style`
 *   attribute. There is no hash for an attribute, and the alternative is moving a per-item colour
 *   into a stylesheet that cannot know it. Scripts are not given the same licence.
 */
export function cspFor(hashes) {
  const script = ["'self'", ...hashes.map((h) => `'${h}'`)].join(' ')
  return [
    "default-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
    `script-src ${script}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self'",
    "connect-src 'self'",
    "font-src 'self'",
  ].join('; ')
}

/** Every inline `<script>` in a document, hashed the way `script-src` wants it. */
export function inlineScriptHashes(html) {
  const hashes = []
  for (const [, attrs, body] of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (/\ssrc=/.test(attrs)) continue
    if (body.trim() === '') continue
    hashes.push(`sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}`)
  }
  return hashes
}

/**
 * `_headers`, which Cloudflare Pages reads from the root of the deployment.
 *
 * Written at build time rather than committed because the policy contains a hash of a built file.
 * A committed `_headers` would be a copy of this that drifts the first time the picker changes.
 */
export function headersFor(hashes) {
  return [
    '# Generated by tools/build-pages.mjs. Do not edit: the policy carries a hash of the built',
    '# root page, so a hand-written copy goes stale the moment that page changes.',
    '/*',
    '  X-Content-Type-Options: nosniff',
    '  Referrer-Policy: no-referrer',
    '  X-Frame-Options: DENY',
    '  Cross-Origin-Opener-Policy: same-origin',
    '  Permissions-Policy: accelerometer=(), camera=(), geolocation=(), gyroscope=(), microphone=(), payment=(), usb=()',
    `  Content-Security-Policy: ${cspFor(hashes)}`,
    '',
  ].join('\n')
}

export function buildPages({ distDir = join(root, 'dist'), dataFile } = {}) {
  // Plan 13: the pantry is an index plus one file per indicator, reassembled here because these
  // 580 pages genuinely need every municipality and every indicator name.
  const data = dataFile ? JSON.parse(readFileSync(dataFile, 'utf8')) : readPantry()
  const written = []
  for (const lang of ['sv', 'en']) {
    const entry = join(distDir, lang, 'index.html')
    if (!existsSync(entry)) throw new Error(`no built entry page at ${entry}; run vite build first`)
    const html = readFileSync(entry, 'utf8')
    for (const m of data.municipalities) {
      const segment = segmentFor(m.name[lang], m.code)
      const dir = join(distDir, lang, segment)
      mkdirSync(dir, { recursive: true })
      writeFileSync(
        join(dir, 'index.html'),
        pageFor(html, { lang, name: m.name[lang], code: m.code }),
      )
      written.push(`${lang}/${segment}/index.html`)
    }
  }

  // AFTER the municipality pages, not before: they are copies of the entry page, and rewriting
  // the source first would give all 580 an absolute canonical pointing at the language root.
  for (const [file, path] of [
    ['index.html', '/'],
    ['sv/index.html', '/sv/'],
    ['en/index.html', '/en/'],
  ]) {
    const full = join(distDir, file)
    if (!existsSync(full)) continue
    writeFileSync(full, entryPageFor(readFileSync(full, 'utf8'), path))
  }

  // The policy is built from what the build actually produced, so it cannot describe a page that
  // is no longer there. Every hand-written document is checked, not just the root: an inline
  // script appearing anywhere else would otherwise be blocked in production and nowhere else.
  //
  // `404.html` is in the list although it currently has no script, and decision 0007 says it must
  // never gain one. If it ever does, this covers it rather than letting the not-found page be the
  // single document on the site that silently breaks under the policy.
  const hashes = new Set()
  for (const file of ['index.html', 'sv/index.html', 'en/index.html', '404.html']) {
    const full = join(distDir, file)
    if (!existsSync(full)) continue
    for (const hash of inlineScriptHashes(readFileSync(full, 'utf8'))) hashes.add(hash)
  }
  writeFileSync(join(distDir, '_headers'), headersFor([...hashes]))

  const sitemap = sitemapFor(data.municipalities)
  if (sitemap) writeFileSync(join(distDir, 'sitemap.xml'), sitemap)

  const robots = join(distDir, 'robots.txt')
  if (existsSync(robots)) writeFileSync(robots, robotsFor(readFileSync(robots, 'utf8')))

  return {
    written,
    inlineScripts: hashes.size,
    sitemapUrls: sitemap ? (sitemap.match(/<loc>/g) ?? []).length : 0,
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { written, inlineScripts, sitemapUrls } = buildPages()
  console.log(`${written.length} municipality pages written`)
  console.log(
    `  _headers written, with a policy covering the ${inlineScripts} inline scripts the ` +
      `hand-written pages ship`,
  )
  if (origin()) {
    console.log(`  preview tags absolute against ${origin()}`)
    console.log(`  sitemap.xml written, ${sitemapUrls} URLs, and named in robots.txt`)
  } else {
    // Not a failure, and normal for a local build. But a crawler cannot resolve a root-relative
    // og:image, so no preview will appear unless SITE_ORIGIN is set. Said plainly rather than
    // left for somebody to discover by pasting a link into a chat and seeing nothing.
    console.log(
      '  SITE_ORIGIN is not set, so og:image, canonical and hreflang are root-relative — correct\n' +
        '  for the site, but link previews will not render, and no sitemap is written because the\n' +
        '  protocol requires absolute URLs. The deploy sets it; a local build does not need to.',
    )
  }
}
