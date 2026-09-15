# 0002 — How "places like this" is computed

**Date:** 2026-09-15
**Plan:** [Plan 6](../plans/2026-09-15-06-similar-municipalities-and-a-profile-that-reads.md)
**Status:** accepted

## Context

Plan 6 publishes, for each of the 290 municipalities, the five others most like it. There is no
right answer to "most like it", so the question is which defensible answer to pick and how much
of the choice can be settled by measurement rather than taste.

Everything below was measured against the committed pantry before it was decided. The
prototypes are gone; the numbers are reproduced by the tests named at the end.

## Decisions

### D1 — All ten indicators, equally weighted

Three variants were built: all ten; eight, with the two near-duplicate indicators dropped; and
all ten with each duplicate pair sharing a vote. They agree on the nearest municipality for
233 and 231 of 290 respectively and on 4.19 and 4.23 of the top five, and the top three are
near-identical throughout.

Since the choice barely changes the answer, the simplest rule wins: every indicator the site
has, one vote each. Any subset needs an editorial argument for why two measures do not count,
and a visitor cannot check an editorial argument.

**Consequence, stated rather than fixed.** `mean-age` and `share-65-plus` correlate at 0.991
and `net-migration-rate` and `population-change` at 0.902, so age and growth each effectively
carry two tenths of the weight rather than one. This is a real distortion. It is recorded in
[DESIGN section 8](../DESIGN.md#8-known-limitations-stated-honestly) rather than corrected,
because every correction available (dropping indicators, reweighting, whitening the covariance)
substitutes a rule nobody can verify for one everybody can.

### D2 — A ten-year window ending at the last complete year, not the selected year

A single year is not a usable basis. Neighbours computed from 2023 and from 2024 agree on the
nearest municipality for only **89 of 290**, with a mean top-five overlap of **2.39/5**. That is
not a noisier version of the same answer; it is mostly a description of which of a dozen
near-tied candidates edged ahead that year.

| Window | Nearest survives a year | Top-five overlap |
| ------ | ----------------------- | ---------------- |
| 1      | 89/290                  | 2.39/5           |
| 3      | 153/290                 | 3.61/5           |
| 5      | 204/290                 | 4.00/5           |
| **10** | **244/290**             | **4.36/5**       |
| 15     | 260/290                 | 4.60/5           |

Ten is where the curve flattens. Fifteen is marginally more stable and describes the place
less currently.

The window ends at the last year **every** indicator covers, read from the data rather than
written down — 2024, because median income stops there while the tax rate reaches 2026.

**The result does not follow the year slider.** Two reasons, one practical and one honest. The
practical one: `tax-rate` begins in 2000, so the earliest ten-year window ends in **2009**, and
a per-year version would have no answer for 42 of the site's 58 years while costing roughly
**320 kB against a 1.05 MB pantry**. The honest one: what kind of place somewhere is does not
change annually, and a "places like this" list that reshuffled as the slider moved would be
claiming a precision the measurement above disproves.

### D3 — A log transform for the four skewed indicators

`population`, `density`, `house-prices` and `median-income` are compared on a log scale before
standardising. Largest standard score in the country, 2024:

| Indicator     | Raw   | Logged |
| ------------- | ----- | ------ |
| population    | 12.49 | 4.00   |
| density       | 10.37 | 3.19   |
| house-prices  | 5.27  | 2.80   |
| median-income | 3.94  | 3.53   |

Untransformed, distance becomes a test of "is it Stockholm": the difference between 0.2 and 28
people per square kilometre vanishes next to 6,446. The effect is visible in the output —
Arjeplog, the emptiest municipality in Sweden at 0.2 per square kilometre, is given neighbours
at 0.3, 0.3, 0.8, 0.8 and 1.1 with the transform, and Storfors at 9.6 without it.

`net-migration-rate` and `population-change` are deliberately excluded: both go genuinely
negative, and a log of a negative number is not a number.

### D4 — Missing cells reduce the dimensions, never the value

Distance is the root of the mean squared difference over the dimensions both municipalities
have, rescaled to the full ten. Without the rescaling a pair missing a dimension would lose a
term from the sum and look closer than it is.

Measured afterwards: the municipalities with an incomplete comparison appear as somebody's
neighbour **17 times in 1,450 — 1.17%** — against a **1.72%** share of the country, so the
correction neither pulls them in nor pushes them away. At most two of the ten may be missing;
beyond that the build refuses to publish.

The window turns out to repair most of the problem by itself. Five municipalities have no 2024
house price (suppressed as `too-few-cases`), but only **Dorotea** has none in any year of
2015–2024; Bjurholm, Sorsele, Arjeplog and Malå have between three and six.

### D5 — Five neighbours, presented as a set and not a ranking

The gap between the fifth and sixth nearest has a **median of 0.032** against typical distances
near 1.0, and a **minimum of exactly 0.000**. The cut at five is therefore arbitrary and the
order within it is not meaningful, so the panel shows no ordinals, no numbering and no
distances.

The relationship is also **not symmetric**: A is in B's five for only **798 of 1,450**
relationships — 55%. Nothing may word it as "these two are alike".

### D6 — The prose is the municipality's own story, not a comparison

Chosen by the architect. Three rules — the arc since the municipality's own first published
year, the turning point where one exists, and the single measure it sits furthest out on. Each
needs nothing but series the site already holds, each traces to a figure drawn beside it, and
each stays true whatever this metric later becomes.

Two thresholds in it were also set by measurement. A turning point is only claimed when the
fall since the peak is at least 1% — the first version told Håbo its population peaked in 2023,
"0% more than today", on a peak one person above the present. And a standing is only claimed
inside the extreme tenth of the field: 116 of 290 municipalities have a rank inside the top or
bottom 5% of some indicator, 185 inside 10%, 256 inside 20%. A fifth would fire for almost
everyone and so say almost nothing.

## Consequences

- `public/pantry/data/similar.json`, 13 kB and 3,836 bytes gzipped, rebuilt byte-identically.
- The published `method` object carries the indicators, the transform, the window and the
  count, and the site renders its description from that object — so changing the metric cannot
  leave the page describing a method it no longer uses.
- The similar list is fixed across the year slider, which is a visible departure from "the URL
  is the application's memory". It is deliberate, per D2, and the panel says which years it was
  measured over.
- Age and growth are over-weighted, per D1.

## Where the numbers are re-derived

- `kitchen/src/similar/standardise.test.ts` — the transform, the population standard deviation,
  and the refusal to log a non-positive value.
- `kitchen/src/similar/distance.test.ts` — the rescaling, the null for no shared dimension, the
  tie-break.
- `kitchen/src/similar/build.test.ts` — the window, the three guards, Dorotea as the only lost
  dimension, and the density test that holds D3 in place.
- `src/data/similar.test.ts` — the 55% mutuality.
- `src/profile/story.test.ts` — every sentence's claim, and the coverage of each rule.
