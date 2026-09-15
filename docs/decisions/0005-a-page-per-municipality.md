# 0005 — A page per municipality

**Date:** 2026-09-15
**Plan:** [Plan 9](../plans/2026-09-15-09-a-page-per-municipality.md)
**Status:** accepted

## Context

A link to Malmö showed the site's front page when it was pasted into a chat. Fixing that needs a
real document per municipality, because static hosting serves a file per path and cannot serve
different documents for different query strings — so `?m=1280` can never carry its own title.

That means adding to a URL grammar [DESIGN](../DESIGN.md) called "final in the first slice so
nothing shared ever breaks".

## What was checked first

### SVG does not work as a preview image

The roadmap assumed "SVG rendered at build time is the obvious candidate and needs checking
against what social platforms actually accept". Checked on 2026-09-15:

- **Facebook's image documentation** gives the dimensions (at least 1200 × 630, minimum 200 ×
  200, 8 MB ceiling, 1.91:1) and **says nothing at all about formats**.
- **Slack's unfurling documentation** says it "looks for common OpenGraph and X … Card metadata"
  and states no format requirement either.
- **X's card documentation is behind a paywall** (HTTP 402) and could not be read.

No platform documents SVG support. Shipping SVG would be betting on behaviour three primary
sources decline to promise, so the cards are rasterised to PNG.

### The measurements

|                          | measured   |
| ------------------------ | ---------- |
| rendering one card       | **35 ms**  |
| all 290                  | **4.9 s**  |
| total size               | **7.4 MB** |
| `dist/` after the change | 12 MB      |

### Two facts about the names

- **All 290 names are identical in Swedish and English.** One card therefore serves both
  languages, halving 580 images to 290. Asserted in `shared/slug.test.ts` rather than assumed —
  a future translated name would need a decision about which language the slug speaks, and that
  test is where it would surface.
- **Slugs collide.** Transliterating å→a makes **Håbo** (Uppsala county) and **Habo** (Jönköping
  county) the same word. They are two real, separate municipalities.

## Decisions

### D1 — The path is `name-code`: `/en/stockholm-0180/`

Chosen by the architect. Readable and unique _by construction_, so the Håbo/Habo collision cannot
happen and neither can a future one: no rename can turn a working link into a 404, or into
somebody else's page.

The alternatives: the real name with its å and ö is prettier and honest, but "å" is either one
code point or an "a" plus a combining ring, and on static hosting a request in the form the file
was not written in is a plain 404 with nothing to catch it. Suffixing only the pair that collides
is prettiest for 288 of 290, but _which_ URLs need the suffix depends on the data, so a rename
could change a link that already exists.

**The code is the identifier and the slug is decoration.** `parseSegment` reads only the trailing
four digits and never checks the words, which buys two things: a municipality SCB renames keeps
every link anyone has shared, and a hand-edited slug cannot quietly resolve somewhere other than
where it says.

### D2 — `?m=0180` keeps working, for ever

Both forms parse to exactly the same state, which `src/state/url.test.ts` asserts directly. The
path form is what the site now writes and what `rel=canonical` points at; the query form is what
already exists in the world.

Where a hand-written URL carries both and they disagree, **the path wins** — it is what the
server used to choose which document to send, so a page whose title says Malmö must not render
Stockholm.

### D3 — One card per municipality, carrying no figures

Chosen by the architect. The card shows the municipality's name and the site's, and nothing that
changes when SCB publishes — so it is generated once and the monthly refresh never rewrites 290
binaries. A card with a headline number would cost the same 7.4 MB and then churn all of it every
month, roughly 90 MB of git history a year for a number nobody reads twice.

### D4 — `yarn cards` is run deliberately, never by `yarn build`

Text rendering differs between macOS and Linux, so the same card drawn on a laptop and in CI is
not byte-identical. Wiring generation into the build would mean every CI run produced a diff. The
committed PNGs are the artefact; the script is how they were made.

This also keeps them clear of the pantry determinism check, which covers `public/pantry/` only.
The cards are derived from the pantry, like the bundle — they are not part of it.

### D5 — The 580 pages are written after the build, not by Vite

Vite would need 580 entries in `rollupOptions.input`, each producing a document identical to its
language's except for three strings. `tools/build-pages.mjs` is a copy and a few replacements.

Title and description are **replaced**, not appended: two `<title>` elements is not an error a
browser reports — it quietly uses one, and a crawler may use the other.

### D6 — Dev and preview 404 exactly where production will

Without this, `/en/malmo-1280/` would 404 under `yarn dev` and work once deployed, which is the
worst way round. Both servers now answer the same way.

The preview hook was wrong the first time in an instructive way. Registered _after_ Vite's own
middlewares, it saw URLs the SPA fallback had already rewritten — `/en/atlantis-9999/` had become
`/index.html` and `/en/` had become `/en/index.html`. It therefore 404'd the language entry pages
and let the unknown municipalities through, which is both failures at once. It now runs first and
asks the file system whether the document exists, which is the same question a static host asks
and so cannot drift from the answer.

### D7 — No new state

The path selects a municipality and nothing else. Indicator, year, compare, view and table stay
in the query on top of it: `/en/stockholm-0180/?i=mean-age&y=1990`.

## Consequences

- **The preview images do not work yet, and cannot until the project has a domain.** `og:image`
  resolves for a crawler only when it is absolute, and `SITE_ORIGIN` is unset because the project
  name — which blocks the domain — is still undecided. The pages themselves are correct and the
  build says this out loud on every run rather than leaving it to be discovered by pasting a link
  and seeing nothing.
- `dist/` grew from about 4 MB to 12 MB, and the repository by 7.9 MB.
- Every link the site writes now names a municipality in its path, so the five facts, the "places
  like this" list and the language switch all changed shape. Thirteen existing assertions were
  updated; none was weakened.

## Where the numbers are re-derived

- `shared/slug.test.ts` — the collision, uniqueness across all 290, the round trip, and that the
  parser ignores the slug.
- `src/state/url.test.ts` — both URL forms parsing to one state, and the path winning a conflict.
- `tools/build-pages.test.ts` — the head of every generated page, and that each names a card that
  exists on disk.
- `e2e/municipality-pages.spec.ts` — the built files, in three engines.
