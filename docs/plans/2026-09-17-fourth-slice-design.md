# Third slice — more of the source

**Design document.** The implementation plans (13, 14, 15) are written one at a time from this, just
before each is executed, as every slice before it has been.

Input: [the question list](../research/2026-09-17-question-list.md), verified against live SCB v2
metadata on 2026-09-17.

---

## 1. What this slice is

The site publishes ten indicators. The source publishes 1,110 annual tables carrying a region
variable. This slice takes the site to **25 indicators chosen question-first**, and — more
importantly — changes the pipeline so that the twenty-sixth costs a definition rather than a
module.

It also ships the first **combinations**: indicators computed from other indicators, so the site
can answer questions no single SCB table answers. Two of them need no new data at all.

What this slice is not: a harvester. Nothing here generates indicators automatically, and the
count stays a number a person chose.

## 2. Decided before this document

Four decisions were taken in conversation on 2026-09-17 and are recorded here because everything
below depends on them. Each needs its own record under `docs/decisions/` before the first plan
executes.

| Decision                                                                     | Consequence for this slice                                                                                |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **Broad but curated**, not exhaustive and not two-tier                       | One quality bar. Every indicator keeps a hand-written caveat and verified-figure tests. DESIGN §1 stands. |
| **Flat shape** — each breakdown is its own indicator, not an axis            | No value semantic in `shared/pantry.ts` changes (see D6). The indicator-id scheme becomes load-bearing.   |
| **Combination happens in the kitchen**, as curated derived indicators        | No browser-side arithmetic. Fixed colour breaks across years survive intact.                              |
| **Curation is question-led**, with no coverage-balance or series-length gate | Short and ragged series are allowed in, and handled honestly rather than excluded.                        |

## 3. Three structural changes

### 3.1 An indicator becomes a definition, not a module

Today each indicator is a hand-written TypeScript module under `kitchen/src/indicators/` with its
own `build()`. That is why ten took a whole plan.

The existing ten decompose into **four builders and two modifiers**, with one builder added for
this slice:

| Builder      | Means                                             | Existing users                                                   |
| ------------ | ------------------------------------------------- | ---------------------------------------------------------------- |
| `direct`     | Select a cell and publish it                      | `population`, `mean-age`, `tax-rate`, `density`, `median-income` |
| `share`      | Part ÷ whole, as a percentage                     | `share-65-plus`, `post-secondary-education`                      |
| `rate`       | Count ÷ population, per 1,000                     | `net-migration-rate`                                             |
| `change`     | Year on year, as a percentage                     | `population-change`                                              |
| `difference` | One selection minus another, in the source's unit | **new** — Q1, Q12, Q29                                           |

| Modifier           | Means                                 | Existing users                  |
| ------------------ | ------------------------------------- | ------------------------------- |
| `inflation-adjust` | Express in a fixed year's kronor      | `median-income`, `house-prices` |
| `min-count`        | Suppress cells below a case threshold | `house-prices`                  |

A definition therefore becomes data: source table, content code, selection, builder, modifiers,
unit, scale kind, bilingual caveat, derivation sentence. Multi-table stitching (already needed by
`net-migration-rate`, and needed again by the CKM continuations in this slice) stays a property of
the definition, not a bespoke module.

**This change is verifiable to an unusual standard.** Migrating the existing ten onto the
declarative path must leave `public/pantry/` **byte-identical**, which CI already enforces on every
pull request. A rewrite of the pipeline that proves itself by changing nothing at all.

### 3.2 The pantry becomes many files

Measured today: ten indicators are 1.0 MB raw, **276 kB gzipped**, in one `indicators.json` that
`src/data/pantry.ts` fetches eagerly before first paint. Twenty-five would be roughly **690 kB
gzipped** on the same path. That is not shippable, and it is the one thing in this slice that is a
regression rather than a cost.

So: a slim index plus one file per indicator.

- **Index** carries what the picker, the URL parser and the legend need for _every_ indicator: id,
  bilingual name, unit, scale kind and breaks, coverage, and the price fields. Built and measured
  while writing [plan 13](2026-09-17-13-the-pantry-splits.md): **6,471 bytes gzipped at ten
  indicators and 6,524 at twenty-five** — it barely grows, because the 290 municipalities dominate
  it. An earlier estimate here said ~15 kB; that was a guess, and the measurement replaced it.
- **Per-indicator file** carries the series and the prose. Fetched when the indicator is chosen.
- A visitor loads the index plus one series, not twenty-five.

`loadPantry()` becomes index-first and the `PantryData` schema splits accordingly. The profile and
compare views need several series at once and request them together.

### 3.3 The core set becomes explicit

"Places like this" ([decision 0002](../decisions/0002-similarity-metric.md)) is computed over _all
indicators, one vote each_. Adding fifteen would silently change every neighbour on the site, and
every link anyone has shared to one.

So similarity gets pinned to an explicit **core set — the current ten** — before any new indicator
lands. This is not a preference; it is the difference between published answers staying true and
quietly becoming something else.

## 4. What ships

Fifteen new indicators, from eleven new sources, taking the site to twenty-five. Eleven sources are
thirteen table ids, because births and deaths each need a CKM continuation table for 2025 — the
same stitching the existing `net-migration-rate` already does. Every source below
is verified: 290 municipality codes, real content code, real coverage.

| Indicator id                   | The question it answers                          | Source                         | Coverage  | Builder            |
| ------------------------------ | ------------------------------------------------ | ------------------------------ | --------- | ------------------ |
| `house-price-to-income`        | How many years of income does a house cost?      | **pantry only**                | 1999–2024 | difference         |
| `post-secondary-education-gap` | Where do women and men differ most in education? | **already frozen** (`TAB3981`) | 1985–2025 | difference         |
| `natural-change-rate`          | Are more people born here than die here?         | `TAB1264`/`TAB960` + CKM       | 1968–2025 | difference + rate  |
| `fertility-rate`               | How many children are people having?             | `TAB4805` `000001J4`           | 2000–2025 | direct             |
| `dependency-ratio`             | A place of children, or of pensioners?           | `TAB4642` `00000708`           | 2000–2025 | direct             |
| `employment-rate`              | How many people here have a job?                 | `TAB3200` `000002NS`           | 2020–2024 | direct             |
| `unemployment-rate`            | How many are out of work?                        | `TAB3200` `000002NN`           | 2020–2024 | direct             |
| `taxable-income-per-resident`  | Can this municipality afford itself?             | `TAB3600` `OE0101A0`           | 1995–2026 | direct + inflation |
| `disposable-household-income`  | What does a household have left to live on?      | `TAB1492` `000006SY`           | 2011–2024 | direct             |
| `dwellings-completed-rate`     | Is anyone building here?                         | `TAB2538` `BO0101A5`           | 1968–2025 | rate               |
| `dwellings-per-1000`           | Is there enough housing for the people?          | `TAB824` `BO0104AH`            | 1990–2025 | rate               |
| `share-houses`                 | A place of houses, or of flats?                  | `TAB824`, by `hustyp`          | 1990–2025 | share              |
| `share-rentals`                | Do people here rent or own?                      | `TAB824`, by `upplåtelseform`  | 1990–2025 | share              |
| `median-rent`                  | What does renting cost?                          | `TAB4590` `000000J4`           | 2016–2025 | direct + inflation |
| `greenhouse-gas-per-resident`  | Are this place's emissions falling?              | `TAB4357`, substance `GHG`     | 2008–2022 | rate               |

Three tables yield more than one indicator (`TAB3200`, `TAB824`, and the birth/death pair), which
is the ordinary case the definition format must handle well rather than an optimisation.

`dwellings-completed-rate` is published from 1968 although `TAB2538` reaches back to 1938, because
the rate needs a population denominator and the population series starts in 1968. The earlier
counts exist and are simply not used; that belongs in the caveat.

## 5. Deliberately not in this slice

Each of these is wanted and each is deferred for a stated reason, not forgotten.

| Deferred                                                   | Why                                                                                                                    |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Life expectancy (Q3), elected representatives (Q21)        | Published by five-year window and mandate period. `IndicatorSeries.years` is a list of integers and cannot say that.   |
| Turnout and the turnout gap (Q19, Q20)                     | 15 values across 50 slider positions. Needs a design answer for sparse series that does not exist yet.                 |
| Land use, farmland, nature access, holiday homes (Q23–Q27) | Two or three time points each. Same sparse-series question.                                                            |
| Commuting in and out (Q10, Q11)                            | Three tables stitched, and the series stops in 2021. Worth doing, not worth doing first.                               |
| Cars, persons per household (Q28, Q18)                     | Straightforward and uncontroversial. Held back only to keep this slice at a size that can be finished.                 |
| "Share 65+ against the national share" (Q30)               | Not an indicator. `scale.reference: 'national-median'` already exists in the contract; this is a scale, not a measure. |

The first three lines are one question wearing three hats: **what does this site do with a measure
that has five values?** That deserves its own design pass, with the map, the slider and the play
button all in the room.

## 6. Decisions this slice forces

Each becomes a record under `docs/decisions/`.

- **D1 — The indicator id scheme.** `?i=` is a permanent promise. Rule: kebab-case, names the
  measure and never the table; a sex split takes `-women` / `-men`; a difference takes `-gap`; a
  per-capita measure takes `-rate` or `-per-1000`. An id, once published, never changes meaning.
- **D2 — Verify the municipality count at build time.** Four candidates in the question list were
  labelled "efter region" and had one, five or six regions. `check.ts` must assert 290 for every
  definition rather than trust the catalogue.
- **D3 — Similarity is pinned to the core ten.** §3.3. Updates decision 0002.
- **D4 — The facts engine sees all twenty-five.** The payoff of breadth is better facts, so the
  new indicators feed it — but ADR 0003's noise bound is expressed per indicator in that
  indicator's own unit, and must be re-derived for each of the fifteen rather than inherited.
- **D5 — DESIGN §8 is wrong about nature data.** `TAB4357` publishes municipal greenhouse gases.
  The sentence gets corrected and the correction gets a record.
- **D6 — This slice changes the pantry's container, and none of its value semantics.**
  `Indicator`, `IndicatorSeries`, `Municipality` and `OBSERVATION_STATUS` are untouched — the
  enum whose index is a persisted byte in every published cell does not move. What does change is
  how those values are packaged into files: [plan 13](2026-09-17-13-the-pantry-splits.md) adds
  `PantryIndex`, `IndicatorMeta` and `PantryIndicator` beside `PantryData`. Deferring the
  period-based indicators (§5) is what keeps the distinction clean, and it is worth keeping:
  a container can be revised, a status byte cannot.

  _Corrected 2026-09-17._ As first written this read "does not touch `shared/pantry.ts`", which
  plan 13 falsified the moment it was drafted — the split cannot be expressed without new schemas
  in that file. The claim worth making was always about semantics, not about the file.

- **D7 — `compare` needs no change yet.** "Higher on 17 of 25" is still a sentence a person can
  use. Revisit past roughly forty.

## 7. Verification

Stage by stage, each with a signal that can fail.

| Stage                   | Signal                                                                                                                                                                                                         |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Declarative pipeline | `yarn kitchen publish` leaves `public/pantry/` **byte-identical**. CI already fails on any diff.                                                                                                               |
| 2. Split delivery       | Index + per-indicator files; gzipped index measured and recorded; `yarn e2e` green across three engines.                                                                                                       |
| 3. Fifteen indicators   | Per-indicator headline-figure tests read off the published pantry, as `src/indicators.headline.test.ts` does today. `check.ts` passes, including the new 290 assertion. Determinism holds on a second publish. |
| Throughout              | `yarn typecheck && yarn lint && yarn test && yarn build`; axe in CI; the Lighthouse budget's median of three.                                                                                                  |

Highest-stakes rule applies: every builder and modifier is `kitchen/src/indicators/**`, so it is
**TDD-only** per `workflow-config.md`. Test from the definition before the implementation exists.

## 8. Risks

1. **Freeze size.** `TAB1264` and `TAB960` are age × sex cubes. The comparable table already in the
   pantry, `TAB638`, is **48 MB frozen** — 90% of the repo's entire raw directory. Mitigation:
   select totals server-side, which `TOTAL_CODES` / `SUM_SAFE` in the registry already exist to
   express. **Measure before freezing**, and treat a large freeze as a reason to redesign the
   selection rather than a cost to absorb.
2. **The profile panel renders one sparkline per indicator.** Twenty-five of them is 2.5× today's
   work on a page whose performance budget already sits at 83–84. Needs measuring in stage 3, with
   grouping or deferred rendering held in reserve.
3. **The facts strip changes character.** More indicators means more candidate facts, and the
   strip picks five. The facts may simply become different overnight, which is correct behaviour
   and will still be surprising. D4's per-indicator noise bounds are the guard.
4. **Emissions end in 2022.** Three years behind the slider's other end. Honest, flagged in the
   caveat, and worth knowing before it ships rather than after.

## 9. Settled, and still open

Settled by the architect on 2026-09-17:

1. **Fifteen it is.** §4 is the list. It was a size that could be finished rather than a size that
   was measured, and that was accepted as the reason.
2. **The pantry split ships on its own**, ahead of any new indicator — its own plan, its own pull
   request. It is invisible to visitors and independently valuable, and shipping it first means the
   declarative migration's byte-identical proof (§3.1) runs against the layout the slice will
   actually keep, rather than against a layout about to be replaced.

Still open:

3. **Sparse series** (§5) — whether that design pass happens next, or after this slice lands.

### Plan order that follows

| Plan | Covers                                                                        | Proves itself by                                      |
| ---- | ----------------------------------------------------------------------------- | ----------------------------------------------------- |
| 13   | The pantry split: index plus one file per indicator (§3.2)                    | Same ten indicators, `yarn e2e` green, index measured |
| 14   | Indicators become definitions; similarity pinned to the core ten (§3.1, §3.3) | `public/pantry/` byte-identical                       |
| 15   | The nine hand-written implementations go, and their assertions find new homes | `public/pantry/` byte-identical; the net named        |
| 16   | The fifteen (§4), with D1–D5 recorded                                         | Headline-figure tests per indicator; determinism      |

_Renumbered 2026-09-18._ As first written this table said 12/13/14, from before plan 12 was taken
by releases. Plan 15 was added after issue #28 forced the deletion to be a change of its own —
before the fifteen rather than after, because plan 16 adds indicators with nothing to be
byte-identical to, so the net plan 15 leaves is the net they inherit.
