#!/usr/bin/env node
/**
 * The site's three typefaces, subset to the characters this site can actually render.
 *
 * **Self-hosted, never a font CDN.** The README promises no server, no runtime API and no
 * tracking, and the notices page lists everything the site loads. A `<link>` to a font CDN is a
 * third-party request on every page view, which would quietly make both untrue. Serving the files
 * ourselves also removes a dependency that can change under us.
 *
 * **Run deliberately, with `yarn fonts` — never from `yarn build`.** Like the preview cards, the
 * committed `.woff2` files are the artefact and this is how they were made. Both faces are under
 * the SIL Open Font License 1.1, which permits this as long as the licence travels with them, so
 * it does: see `public/fonts/`.
 *
 * The character set is DERIVED, not guessed — every character in the pantry and in the site's own
 * strings is included, so a municipality or an indicator name cannot render as tofu. If the data
 * ever contains a character the source subset does not carry, this fails loudly rather than
 * shipping a hole.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import subsetFont from 'subset-font'

const root = resolve(import.meta.dirname, '..')
const outDir = join(root, 'public/fonts')

/**
 * What Google's "latin" subset carries, copied from the `unicode-range` in the fontsource CSS.
 * A character outside this cannot be delivered by the files we start from.
 */
const LATIN = [
  [0x0000, 0x00ff],
  [0x0131, 0x0131],
  [0x0152, 0x0153],
  [0x02bb, 0x02bc],
  [0x02c6, 0x02c6],
  [0x02da, 0x02da],
  [0x02dc, 0x02dc],
  [0x0304, 0x0304],
  [0x0308, 0x0308],
  [0x0329, 0x0329],
  [0x2000, 0x206f],
  [0x20ac, 0x20ac],
  [0x2122, 0x2122],
  [0x2191, 0x2191],
  [0x2193, 0x2193],
  [0x2212, 0x2212],
  [0x2215, 0x2215],
  [0xfeff, 0xfeff],
  [0xfffd, 0xfffd],
]
const inLatin = (cp) => LATIN.some(([lo, hi]) => cp >= lo && cp <= hi)

/** Everything the chrome, the figures and the generated prose can put on screen. */
function charset() {
  const chars = new Set()
  const add = (text) => {
    for (const ch of text) chars.add(ch)
  }

  // Every printable ASCII character, so no label, unit or number can surprise us.
  for (let c = 0x20; c <= 0x7e; c += 1) add(String.fromCharCode(c))

  // The typography the design itself uses, none of it present in the data.
  add('åäöÅÄÖéÉèÜü–—·•…‘’“”′″°±×÷€%‰†↑↓−∕²³')

  // And everything the pantry and the string tables can render. Read as raw text rather than
  // parsed: over-inclusive by a few punctuation marks, and incapable of missing one.
  for (const file of [
    'public/pantry/data/indicators.json',
    'public/pantry/data/facts.json',
    'public/pantry/data/similar.json',
    'src/i18n/strings.ts',
  ]) {
    add(readFileSync(join(root, file), 'utf8'))
  }

  const outside = [...chars].filter((ch) => !inLatin(ch.codePointAt(0)))
  if (outside.length > 0) {
    throw new Error(
      `these characters are not in the latin subset the fonts are built from, so they would ` +
        `render as tofu: ${outside.map((c) => `${c} (U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')})`).join(', ')}`,
    )
  }
  return [...chars].sort().join('')
}

/**
 * Two variable faces and two static weights of the monospace.
 *
 * Newsreader carries an italic, which the headlines and the compare view use; a browser's
 * synthetic oblique on a serif is visibly wrong, so the real one is worth its bytes.
 *
 * **The weight axis is cut to 400-600, which is the whole reason all three faces fit.** Newsreader
 * ships 200-800 and Plex Sans 100-700; the design uses regular, medium and semibold and nothing
 * else. Keeping the unused ends cost 35 kB and would have forced the monospace out under D4.
 * Measured: Newsreader normal 37.9 kB at full range against 24.8 kB at 400-600.
 */
const AXIS = { wght: { min: 400, max: 600 } }

const FACES = [
  {
    out: 'newsreader-normal.woff2',
    variable: true,
    from: '@fontsource-variable/newsreader/files/newsreader-latin-wght-normal.woff2',
  },
  {
    out: 'newsreader-italic.woff2',
    variable: true,
    from: '@fontsource-variable/newsreader/files/newsreader-latin-wght-italic.woff2',
  },
  {
    out: 'plex-sans-normal.woff2',
    variable: true,
    from: '@fontsource-variable/ibm-plex-sans/files/ibm-plex-sans-latin-wght-normal.woff2',
  },
  {
    out: 'plex-mono-400.woff2',
    from: '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2',
  },
  {
    out: 'plex-mono-500.woff2',
    from: '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2',
  },
]

const LICENCES = [
  ['newsreader-OFL.txt', '@fontsource-variable/newsreader/LICENSE'],
  ['ibm-plex-OFL.txt', '@fontsource-variable/ibm-plex-sans/LICENSE'],
]

const text = charset()
mkdirSync(outDir, { recursive: true })
for (const file of readdirSync(outDir)) {
  if (file.endsWith('.woff2')) rmSync(join(outDir, file))
}

let total = 0
const written = []
for (const face of FACES) {
  const source = readFileSync(join(root, 'node_modules', face.from))
  const subset = await subsetFont(source, text, {
    targetFormat: 'woff2',
    ...(face.variable ? { variationAxes: AXIS } : {}),
  })
  writeFileSync(join(outDir, face.out), subset)
  total += subset.length
  written.push([face.out, source.length, subset.length])
}

for (const [out, from] of LICENCES) {
  writeFileSync(join(outDir, out), readFileSync(join(root, 'node_modules', from), 'utf8'))
}

writeFileSync(
  join(outDir, 'README.md'),
  `# Fonts\n\nGenerated by \`yarn fonts\` (tools/build-fonts.mjs) and committed. Subset to the\n` +
    `${text.length} characters this site can render, derived from the pantry and the string\n` +
    `tables rather than guessed.\n\n` +
    `Newsreader and IBM Plex are both under the SIL Open Font License 1.1; the licence texts are\n` +
    `beside the files, as that licence requires.\n\n` +
    written
      .map(
        ([f, a, b]) =>
          `- \`${f}\` — ${(b / 1024).toFixed(1)} kB (from ${(a / 1024).toFixed(1)} kB)`,
      )
      .join('\n') +
    `\n\nTotal: ${(total / 1024).toFixed(1)} kB.\n`,
)

for (const [file, before, after] of written) {
  console.log(
    `  ${file.padEnd(24)} ${(after / 1024).toFixed(1).padStart(6)} kB  (was ${(before / 1024).toFixed(1)} kB)`,
  )
}
console.log(
  `${written.length} files, ${text.length} characters, ${(total / 1024).toFixed(1)} kB total`,
)

// Plan 10 D4: 120 kB for all faces. Over it, IBM Plex Mono is the one to drop.
const BUDGET = 120 * 1024
if (total > BUDGET) {
  console.error(`\nOVER BUDGET: ${(total / 1024).toFixed(1)} kB against ${BUDGET / 1024} kB.`)
  process.exitCode = 1
}
