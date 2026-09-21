# Fifth slice — what the site does with a measure that has five values

> Answers the question the [fourth slice design](2026-09-17-fourth-slice-design.md) §9 left open,
> and clears the six groups it deferred. Every table named here was verified against live SCB
> metadata on 2026-09-21 before a line of this was written —
> `yarn tsx kitchen/spikes/verify-the-rest.ts` reproduces it.

## 1. The question, and what verifying the tables did to it

The fourth slice deferred six groups and said three of them were one question wearing three hats:
**what does this site do with a measure that has five values across 58 slider positions?**

Reading the thirteen remaining tables splits that into two questions, and shows that only one of
them is hard.

**The contract is not the problem.** Every sparse table publishes plain four-digit years:

| Table                   | Question | `Tid` values | Across   |
| ----------------------- | -------- | -----------: | -------- |
| `TAB2707` turnout       | Q19, Q20 |           15 | 50 years |
| `TAB6002` farmland      | Q24      |            9 | 70 years |
| `TAB5118` land use      | Q23      |            3 | 11 years |
| `TAB5591` green space   | Q26      |            2 | 6 years  |
| `TAB4198` holiday homes | Q27      |            2 | 6 years  |

`IndicatorSeries.years` is a list of integers and holds every one of them. Sparsity is a
**presentation** problem, not a data-contract problem, and the fourth slice's §5 was wrong to file
it with the period problem.

**Only two tables genuinely break the contract**, and their `Tid` codes say so plainly:

| Table                     | Question | `Tid` codes                           |
| ------------------------- | -------- | ------------------------------------- |
| `TAB4394` life expectancy | Q3       | `1998-2002` … `2021-2025`, 24 windows |
| `TAB708` councillors      | Q21      | `2007-2010` … `2023-2026`, 5 mandates |

**And one deferred table was never sparse at all.** `TAB4422` (Q25, share of residents within 1 km
of protected nature) publishes 2013–2025, annually, for all 290. The fourth slice grouped it with
land use and holiday homes on the strength of the heading it sat under rather than its coverage.

## 2. Two more things the metadata said

**Two tables carry 291 four-digit region codes, not 290**, and in both cases the extra is a
municipality that no longer exists:

- `TAB3276` (cars) carries `1917 Heby` — Heby's code before it moved from Västmanland to Uppsala
  county in 2007, where it is `0331`.
- `TAB2707` (turnout) carries `1229 Bara` — merged into Svedala in 1977, and this table starts in 1973.

Both are decision 0001's renumbering trap, and `regions: 'known'` already drops them. All 290
current codes are present in both tables, so nothing is lost. This is exactly why the fourth
slice's D2 says to assert 290 rather than trust the catalogue.

**SCB already publishes cars per 1,000 residents.** `TAB3276.Agarkategori` carries
`060 = totalt antal bilar per 1 000 invånare`. The question list called Q28 a `rate` builder; it
is a `direct` one, and dividing it here would be recomputing a figure the source already has.

## 3. The decisions

**D1 — Sparsity is answered in the site, not in the contract.** Nothing about `IndicatorSeries`
changes. What changes is what "this year has no data" means and what the page does about it.

**D2 — `coverage` gains an optional explicit year list.** `covered` is currently
`year >= coverage.from && year <= coverage.to`, which is true for 1974 on a turnout series that
has 1973 and 1976 and nothing between — so the map draws 290 grey shapes and says nothing. The
index must be able to say _which_ years an indicator has, before the series loads (plan 13's rule:
the year axis cannot depend on which series happens to be loaded).

```ts
coverage: { from: number; to: number; years?: number[] }
```

`years` is written **only when the series is not the dense run from `from` to `to`**, so twenty of
the twenty-seven current indicators carry nothing new and the index barely grows. This is additive
and safe in the way [0016](../decisions/0016-the-fifteen.md) D6 describes: unlike
`OBSERVATION_STATUS`, no index into this is persisted anywhere.

**D3 — "Covered" becomes "this indicator has this year".** `EmptyYear` already exists, already
explains itself, and already offers one click to the nearest year that has data. It fires on the
wrong condition, and `nearestCoveredYear` clamps into the range instead of finding a year with
data. Both are small changes to code that is otherwise right.

**D4 — The slider shows where the data is.** A measure with nine values across seventy-six
positions has to look like that before it is dragged, or every visitor discovers it by landing on
emptiness. Ticks on the track, from the same `coverage.years`.

**D5 — Playback steps between years that have data.** Otherwise the play button spends most of a
sparse indicator's run showing an empty map, which is neither informative nor watchable.

**D6 — A period is pinned to a representative year, and the caveat says which.** Of the three
options the question list put to the architect — pin, exclude, or extend the contract — pinning is
chosen, because it turns the hard problem into the one D1–D5 already solve. The representative
year is chosen per measure rather than by a blanket rule, because the two cases genuinely differ:

- **Life expectancy** takes the window's **last** year. `1998-2002` → 2002. The twenty-four
  overlapping windows then land on twenty-four consecutive years, **2002–2025**, so this becomes a
  dense series and needs none of D2–D5.
- **Councillors** take the mandate's **first** year. `2023-2026` → 2023, the year the council is
  seated. Five values across seventeen years: sparse, and D2–D5 carry it.

**D7 — Life expectancy's caveat must say that consecutive values share four years of data.**
Pinning overlapping windows produces a series that looks annual and is not: adjacent values are
built from four-fifths of the same deaths, so year-on-year change is close to meaningless and the
trend is smoother than reality. This is the cost of D6 and it is paid in prose, visibly.

**D8 — Farmland's 1951 start is not taken.** `TAB6002` reaches back to 1951, seventeen years
before this site's axis begins. The axis is the union of every indicator's coverage, so admitting
it would stretch the slider from 59 positions to 76 **for every indicator on the site**, to show
nine values. The series is published from 1981 instead, and the caveat records that 1951 exists
and why it is not shown. This is the first time one indicator's range has cost every other
indicator something, and the rule worth keeping is: the axis serves the reader, not the longest
table.

**D9 — Q30 is a scale, and the scale is not implemented.** The fourth slice recorded that
"`scale.reference: 'national-median'` already exists in the contract". It exists in
`shared/pantry.ts` and **nothing reads it** — `grep` finds no use anywhere in `src/`. So Q30 is not
free, as the fourth slice implied; it is a small piece of site work. Either the reference scale
gets built and `share-65-plus` uses it, or the field is dead schema and should be removed rather
than left as a promise the site does not keep.

## 4. What ships, in order

**Stage A — the four that need nothing new.** No contract change, no site change.

| Id                      | Source                                            | Coverage  | Builder |
| ----------------------- | ------------------------------------------------- | --------- | ------- |
| `out-commuter-share`    | `TAB3267` + `TAB3266` + `TAB5839`                 | 1993–2021 | share   |
| `in-commuters-per-1000` | same three                                        | 1993–2021 | ratio   |
| `persons-per-household` | `TAB4374` `000000M5`                              | 2011–2025 | direct  |
| `cars-per-1000`         | `TAB3276`, `Agarkategori 060`                     | 2002–2025 | direct  |
| `near-protected-nature` | `TAB4422` `000000PL`                              | 2013–2025 | direct  |
| `life-expectancy`       | `TAB4394` `000000NH`, windows pinned to last year | 2002–2025 | direct  |

Six, not four: D6 makes life expectancy dense, and §1 found Q25 was never sparse.

**Stage B — sparsity, then the sparse indicators.** D2–D5 first, proven against a fabricated
sparse series, then:

| Id                       | Source                              | Values | Builder    |
| ------------------------ | ----------------------------------- | -----: | ---------- |
| `turnout`                | `TAB2707` `ME0104B8`                |     15 | direct     |
| `turnout-gap`            | `TAB2707` `ME0104B8` − `ME0104C6`   |     15 | difference |
| `farmland-hectares`      | `TAB6002`, from 1981 (D8)           |      8 | direct     |
| `share-land-built`       | `TAB5118` by `Markanvandningsklass` |      3 | share      |
| `green-space-near`       | `TAB5591` `0000046N`                |      2 | direct     |
| `holiday-homes-per-1000` | `TAB4198` `0000000E`                |      2 | ratio      |
| `councillor-gap`         | `TAB708` `000000BO`, pinned (D6)    |      5 | direct     |

**Stage C — Q30.** Build the reference scale, or delete the field. D9.

## 5. Risks

1. **The empty-map experience is the whole point of stage B**, and it cannot be judged from a
   test. It needs looking at, with a two-value indicator selected, before stage B is called done.
2. **Two-value indicators may not deserve the slider at all.** If `green-space-near` reads better
   as "2015 and 2020" than as two lit positions on a 59-year track, that is worth finding out by
   building it rather than by arguing.
3. **The facts engine sees every indicator.** A sparse series' "change since the start" is a
   change across a gap of decades, and its noise bound cannot be inherited. Same rule as
   [0003](../decisions/0003-the-facts-engine.md), re-derived per indicator.
4. **Life expectancy's autocorrelation (D7)** will make it look like the steadiest measure on the
   site. The caveat is the only defence, and caveats are read less than maps.

## 6. Verification

| Stage | Signal                                                                                                |
| ----- | ----------------------------------------------------------------------------------------------------- |
| A     | `check.ts` passes with 290 per indicator; every figure reconciled against a second read               |
| B     | A fabricated two-value indicator renders, explains itself, and is playable — asserted, and looked at  |
| C     | `share-65-plus` renders against the national median, or the field is gone and the schema test says so |

Highest-stakes rule applies throughout: `kitchen/src/indicators/**` and `shared/pantry.ts` are
TDD-only per `workflow-config.md`.
