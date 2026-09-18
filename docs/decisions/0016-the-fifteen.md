# ADR-0016: The fifteen

- **Status:** Accepted | **Date:** 2026-09-18
- **Decided by:** Aniisa Bihi (draft by Claude Opus 5)
- **Affects:** `kitchen/src/indicators/**`, `shared/pantry.ts`, `kitchen/src/facts/families.ts`,
  `kitchen/src/similar/build.ts`, `docs/DESIGN.md`
- **Related:** [Plan 16](../plans/2026-09-18-16-the-fifteen.md),
  [fourth slice design](../plans/2026-09-17-fourth-slice-design.md) §4 and D1–D5

## Context

The fourth slice's payload: fifteen new indicators, taking the site from ten to twenty-five. The
design named a table and a content **code** for each. This project resolves content by stable
Swedish **label**, so every one had to be read off the table first — and reading them changed six
of the fifteen.

## Decision

**D1 — Seventeen indicators ship, not fifteen.** `post-secondary-education-women` and
`-men` are published rather than hidden inside a bespoke builder. The gap cannot be derived
without them, and the architect's data-shape decision for this slice was **"flat — each split is
its own indicator"**. Publishing the splits and differencing them is that decision applied.

**D2 — `median-rent` became `median-rent-per-sqm`.** TAB4590 measures rent per square metre, not
per flat. `?i=` is a permanent promise, and a municipality of small flats can show a high rent per
square metre and a low rent.

**D3 — `fertility-rate` is women's, explicitly.** `TAB4805.Kon` has no total code. A men's and a
women's summerad fruktsamhet added together is not a fertility rate of anything — it would land
near 2.7 rather than near 1.4, which is what the test asserts against. This is the one place in
the pantry where `'total'` would have been actively wrong rather than merely unavailable.

**D4 — The labour-market band is 20–64, and both indicators share it.** `TAB3200.Alder` offers
twenty overlapping bands and no total. 20–64 is Sweden's own convention, and using it for both
means the employment rate and the unemployment rate describe the same people. They still do not
sum to 100, which is asserted so the caveat stays honest.

**D5 — `disposable-household-income` is not adjusted, and `taxable-income-per-resident` loses a
year.** TAB1492 is published in fixed prices already; adjusting it again would deflate a deflated
figure, so `priceBasis` stays `'none'` and the caveat says whose base year it is in. TAB3600
publishes 2026 and the price index reaches 2025, so 2026 is dropped rather than placed, nominal,
at the end of thirty adjusted figures with nothing on the page to distinguish it.

**D6 — Two units joined the contract.** `count` rounds to nought decimals, so a fertility rate of
1.45 would have published as `1` and 4.17 tonnes of CO₂e as `4`. `children-per-woman` and
`tonnes-per-resident` both carry two decimals and name their own denominator, following `per-km2`.
Appending to that enum is safe in a way that touching `OBSERVATION_STATUS` never is — a unit is
stored as its own string, never as an index.

**D7 — One source flag and two builders, each arriving with the indicator that needed it.**
`Source.subtract` makes `natural-change-rate` the `ratio` builder that already existed, over a
numerator that is already births minus deaths. `quotient` and `difference` compute from the pantry
alone and fetch nothing.

**D8 — DESIGN §8's claim about nature data was wrong and is corrected.** SCB publishes municipal
greenhouse gases. The limitation held for map-shaped nature data and had been overstated into a
claim about environmental data as a whole.

## Motivation (why)

|                                 | Before        | After                           |
| ------------------------------- | ------------- | ------------------------------- |
| Indicators published            | 10            | **27**                          |
| Municipalities per indicator    | 290           | **290**, asserted in `check.ts` |
| Index, gzipped                  | 6,433 bytes   | **7,545**                       |
| Frozen responses                | ~56 MB        | **59 MB** (+3.1 MB)             |
| Lighthouse, the root            | 92/100/100/91 | **92/100/100/91**               |
| Lighthouse, a municipality page | 86            | **82**                          |
| `data/similar.json`             | —             | **byte-identical**              |
| Unit tests                      | 1,204         | **1,253**                       |
| Browser tests                   | 283           | **283 passed, 0 failed**        |

The index grew 17% for 170% more indicators, because the 290 municipalities dominate it — exactly
what [0013](0013-the-pantry-splits.md) predicted.

## Alternatives considered

- **Fifteen exactly, with the gap computed inside a bespoke builder.** It would have hidden two
  real series the gap is built from, so no reader could check the gap against anything. See D1.
- **Publish the 2026 tax base unadjusted.** One nominal figure at the end of an adjusted series,
  indistinguishable on the page. See D5.
- **Reuse `count` for fertility and emissions.** Zero decimals. See D6.
- **A new builder for natural change.** `Source.subtract` made one unnecessary. See D7.

## Consequences

- **Two defects were found by breadth, not by planning.** Both were invisible while every
  indicator ended in the same year and the pantry held ten.

  The facts engine computed every extreme against the last year _every_ indicator covers.
  Greenhouse gases end in 2022, because the emissions inventory is compiled slowly, and that one
  lagging series silently pulled every extreme fact back two years: the page would have said
  Sundbyberg was 31,147 times denser than Arjeplog in 2022 while the map beside it drew 2025.
  Each extreme now uses its own indicator's last year. There was never anything to synchronise —
  every published fact states its own year.

  Two guards in `similar/build.ts` read every published indicator where they should read the core
  ten — the same defect [0014](0014-indicators-become-definitions.md) found in the published
  method description, in code that change did not touch. `employment-rate`'s register begins in
  2020, which made the whole pantry unpublishable over a window the metric never applies to it.

- **A third finding is recorded rather than fixed.** The country fact ranks by unanimity, then by
  length of record, then by indicator id. The education gap is unanimous over exactly the same 284
  municipalities and exactly the same 1985–2025 record as post-secondary education itself, so the
  last tier decides a real case for the first time and the gap wins on spelling. The published
  fact is now "the education gap between women and men has risen in all 284 municipalities since
  1985" — true, and more striking than the one it replaced. Inventing a rule to prefer a level
  over a contrast would be choosing a tie-break for its answer.

- **Bjurholm has no fertility rate at all.** Sweden's smallest municipality, about 2,400 residents,
  and SCB publishes nothing for it in any of twenty-six years rather than publishing noise. The
  sparkline invariant that every municipality has something to draw for every indicator now names
  that one pair rather than being loosened.

- **The design's first risk closed by measurement.** TAB960's full cube is 3,627,936 cells and
  TAB1264's 1,351,584. Selecting the age and sex totals server-side takes both to 33,060, and the
  whole slice adds 3.1 MB frozen against the 48 MB TAB638 already costs.

- **The design's second risk cost four Lighthouse points.** A municipality page renders one
  sparkline per indicator: 86 at ten, 82 at twenty-seven, measured on the same URL and the same
  machine, with the three-run spreads overlapping (86/80/87 against 82/85/82). The root page is
  unchanged at 92, because [0013](0013-the-pantry-splits.md)'s split means a visitor loads the
  index and one series whatever the count.

- **Every published figure was reconciled against a second read** — a separately shaped request
  through a throwaway raw directory, or hand arithmetic over raw counts and the published
  population. Not one disagreed.

- **Three claims in the plan turned out wrong**, and each is recorded where it was made rather
  than quietly corrected: the education splits DID need a fetch (Kon=2 is a different selection
  from Kon=1+2), `NATURAL_YEARS = YEARS` broke module loading exactly as
  [0014](0014-indicators-become-definitions.md) D4 warns, and house prices' extreme denominator is
  285 in both 2024 and 2025 rather than moving with the year.
