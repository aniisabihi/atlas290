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

## The second slice — making the data speak

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

| #   | Plan                                             | Ends with                                                                                                                                                                                                                                                                                                                                    | Status      |
| --- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 6   | Similar municipalities, and a profile that reads | A distance metric across standardised indicators, published as each municipality's nearest neighbours; "places like this" in the profile; and rule-generated prose telling a municipality's own story in both languages, every sentence traceable to the figures behind it.                                                                  | not started |
| 7   | Statistics, and facts that find themselves       | A shared statistics module in the kitchen — rank, standardised score, trend, longest run, sharpest reversal, distance from neighbours — and a generated facts file that replaces the five hand-written sentences. Ranked by how surprising a fact is, not merely how true, and each one still carries a check that re-derives its own claim. | not started |
| 8   | The morph                                        | The 290 map shapes animating into their bubble positions and back, holding frame rate on a mid-range phone, cross-fading instead when reduced motion is asked for. Settles the two questions section 9 of DESIGN parks: whether a Canvas layer is needed beneath the SVG, and whether the target is bubbles or a hexagon grid.               | not started |
| 9   | A page per municipality                          | 580 pre-rendered pages, 290 municipalities in two languages, each with its own title, description and preview image — so a link to Malmö shows Malmö when it is pasted into a chat rather than the site's front page.                                                                                                                        | not started |

**Why similarity comes before facts.** The facts engine was the obvious first plan and is
deliberately second. A fact is only interesting relative to something: a naive engine ranking by
how extreme a value is produces ten variations of "Stockholm is the biggest", because the largest
place is extreme on almost every measure. The two useful baselines are a municipality's own past,
which the pantry already holds, and places like it, which it does not. Plan 6 computes that
second baseline, so Plan 7 can ask "unusual _for a place like this_" rather than only "unusual".
Decided by the architect, 2026-09-15.

### What each plan has to decide

These are open in [DESIGN section 9](../DESIGN.md#9-still-open) and are not decided here. Each
belongs to the plan that reaches it, and each gets a record in
[docs/decisions/](../decisions/README.md).

- **Plan 6.** Whether "similar" means all ten indicators or a chosen few, and what to do about
  indicators whose coverage does not overlap. Mean age starts in 1998 and median income in 1999;
  a distance computed over different years for different pairs is not a distance.
- **Plan 7.** What makes a fact interesting rather than merely true — now with Plan 6's
  neighbours available as a baseline, which is the reason for the order.
- **Plan 8.** Canvas under the SVG or not, and bubbles or hexagons. Both are performance
  questions that a prototype answers and an argument does not. Whatever is chosen, the SVG focus
  and ARIA layer stays — a Canvas would sit beneath it, never replace it.
- **Plan 9.** How to make 580 preview images without a paid service. SVG rendered at build time is
  the obvious candidate and needs checking against what social platforms actually accept.

## Not plans, but next

Three things are open that no plan can close.

- **The deploy.** The site is built, tested and gated but has nowhere to go. It needs a Cloudflare
  account and an API token, which only the repository owner can create —
  [README.md](../../README.md) has the steps and the minimum permission. Until then the deploy
  job skips with a note.
- **The name.** [DESIGN section 9](../DESIGN.md#9-still-open) still lists the project name as
  undecided, with one hard constraint: it must not suggest affiliation with SCB. It blocks the
  custom domain, and the domain is what makes the `hreflang` tags absolute rather than relative.
- **A screen-reader pass.** [docs/accessibility.md](../accessibility.md) records that none has
  happened, and why: the agent that built this cannot run VoiceOver, NVDA or JAWS, and nothing was
  substituted for it. It is the largest quality gap in the project, and it is concentrated in the
  three constructs where the accessibility tree looks right and the experience often is not — the
  search combobox, the roving tabindex across 290 shapes, and the debounced live region.

Two small items are queued behind those: the map is the last tab stop, so a keyboard visitor
passes ten controls to reach it (the skip link works, but the source order belongs with a layout
change rather than a release), and `hreflang` needs absolute URLs once a domain exists.

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
