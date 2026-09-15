#!/usr/bin/env node
/**
 * The 580 municipality pages, written into `dist/` after Vite has built.
 *
 * Each is that language's entry page with its head rewritten: its own title, its own description,
 * a canonical link, the two `hreflang` alternates, and the Open Graph and X card tags that make a
 * pasted link show the place rather than the front page.
 *
 * **Written here rather than by Vite.** Vite would need 580 entries in `rollupOptions.input`,
 * each producing a document identical to its language's except for three strings, and the build
 * would carry that for ever. This is a copy and a few replacements.
 *
 * The bundle is untouched: every page loads the same JavaScript and the same pantry, and
 * `src/state/url.ts` reads the municipality out of the path exactly as it reads `?m=`.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
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
export const ORIGIN = process.env['SITE_ORIGIN'] ?? null

const absolute = (path) => (ORIGIN ? `${ORIGIN.replace(/\/$/, '')}${path}` : path)

const COPY = {
  sv: {
    title: (name, site) => `${name} · ${site}`,
    description: (name) =>
      `${name} i tio mått från SCB, år för år från 1968 till i dag: folkmängd, medelålder, ` +
      `inkomst, skattesats och mer.`,
    site: 'Sveriges kommuner i data',
  },
  en: {
    title: (name, site) => `${name} · ${site}`,
    description: (name) =>
      `${name} in ten measures from Statistics Sweden, year by year from 1968 to today: ` +
      `population, mean age, income, tax rate and more.`,
    site: "Sweden's municipalities in data",
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
  out = out.replace(
    '</head>',
    `  <link rel="alternate" hreflang="sv" href="${absolute(`/sv/${segment}/`)}" />\n` +
      `    <link rel="alternate" hreflang="en" href="${absolute(`/en/${segment}/`)}" />\n` +
      `    ${head}\n  </head>`,
  )
  if (out === html) throw new Error(`${lang}/${segment}: nothing was rewritten`)
  return out
}

export function buildPages({ distDir = join(root, 'dist'), dataFile } = {}) {
  const data = JSON.parse(
    readFileSync(dataFile ?? join(root, 'public/pantry/data/indicators.json'), 'utf8'),
  )
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
  return written
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const written = buildPages()
  console.log(`${written.length} municipality pages written`)
  if (ORIGIN) {
    console.log(`  preview tags absolute against ${ORIGIN}`)
  } else {
    // Not a failure: there is no domain yet, and the pages themselves are correct. But a
    // crawler cannot resolve a root-relative og:image, so the preview will not appear until
    // SITE_ORIGIN is set. Said plainly rather than left for somebody to discover by pasting a
    // link into a chat and seeing nothing.
    console.log(
      '  SITE_ORIGIN is not set, so og:image and canonical are root-relative — correct for the\n' +
        '  site, but link previews will not render anywhere until the project has a domain.',
    )
  }
}
