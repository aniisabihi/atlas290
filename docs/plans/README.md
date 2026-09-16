# Build plans

## The first slice — done

The first slice from [docs/DESIGN.md](../DESIGN.md) is delivered as five plans. Each ends with software that runs and is tested on its own. Plans are written one at a time, just before they are executed, so each can learn from the last.

| #   | Plan                                                                                        | Ends with                                                                                                                                                                                                                                                                                           | Status   |
| --- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | [Foundations and the first indicator](2026-09-13-01-foundations-and-first-indicator.md)     | A repo that builds and tests. The kitchen fetches, freezes and publishes population for all 290 municipalities 1968–2025, plus map geometry, keyboard adjacency and the bubble layout. A throwaway page draws the map from pantry files to prove the contract. The two open SCB questions answered. | **done** |
| 2   | [Kitchen: the ten indicators](2026-09-14-02-the-ten-indicators.md)                          | All ten indicators with exact definitions, code-history fixes, CKM stitching, inflation adjustment, rates, mean age (SCB publishes no municipal median), fixed colour breaks, the check stage, provenance manifest, byte-identical rebuilds. Published pantry 1.04 MB, 275 kB gzipped.              | **done** |
| 3   | [Dining room: map, time and state](2026-09-14-03-dining-room-map-time-state.md)             | URL-as-state, the SVG map with legend, year slider and play, search, both languages, live region, arrow-key navigation, reduced motion.                                                                                                                                                             | **done** |
| 4   | [Dining room: profile, compare, facts, phone](2026-09-14-04-profile-compare-facts-phone.md) | Profile panel with ten small charts, explicit compare, hand-written facts strip, table view, static cartogram as phone view with bottom sheet, correct titles per state.                                                                                                                            | **done** |
| 5   | [Ship](2026-09-14-05-ship.md)                                                               | Playwright browser tests, axe in CI, Lighthouse budget, Cloudflare Pages deploy, monthly refresh job that keeps itself alive, README, notices page, WCAG manual pass.                                                                                                                               | **done** |

**Complete.** All five plans are implemented: the kitchen fetches, freezes,
checks and publishes ten indicators for 290 municipalities; the site reads them with a map, a
cartogram, time travel, search, profiles, comparison, a table twin and five deep-linked facts, in
both languages; and CI runs 745 unit tests, 99 browser tests across three engines, an
accessibility scan and a performance budget on every pull request, with a monthly refresh job and
a deploy gated behind all of it.

Increments after the first slice (facts engine, animated morph, similar municipalities, profile prose, pre-rendered pages) each get their own plan and a decision record.

---

## The second slice — making the data speak · **done**

The first slice built a map you can read, drive and link to. Everything in it answers a question
you already had. The second slice is about the questions you did not think to ask: it takes the
123,067 observations already in the pantry and makes them offer things up.

Of the three things the original vision claimed nobody else in Sweden had — time depth to 1968, a
shape-changing map, and auto-surfaced facts — the first shipped, the second shipped as a static
view without its transition, and the third is still five sentences written by hand. Plans 7 and 8
finish the vision; 6 and 9 are what the vision was for.

Same rule as before: **each plan is written in full only just before it is executed**, so each can
learn from the last. The table is intent, not specification.

Unlike the first slice there is no "ship" plan at the end. Plan 5 built the machinery — CI in
three browsers, an accessibility scan, a performance budget, a gated deploy — so every plan below
ships through it as it lands.

| #   | Plan                                                                                                                 | Ends with                                                                                                                                                                                                                                                                                                                                                                                                    | Status   |
| --- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| 6   | [Similar municipalities, and a profile that reads](2026-09-15-06-similar-municipalities-and-a-profile-that-reads.md) | A distance metric across standardised indicators, published as each municipality's nearest neighbours; "places like this" in the profile; and rule-generated prose telling a municipality's own story in both languages, every sentence traceable to the figures behind it.                                                                                                                                  | **done** |
| 7   | [Statistics, and facts that find themselves](2026-09-15-07-statistics-and-facts-that-find-themselves.md)             | A statistics module in the kitchen — runs, reversals, shares, extremes — and five fact families that generate the strip, replacing the five hand-written sentences. Each family ranks its own candidates; there is deliberately no score comparing across them, because "how surprising" has no honest exchange rate between kinds of claim. Every fact still carries a check that re-derives its own claim. | **done** |
| 8   | [The morph](2026-09-15-08-the-morph.md)                                                                              | The 290 map shapes animating into their bubble positions and back, holding frame rate on a mid-range phone, cross-fading instead when reduced motion is asked for. Settles the two questions section 9 of DESIGN parks: whether a Canvas layer is needed beneath the SVG, and whether the target is bubbles or a hexagon grid.                                                                               | **done** |
| 9   | [A page per municipality](2026-09-15-09-a-page-per-municipality.md)                                                  | 580 pre-rendered pages, 290 municipalities in two languages, each with its own title, description and preview image — so a link to Malmö shows Malmö when it is pasted into a chat rather than the site's front page.                                                                                                                                                                                        | **done** |

**Why similarity comes before facts.** The facts engine was the obvious first plan and is
deliberately second. A fact is only interesting relative to something: a naive engine ranking by
how extreme a value is produces ten variations of "Stockholm is the biggest", because the largest
place is extreme on almost every measure. The two useful baselines are a municipality's own past,
which the pantry already holds, and places like it, which it does not. Plan 6 computes that
second baseline, so Plan 7 can ask "unusual _for a place like this_" rather than only "unusual".
Decided by the architect, 2026-09-15.

**Complete.** The profile names the five places most like the one on screen and opens with a few
sentences of its own story; the facts strip finds its own five facts across five families; the 290
shapes travel between the map and the bubbles rather than cutting; and every municipality has its
own page, so a pasted link names the place. Of the three things the original vision claimed nobody
in Sweden had — time depth to 1968, a shape-changing map, auto-surfaced facts — all three now
exist.

### What each plan decided

These are open in [DESIGN section 9](../DESIGN.md#9-still-open) and are not decided here. Each
belongs to the plan that reaches it, and each gets a record in
[docs/decisions/](../decisions/README.md).

- **Plan 6 — settled.** All ten indicators, one vote each; a ten-year window ending at the last
  year every indicator covers, fixed rather than following the year slider. Both were decided by
  measurement rather than by argument, and both are recorded with their numbers in
  [decision 0002](../decisions/0002-similarity-metric.md). The coverage worry this entry was
  written about turned out to have a cleaner answer than expected: the window ends at the last
  year EVERY indicator covers, so no pair is ever compared over different years. Two consequences
  went into [DESIGN section 8](../DESIGN.md#8-known-limitations-stated-honestly) as stated
  limitations rather than being fixed.
- **Plan 7 — settled, and it revised the premise.** Plan 6's neighbours turned out NOT to solve
  the "Stockholm is the biggest" problem on their own: ranking by distance from the neighbours'
  mean still puts Stockholm first, because it has no close neighbours and a large residual
  measures the failed match. Two fixes were needed — leave-one-out, closing a circularity nobody
  had spotted (all ten indicators find the neighbours, so "unusual population among places with
  a similar population" is near self-contradictory), and a cutoff keeping only candidates whose
  neighbours are genuinely near. The strongest facts, meanwhile, needed no neighbours at all.
  All of it is in [decision 0003](../decisions/0003-the-facts-engine.md).
- **Plan 8 — settled by a prototype, as it asked to be.** No Canvas: 32-point SVG path
  interpolation holds 60 fps at 6× CPU throttling with 40% of the frame spare, and Canvas would
  mean maintaining two renderers forever beneath an accessibility layer that has to exist either
  way. Bubbles, not hexagons — which turned out not to be a performance question at all: a morph
  has to end at the view that already exists. [Decision 0004](../decisions/0004-the-morph.md).
- **Plan 9 — settled, and the guess was wrong.** SVG rendered at build time is not a candidate at
  all: no platform documents SVG support for `og:image`, and Facebook's, Slack's and X's own
  documentation each decline to say. The cards are rasterised with Playwright, which was already
  here — 290 of them in seconds, one per municipality rather than 580 because all 290 names are
  identical in both languages. (They were redrawn at 4.7 MB when the project was named; the
  figure in [decision 0005](../decisions/0005-a-page-per-municipality.md) is what was measured
  that day.) [Decision 0005](../decisions/0005-a-page-per-municipality.md).

## Not plans, but next

**One thing is left.** The other two closed on 2026-09-15 and 2026-09-16.

- ~~**The name.**~~ **Settled: Atlas 290**, in [decision 0006](../decisions/0006-the-name.md). It
  had been read as blocking a paid custom domain; it was not. Cloudflare Pages serves the project
  at `<project-name>.pages.dev`, which is free and absolute, so the name alone unblocks the link
  previews. The deploy builds against `https://atlas290.pages.dev`.
- ~~**The deploy.**~~ **Live** at <https://atlas290.pages.dev>, deployed by Actions behind the
  full gate. The first deploy immediately earned its keep by exposing something no test could
  have caught: every unmatched path answered 200 with the root page, because Cloudflare Pages
  treats a site with no top-level `404.html` as a single-page application.
  [Decision 0007](../decisions/0007-the-404-that-was-not.md) records the fix and, more usefully,
  why the passing test was checking our own simulation of Cloudflare rather than Cloudflare.
- **A screen-reader pass.** [docs/accessibility.md](../accessibility.md) records that none has
  happened, and why: the agent that built this cannot run VoiceOver, NVDA or JAWS, and nothing was
  substituted for it. It is the largest quality gap in the project, and it is concentrated in the
  three constructs where the accessibility tree looks right and the experience often is not — the
  search combobox, the roving tabindex across 290 shapes, and the debounced live region.

One small item is queued behind it: the map is the last tab stop, so a keyboard visitor passes
ten controls to reach it (the skip link works, but the source order belongs with a layout change
rather than a release). The `hreflang` item that stood beside it is closed — the generated
municipality pages take their absolute URLs from `SITE_ORIGIN`, which the deploy now sets.

## Later, and possibly never

**More indicators.** The kitchen's registry was built so a new indicator is one module, and
[DESIGN section 4](../DESIGN.md#4-data-model) leaves the list deliberately open. Unemployment,
housing completions, commuting, election turnout and land use are all within SCB alone. Cheap now
that the machinery exists, and it makes every plan above richer — but it adds no new capability,
and the first ten already answer the questions the design set out to answer. A plan when there is
a reason, not before.

**Still deferred, and may never be built**, unchanged from
[DESIGN section 7](../DESIGN.md#7-scope): neighbourhood-level zoom into SCB's 6,160 small areas, a
preference-based "where should I live", a daily guessing game, and animated migration flows.
