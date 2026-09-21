# ADR-0023: What absence means, and how a place compares to the country

- **Status:** Accepted | **Date:** 2026-09-21
- **Decided by:** Aniisa Bihi (draft by Claude Opus 5)
- **Affects:** `shared/pantry.ts`, `src/i18n/format.ts`, `src/map/colour.ts`,
  `src/components/NoDataPatterns.tsx`, `kitchen/src/indicators/**`
- **Related:** [Plan 21](../plans/2026-09-21-21-absence-and-the-country.md),
  [#40](https://github.com/aniisabihi/atlas290/issues/40),
  [#42](https://github.com/aniisabihi/atlas290/issues/42),
  [0022](0022-the-reference-scale-is-not-built.md)

## Context

The fifth slice deferred two items, both on a decision rather than on difficulty: holiday homes,
because no status described their absences honestly, and Q30, because the fourth slice had
reclassified it as a colour scale and [0022](0022-the-reference-scale-is-not-built.md) had just
undone that. This record takes both decisions.

## Decision

**D1 — `OBSERVATION_STATUS` gains a seventh value, `nothing-to-count`.** It means the thing this
indicator measures does not exist in this municipality at all, as against `not-yet-published`,
which means a figure exists and has not been published. Appended, so every status byte already
written keeps its meaning; the six existing indices are pinned by a test.

**D2 — `Definition.absentMeans` lets a definition say what a silent source means**, defaulting to
`not-yet-published` so every existing indicator is untouched. It describes the SOURCE being
silent, not every absence: a municipality that did not exist still gets `did-not-exist`.

**D3 — Holiday homes ship**, with `absentMeans: 'nothing-to-count'`. 369 cells present, 211
`nothing-to-count`, none `not-yet-published`.

**D4 — Q30 ships as an indicator named for what it computes**, `share-65-plus-vs-country`. The
question list's title and its own formula ask different things — "ageing **faster** than the
country" is a rate of change, "share 65+ **minus** the national share" is a level. Only the
formula was ever specified, so the formula ships, and the id, the name and the caveat all say
"against the country". Naming it after the title would have been the more appealing claim and
the false one.

**D5 — The national share is population-weighted**, every resident aged 65 and over in Sweden
over every resident — not the mean of 290 municipal shares. See Consequences for what that is
worth.

**D6 — Hand-written, not a new builder**, for the reason
[0014](0014-indicators-become-definitions.md) gives for `population-change`: a generic "subtract
this indicator's own national aggregate" builder would have exactly one user.

## Motivation (why)

|                               | Before |     After |
| ----------------------------- | -----: | --------: |
| Indicators published          |     42 |    **44** |
| `OBSERVATION_STATUS` values   |      6 |     **7** |
| Absence patterns              |      4 |     **5** |
| Municipality page, Lighthouse |     95 |    **90** |
| Root page, Lighthouse         |     91 |        91 |
| Unit tests                    |  1,327 | **1,338** |

## Alternatives considered

- **Publish 0 for a municipality with no holiday-home area.** It would assert a figure SCB did
  not publish. The table never publishes 0 anywhere, which is evidence for what the null means,
  but evidence is not SCB saying so.
- **Ship holiday homes with `not-yet-published`.** A false sentence on a third of the map.
- **Answer Q30 with the unweighted mean of the 290 shares.** Simpler and wrong: it would let
  Bjurholm weigh as much as Stockholm, and it differs by more than four percentage points.
- **Answer the title instead of the formula** — a rate-of-change measure. Nobody specified it,
  and inventing the specification while implementing it is how a number nobody can check gets
  published.

## Consequences

- **The weighting is worth four percentage points, and a test says so.** Sweden's
  population-weighted share of over-65s in 2024 is **20.84%**; the unweighted mean of the 290
  municipal shares is **25.07%**. Most municipalities are small and old, so an unweighted mean
  is dragged up, and using one would have shifted every published value by about four points
  while still producing a plausible-looking map. That is the failure this indicator was most
  likely to have, so it is the one the tests are built around.

- **The national figures match Sweden's real ones, which is the only check that is not
  circular.** 20.84% in 2024 and 13.39% in 1968 against SCB's own published national shares of
  about 20.8% and 13.4%. Everything else here is computed from the pantry by the pipeline under
  test; this is the assertion that could catch the whole computation being wrong in the same
  direction.

- **The median municipality is 2.13 points older than the country**, which is the weighting
  visible in the output rather than in an argument: the map is mostly above zero because the
  people are mostly below it, in the cities.

- **A test that refused to be loosened got restructured instead.** `Sparkline` asserted that
  exactly one (indicator, municipality) pair in the whole pantry has nothing to draw —
  Bjurholm's fertility rate — and its own comment refused "mostly". Holiday homes add a hundred
  more. The guarantee is kept by making it precise: an empty series whose every cell says
  `nothing-to-count` is explained, and the list of UNEXPLAINED ones is still one item long.

- **A hundred, not 106.** Eleven municipalities have a holiday-home area in one survey and not
  the other — six lost theirs between 2015 and 2020, five gained one — so they still draw a
  single point. 100 × 2 + 11 = the 211 empty cells, and the arithmetic is in the test.

- **The municipality page fell from 95 to 90**, still twenty clear of the floor. Two more
  indicators on a profile is the cost, and it is the first slice since
  [0019](0019-the-view-is-built-once.md) where the count has moved the number at all — worth
  watching rather than acting on.

- **Both deferred issues close.** Neither was hard; both were waiting on somebody to decide
  what a thing meant.
