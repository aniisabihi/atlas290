# Plan 10: The design language

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The site should look as considered as it is built. Today a visitor meets a heading, a
tagline and four bordered boxes that read like a settings form, with the map — the entire point —
in a side column beneath two lines of instructions, and the five auto-generated facts, the most
remarkable thing here, as underlined links near the footer.

**Architecture:** No new runtime dependency and no change to the kitchen, the pantry, the URL
grammar or the state model. This is CSS, the order of elements in `App.tsx`, one new control, and
three self-hosted fonts. The colour ramp, the six observation statuses and every figure on screen
are untouched.

**Spec:** [docs/DESIGN.md](../DESIGN.md) section 9, which has carried "visual design language" as
open since the first day.

## What was checked before this was designed

### Four mockups, drawn from the real pantry

The front page, a municipality profile, the compare view and both phone layouts were drawn with
real geometry, real figures, the real generated prose and the real five facts, and reviewed by the
architect on 2026-09-16. The direction below is what was approved, not what was proposed.

### The white map ground is fixed, and that settles the palette

`src/styles/tokens.css` sets `--map-ground: #ffffff` and `src/styles/tokens.test.ts` asserts that
dark mode does **not** override it, because the ColorBrewer ramp is calibrated against white —
its lightest class is `#f7fbff`, which disappears on anything darker.

This is the constraint that decides the page's colour. A white plate on a white page is a hole; a
white plate on a **cool grey** page is a printed sheet on a desk. The drawback becomes the idea,
and it holds in both themes for different reasons: paper on a desk in light, a print under a lamp
in dark.

### The typefaces are both OFL, checked at source on 2026-09-16

- **Newsreader** — SIL Open Font License 1.1, "Copyright 2020 The Newsreader Project Authors".
- **IBM Plex** — SIL Open Font License 1.1, per IBM's own `LICENSE.txt`.

Both permit self-hosting and redistribution with the licence text retained.

### What the current numbers are, so regressions are visible

Measured on `main` at 2026-09-16, and every one of these is a gate this plan must not fail:

| Gate                      | Now       | Budget    |
| ------------------------- | --------- | --------- |
| Lighthouse performance    | 88        | ≥ 80      |
| Lighthouse accessibility  | 100       | 100       |
| Lighthouse best practices | 100       | 100       |
| Lighthouse SEO            | 91        | ≥ 90      |
| Script bytes              | 123,744   | ≤180,000  |
| Unit tests                | 1,080     | all pass  |
| Browser tests, 3 engines  | 196       | all pass  |
| `public/pantry/` rebuild  | identical | identical |

## The decisions this plan makes

**D1 — Editorial, not dashboard.** Chosen by the architect from three directions. The facts
engine and the generated prose are the things nothing else in Sweden has and are currently the
least visible thing on the page; an editorial layout is the only one of the three that
structurally fixes that, because it puts the writing first. The alternatives were "instrument"
(dense, control-forward — safe, and indistinguishable from every other dashboard) and "atlas"
(print-led — the most distinctive and the most likely to fight the interactivity).

**D2 — Light is the standard; both themes ship; the visitor can choose.** Three states, not two.
Nothing stored and no system preference gives the light page. `prefers-color-scheme` applies when
the visitor has expressed no choice. An explicit choice wins over the operating system **in both
directions** and is remembered. This is a real change: `tokens.css` today handles two states and
has no way to ask for light on a dark system.

**D3 — The page ground is greyer than the map.** `--paper` is a cool grey biased toward the map's
own blue; `--plate` stays `#ffffff`, and the accent is `#08519c`, the darkest step of the ramp
already in `src/map/colour.ts`. The page and the data therefore share one colour system rather
than being two that happen to sit together.

**D4 — Three faces, self-hosted and subset, never a font CDN.** Newsreader for display, IBM Plex
Sans for labels and running text, IBM Plex Mono for every figure.

Self-hosted because a Google Fonts link is a third-party request on a site whose README says "no
server, no runtime API, no tracking" and whose notices page lists what it loads. Serving the fonts
ourselves keeps that true and removes a dependency that can change under us.

Mono figures are not decoration: ranks, populations and years line up in columns throughout this
site, and `font-variant-numeric: tabular-nums` on a proportional face is a weaker version of the
same idea.

**The budget: 120 kB total for all faces, woff2, subset to the characters the site actually
uses.** If the third face cannot fit, IBM Plex Mono is the one to drop — Plex Sans with
`tabular-nums` is the fallback, and the plan says so now rather than improvising later.

**D5 — One sticky bar carries identity and controls.** Name, measure, search, map/bubbles, theme
and language in a single rule that never scrolls away. This frees the hero entirely for the
headline, the year and the map, and it is what made the old left column read as a form: it was
carrying navigation and content at once.

**D6 — The map moves up the source order, and the skip link stops being a workaround.**
[docs/plans/README.md](README.md) records that the map is the last tab stop, so a keyboard visitor
passes ten controls to reach it, and that fixing it "belongs with a layout change rather than a
release". This is that layout change. With the controls in the bar, the map is the first thing in
the main region.

**D7 — Every sparkline is drawn on one shared axis, 1968–2025.** Today each is normalised to its
own span, so all ten lines are the same length and a measure first published in 1991 reads as
though it had been collected since 1968. On a shared axis the short ones visibly start late and
median income visibly stops early. This is "absence is never zero" applied to the chart, and it
costs nothing to draw.

**D8 — Compare puts both series in one frame on one shared y-scale, and still declares no
winner.** Two lines on separate scales are decorative, not comparable. Malmö solid blue, its
partner dashed orange: blue against orange is the one pair the two commonest colour deficiencies
do not collapse, it is already the project's diverging palette, and the dash means the
distinction never rests on colour alone. The refusal to declare a winner moves from an omission to
a sentence on the page, because DESIGN decided it on purpose and the design should say so.

**D9 — Each fact carries the family that found it.** `country`, `run`, `reversal`, `unusual`,
`extreme` are already in `facts.json`; they become a bilingual eyebrow above each sentence. A
numbered list was the obvious alternative and is wrong — the five facts are not a sequence, so
`01 02 03` would be decoration pretending to be structure. The family is true information, unique
to this project, and it quietly says that a machine went looking.

**D10 — Container queries, not media queries, for anything that appears at more than one width.**
A measure row appears in the page, in the phone sheet and beside a compare column. It should lay
out by the space it is in, not by the size of the screen. Page-level composition may still use
media queries.

**D11 — Colour is decided in `tokens.css` and nowhere else, and both themes are tested.** Today
the axe scan runs in one theme. It will run in both, and `tokens.test.ts` will check contrast for
both palettes. A token defined only inside a media query is the classic unreadable-page bug and
the test should make it impossible.

## What this plan does not do

- **It does not touch the kitchen, the pantry or the URL grammar.** Not one figure changes.
- **It does not redraw the 290 preview cards.** They are their own artwork with their own palette,
  generated deliberately by `yarn cards`, and rewriting 290 binaries is a separate decision.
- **It does not restyle the morph.** The transition's mechanics are settled in
  [decision 0004](../decisions/0004-the-morph.md); it inherits the new colours and nothing else.
- **It does not add a measure, a view or a page.**

## Tasks

### Task 1 — The fonts

- [ ] Fetch Newsreader, IBM Plex Sans and IBM Plex Mono; subset to the characters the site uses,
      including å ä ö é and the punctuation the generated prose produces.
- [ ] `public/fonts/` with the woff2 files and both OFL licence texts alongside them.
- [ ] `@font-face` with `font-display: swap` and a real fallback stack on every family.
- [ ] Record the byte total. **If it exceeds 120 kB, drop IBM Plex Mono** per D4 and note it.
- [ ] Add the fonts and their licences to the notices page, which lists what the site loads.
- [ ] Test: no stylesheet or font request leaves our own origin.

### Task 2 — The tokens

- [ ] Rewrite `src/styles/tokens.css` to the three-state pattern: the complete light palette on
      bare `:root`; `@media (prefers-color-scheme: dark)` guarded as `:root:not([data-theme='light'])`;
      `:root[data-theme='dark']` repeating the dark values so an explicit choice wins either way.
- [ ] Every token declared in the bare `:root` block before any other block redefines it.
- [ ] `--map-ground` stays `#ffffff` in both. The existing test must keep passing unchanged.
- [ ] Extend `tokens.test.ts`: contrast for text, muted text, accent, borders and focus ring **in
      both palettes**; and a test that fails if any token is defined only inside a media or
      `[data-theme]` block.

### Task 3 — The theme control

- [ ] A button in the bar. Writes `data-theme` on the root element, stores the choice, and reads
      it back before first paint so the page never flashes the wrong theme.
- [ ] Storage wrapped so a private window or blocked storage still renders correctly.
- [ ] Accessible name says what will happen, not what is; `aria-pressed` reflects the state.
- [ ] Tests: default with nothing stored is light; an explicit light choice survives a dark system
      preference and the reverse; storage throwing does not break the page.

### Task 4 — The sticky bar and the source order

- [ ] `App.tsx`: one bar holding wordmark, measure, search, view toggle, theme and language.
- [ ] The map becomes the first thing in `<main>`.
- [ ] `top: env(safe-area-inset-top, 0px)` on the bar, not `0`.
- [ ] Test: the map is reachable in a small number of tab stops from the start of the document;
      the skip link still works and is no longer the only way there.

### Task 5 — The front page

- [ ] Kicker, headline, standfirst; the year as a display element with its readout; the legend as
      one continuous ramp with its ticks; the CKM caveat kept in full.
- [ ] The map as a plate: white ground, generous padding, one shadow, driven by height —
      **Sweden's frame is 1000 × 2000, so a width-driven map letterboxes.**
- [ ] The facts promoted above the fold's fold, each with its family eyebrow (D9); add the
      bilingual family labels to `src/i18n/strings.ts`.

### Task 6 — The profile and the sparklines

- [ ] `Sparkline.tsx`: one shared 1968–2025 axis (D7), area fill, baseline rule, emphasised
      endpoint; a marker where a series stops before the axis does.
- [ ] The generated prose set in the display face at reading size, directly under the name, above
      any figure.
- [ ] A locator map per profile: the country faint, this municipality filled **and ringed** —
      a fill alone is about two pixels wide at that scale and locates nothing.
- [ ] The measures as container-query components (D10): a table at width, stacked blocks when
      narrow. **The trend must never be the thing that gets hidden** — it is the most interesting
      column.

### Task 7 — Compare

- [ ] Both names at equal size; neither is the subject.
- [ ] One frame per row, one shared y-scale, solid blue and dashed orange (D8).
- [ ] The "no winner is declared" sentence on the page, in both languages.
- [ ] The table in its own `overflow-x: auto` container so the document never scrolls sideways.

### Task 8 — The phone

- [ ] Bar in two compact rows; search as a full-width field at the top of the content, because on
      a phone finding a place is the first thing you do.
- [ ] The measure blocks from Task 6 at phone width, sparkline under each name.
- [ ] The locator shrinks with a heavier ring so it still locates.
- [ ] Keep the bottom sheet's behaviour; it is good and this is not the plan that changes it.
- [ ] The 404 page gets the same tokens and faces.

### Task 9 — Prove it, then write it down

- [ ] axe in **both themes** on every page it already covers, plus the 404 page.
- [ ] Lighthouse against the table above; if performance drops below 80 the fonts are the first
      suspect and D4's fallback is the lever.
- [ ] Full unit and browser suites; `public/pantry/` still rebuilds byte-identically.
- [ ] Screenshots of both themes at desktop and phone width, checked by eye, not only by test.
- [ ] `docs/decisions/0009-the-design-language.md` with D1–D11 and the measured font and
      Lighthouse numbers.
- [ ] DESIGN section 9 loses "visual design language"; `docs/plans/README.md` marks Plan 10 done
      and closes the tab-order item.
- [ ] Final review, then open a PR.
