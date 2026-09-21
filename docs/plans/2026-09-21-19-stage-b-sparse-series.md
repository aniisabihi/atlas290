# Plan 19 — Stage B, sparsity and the seven

> [Fifth slice design](2026-09-21-fifth-slice-design.md) §4, stage B. D2–D5 first, proven against
> a fabricated sparse series, then the seven indicators that need them: thirty-five becomes
> forty-two.
>
> Depends on [plan 18](2026-09-21-18-the-view-is-built-once.md), which had to land first: the
> mechanism it fixed was quadratic in the indicator count, and these seven would each have made it
> worse.

## What reading the six tables changed

All six were verified against the frozen metadata before this was written. The design's coverage
figures, content codes and `Tid` values all hold. Three things it did not settle:

**The design named no distance for green space.** `TAB5591.AvstandGrOmr` offers 200, 300 and 500
metres from the dwelling, and the design's table names only the content code `0000046N`
("Andel av tätortsbefolkningen"). A distance has to be chosen and named in the id, the same way
[0016](../decisions/0016-the-fifteen.md) D5 made rent say "per square metre". See D1.

**The design named no background total for councillors.** `TAB708.BakgrVar` carries six different
"samtliga" codes — `samald`, `samu6`, `samu18`, `samtcs`, `samutb`, `samiu`, `samink` — one per
cross-tabulation, and `TOTAL_CODES` knows none of them. They should all be the same total, and
"should" is not a thing this project publishes on. See D2.

**Turnout's gap is between two elections, not two groups.** `ME0104B8` is the general election and
`ME0104C6` the municipal one, both in the same year, and the gap is how many more people vote for
a parliament than for their own council. Worth saying plainly in the prose, because "turnout gap"
reads like a demographic gap and it is not.

## The site work, and how much of it already exists

Less than the design assumed. `YearSlider` **already** draws one tick per year with
`data-covered`, and `EmptyYear` already explains itself and offers one click to the nearest year
with data. Both simply ask the wrong question.

`covered` is `year >= coverage.from && year <= coverage.to` in two places
(`src/components/App.tsx`, `src/components/YearSlider.tsx`) and `nearestCoveredYear` in
`src/data/select.ts` clamps into that range. So D3 and D4 are one predicate and one helper, used
in three places, not new machinery.

What genuinely does not exist: the index cannot say which years an indicator has (D2), and
playback counts by one (D5).

## Tasks

### Task 1 — `coverage.years`, and one predicate that reads it

`shared/pantry.ts` is TDD-only per `workflow-config.md`.

```ts
coverage: { from: number; to: number; years?: number[] }
```

Written **only when the series is not the dense run from `from` to `to`**, so thirty-five of the
current indicators carry nothing new. Additive and safe in the sense [0016](../decisions/0016-the-fifteen.md)
D6 describes: no index into this is persisted anywhere, unlike `OBSERVATION_STATUS`.

**Acceptance**

- [ ] `coverage.years`, when present, is non-empty, strictly ascending, and has `from` first and
      `to` last — asserted by the schema, not by convention.
- [ ] A dense indicator omits it; the schema accepts both shapes.
- [ ] One exported predicate — `coversYear(indicator, year)` — replaces the three hand-rolled
      range checks, and `nearestCoveredYear` returns a year the indicator HAS rather than a
      clamp into its range.
- [ ] `nearestCoveredYear` ties break toward the earlier year, stated and tested, because a tie
      has to break somewhere and silence would make it arbitrary.
- [ ] `public/pantry/` byte-identical — nothing declares `years` yet.

### Task 2 — The kitchen writes it, and `check.ts` refuses a lie

Declared per indicator and **verified against the built series**, the way
[0018](../decisions/0018-stage-a-and-what-the-tables-said.md) asserts 290 regions rather than
trusting the catalogue. A declared `years` that does not match the series exactly is a build
failure, not a warning.

**Acceptance**

- [ ] `check.ts` fails when `coverage.years` differs from the series' own years in either
      direction, naming the indicator and the difference.
- [ ] It also fails when `years` is ABSENT and the series is not dense — otherwise a sparse
      indicator could ship silently as a dense one, which is the exact defect this plan exists to
      fix.
- [ ] A test proves both failures fire, against a fabricated series.

### Task 3 — The empty year, the ticks and the playback

Site only, no contract change. D3, D4, D5.

**Acceptance**

- [ ] The map shows `EmptyYear` for a year the indicator does not have, not merely for one outside
      its range.
- [ ] Its sentence is true for a sparse series: "published for 1973–2022" is misleading when there
      are fifteen values in it, so a sparse indicator gets its own string in both languages.
- [ ] The slider's ticks mark the years that have data.
- [ ] `aria-valuetext` says the same thing the sentence does — the ticks are `aria-hidden`, so for
      a screen reader the value text is the only carrier.
- [ ] Playback steps to the next year that has data, and stops at the last one rather than
      running out the axis.
- [ ] Proven against a **fabricated two-value indicator** before any real one exists, per the
      design's §6.

### Task 4 — Look at it

The design's risk 1: "the empty-map experience is the whole point of stage B, and it cannot be
judged from a test."

**Acceptance**

- [ ] A two-value indicator opened in a browser and looked at, at phone width and desktop.
- [ ] The design's risk 2 answered from what is on screen rather than argued: does a two-value
      measure deserve the slider at all?

### Task 5 — The seven

| Id                              | Source                                                  | Values | Builder    |
| ------------------------------- | ------------------------------------------------------- | -----: | ---------- |
| `turnout-general-election`      | `TAB2707` `ME0104B8`                                    |     15 | direct     |
| `turnout-gap-general-municipal` | `ME0104B8` − `ME0104C6`                                 |     15 | difference |
| `farmland-hectares`             | `TAB6002` `16`, from 1981 (D8)                          |      8 | direct     |
| `share-land-built`              | `TAB5118` `3` over `911`                                |      3 | share      |
| `green-space-within-200m`       | `TAB5591` `0000046N`, 200 m                             |      2 | direct     |
| `holiday-homes-per-1000`        | `TAB4198` `0000000E`                                    |      2 | ratio      |
| `councillor-gap`                | `TAB708` `000000BO`, pinned to the mandate's first year |      5 | direct     |

Needs `yarn kitchen fetch` — the only command allowed to reach SCB. Only metadata is frozen today.

**Acceptance**

- [ ] 290 municipalities per indicator, asserted by `check.ts`.
- [ ] Every figure reconciled against a second read of the source, per the slice's §6.
- [ ] Each one's `coverage.years` matches its series.
- [ ] The facts engine's noise bound re-derived per indicator rather than inherited — the design's
      risk 3. A sparse series' "change since the start" spans decades.
- [ ] `data/similar.json` byte-identical: the metric reads the core ten and must not notice these.

### Task 6 — The record

- [ ] ADR, indexed. D1, D2 and the turnout-gap naming are decisions the design did not make.
- [ ] `docs/kitchen.md` gains the six tables.
- [ ] The performance budget re-run — forty-two indicators against the thirty-five plan 18
      measured at 92. If it has fallen back toward the floor, that is recorded, not absorbed.

## Decisions this plan takes

**D1 — Green space is published at 200 metres, and the id says so.** `green-space-within-200m`.
200 m is the shortest of the three and the one that distinguishes municipalities most; 500 m is
near-universal in a built-up area and would publish a column of nineties. The caveat records that
300 m and 500 m exist. The denominator is the **urban** population, not the whole municipality,
which the caveat must also say.

**D2 — The councillor total is chosen by checking, not by assuming.** All six `samtliga` codes are
read from the fetched data and compared; if they agree, `samald` is used and the agreement is
recorded as the reason. If they do not, this plan stops and the difference is written down before
anything is published.

**D3 — Turnout ships as the general election plus the gap, not three elections.** `TAB2707` also
carries the regional election. Three turnout series would be three near-identical maps; the
interesting quantity is the distance between the national and the local, which is what the gap is.

## Measurements

_To be filled._
