# ADR-0021: Stage A, and what the tables said

- **Status:** Accepted | **Date:** 2026-09-21
- **Decided by:** Aniisa Bihi (draft by Claude Opus 5)
- **Affects:** `kitchen/src/indicators/**`, `kitchen/src/publish.ts`, `shared/pantry.ts`
- **Related:** [Fifth slice design](../plans/2026-09-21-fifth-slice-design.md),
  [Plan 17](../plans/2026-09-21-17-stage-a-the-unblocked-six.md),
  [issue #37](https://github.com/aniisabihi/atlas290/issues/37)

> **Filed as ADR-0018 and renumbered to 0021 on 2026-09-21.** Two sessions running in parallel
> each read `docs/decisions/` when 0017 was the highest number, and both merged — this record in
> PR #34 and [0018](0018-the-focus-a-link-never-asked-for.md) in PR #33. PR #33 merged first, so
> that record keeps the number and this one moves. Nothing in the decision below changed; only
> its identifier did. `tools/decisions.test.ts` now fails the build on a repeat.

## Context

The fourth slice deferred six groups of questions, three of them behind one design question:
what does the site do with a measure that has five values across fifty-eight slider positions?

Verifying the thirteen remaining tables against live metadata **before** designing anything
answered part of that question by making it smaller, and moved two groups into reach. This
records stage A — the eight indicators that need no contract change and no site change — and the
decisions the tables forced. The sparse work itself is stage B and is not decided here.

## Decision

**D1 — Sparsity is a presentation problem, not a contract one.** Every sparse table publishes
plain four-digit years; `IndicatorSeries.years` holds all of them. The fourth slice filed
sparsity with the period problem, and they are not the same thing. Only `TAB4394` and `TAB708`
key by something that is not a year.

**D2 — A period is pinned to a representative year, chosen per measure.** Life expectancy takes
its five-year window's **last** year. Because the windows overlap by four, the twenty-four land
on twenty-four consecutive years, 2002–2025 — so pinning turned the hard case into a dense series
and life expectancy shipped in stage A rather than waiting for stage B.

**D3 — Life expectancy ships as three indicators.** `TAB4394.Kon` has no total, and a men's and a
women's life expectancy can be neither summed nor averaged without a sex-split population to
weight by. Women, men and their gap, exactly as post-secondary education went in
[0016](0016-the-fifteen.md) D1.

**D4 — A source may name several contents, and is then grouped by content LABEL.**
`out-commuter-share` needs a numerator and a denominator that are two content codes of one table.
The three stitched commuting tables call the same measure `AM0207H9`, `AM0207C8` and `00000548`
and label all three identically, so a share keyed by code could not span the stitch. Decision
[0001](0001-plan-1-build-decisions.md)'s trap 2 — the code varies by table and by era, the label
is stable — applied to the one place that had not needed it.

**D5 — Cars are a `direct` measure.** `TAB3276.Agarkategori` carries
`totalt antal bilar per 1 000 invånare` alongside the owner categories. The question list called
it a rate; dividing here would recompute a figure the source already has.

**D6 — `Q25` becomes a distance, because the share does not exist.** See Consequences.

**D7 — The manifest's `schemaVersion` goes to 2.** `sources[].contentCode` becomes
`contentCodes`, because one chunk can now resolve several. The field exists to signal a shape
change, so it is bumped rather than an array being smuggled in under the singular name.

## Motivation (why)

|                              | Before | After              |
| ---------------------------- | ------ | ------------------ |
| Indicators published         | 27     | **35**             |
| Municipalities per indicator | 290    | **290**, asserted  |
| Index, gzipped               | 7,545  | **7,975**          |
| Frozen responses added       | —      | **2.1 MB**         |
| `data/similar.json`          | —      | **byte-identical** |
| Unit tests                   | 1,253  | **1,274**          |

## Alternatives considered

- **Widen `IndicatorSeries.years` to hold periods.** It is the highest-stakes file in the
  repository and pinning cost nothing but a caveat. See D2.
- **Average the two life expectancies.** There is no honest weight. See D3.
- **Publish out-commuters per 1,000 residents**, symmetric with in-commuters and buildable with
  no new machinery. Rejected: the share of _employed residents_ is the measure Sweden uses, and
  the machinery it needed was small and general. See D4.

## Consequences

- **A content code existing in the metadata is not the same as that code having values.** Q25
  asked for the share of residents within 1 km of protected nature, and `TAB4422` advertises
  exactly that code. All five of its share-within-a-distance codes return null for every
  municipality in every year — 3,770 cells, all empty; SCB publishes those shares only at a
  coarser geography. The mean distance in the same table is complete. The indicator became
  `distance-to-protected-nature`, in metres. The question list verified the code and could not
  have verified the values without fetching, so the lesson belongs in `docs/kitchen.md` rather
  than in blame.

- **The result is counter-intuitive and is tested for it.** Arjeplog sits 3,300 m from protected
  nature and Stockholm 1,100 m, because the mean is weighted over **residents**: a vast northern
  municipality whose people live in one town is further out than a city whose residents cluster
  beside an urban reserve.

- **Three units joined the contract**, all because `count` rounds to nought decimals: a household
  of 2.04 people would publish as 2, and metres needed a label that is not "residents".
  `persons-per-household`, `metres`, and — from [0016](0016-the-fifteen.md) — the pattern of
  naming the denominator in the unit.

- **The life-expectancy gap is the cell that proves the round-once rule.** Stockholm 2025: women
  86.22, men 82.56, difference 3.66, published **3.7** — where the two rounded values differ by
  3.6. Both figures are now pinned, so rounding twice cannot start.

- **An assertion was written wrong and the data corrected it.** "Women outlive men in every
  municipality and every year" is false in three windows: Norberg 2008, Dorotea 2015 and 2018.
  Those are municipalities of about 5,600 and 2,500 people, where five years hold few enough
  deaths for the order to reverse by chance — which is the caveat's own argument rather than a
  counter-example to it. The test names all three, so a fourth cannot appear unnoticed.

- **One test had stopped testing its own rule.** It pinned Åsele's standing sentence to show that
  a house-price claim says "of 285" rather than 290, and the new nature indicator gave Åsele a
  stronger standing — so it had quietly become a check that Åsele's top fact had not changed. It
  now finds whichever municipality carries the house-price standing.

- **Stage B and stage C remain**, and the design's D2–D5 and D9 are not decided by this record.
  Farmland's 1951 start (design D8) and whether `scale.reference` is built or deleted (design D9)
  are still open.
