# Plan 14: Indicators become definitions

The second plan of [the fourth slice](2026-09-17-fourth-slice-design.md). It adds no indicator and
changes no published number. It changes what an indicator _is_, so that the fifteen in plan 15 cost
a definition each rather than a module each.

Source: [fourth slice design](2026-09-17-fourth-slice-design.md) §3.1 and §3.3. Follows
[Plan 13](2026-09-17-13-the-pantry-splits.md), which is merged.

## What was checked before this was written

Measured against `dc3bbd5`.

| Checked                                  | Found                                                                                                                                                                                                            |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| What an indicator costs today            | 2,919 lines across nine modules under `kitchen/src/indicators/`, from 153 (`tax.ts`) to 696 (`derived.ts`, which carries three indicators). Ten indicators took a whole plan.                                    |
| What the modules actually have in common | Every one builds a `Selection` of the same shape: `Region` filtered to the 290 four-digit codes, each other dimension either totalled or given explicit values, `ContentsCode` resolved **by label**, and `Tid`. |
| Where they genuinely differ              | Which dimensions are totalled; whether values are explicit (share-65-plus selects single ages 65+); how many tables are stitched (migration 3, population 2, share-65-plus 2); and what is derived from what.    |
| The stitching cases                      | `population` (TAB638 + TAB5557 CKM), `net-migration-rate` (TAB1211 + TAB1212 + TAB6640), `share-65-plus` (TAB638 + TAB5557). Later tables win for overlapping years.                                             |
| The two existing safety rails            | `TOTAL_CODES` (which code means "total" per dimension) and `SUM_SAFE` (table+dimension pairs where summing every value is verified exact). Both are allowlists that throw rather than guess, and both must stay. |
| What similarity reads                    | `buildSimilar(data)` walks `data.indicators` — **all of them**, whatever they are. Nothing names the ten.                                                                                                        |
| The gate that proves this plan           | `yarn kitchen publish` must leave `public/pantry/` byte-identical, which CI already enforces. A rewrite of the pipeline that changes nothing at all.                                                             |

## The decisions this plan makes

**D1 — A definition is data; a builder is code.** Each indicator becomes a record naming its
sources and one builder, plus optional modifiers. The builders are the only new code, and there
are five:

| Builder      | Means                                             | Existing users                                                   |
| ------------ | ------------------------------------------------- | ---------------------------------------------------------------- |
| `direct`     | Select a cell and publish it                      | `population`, `mean-age`, `tax-rate`, `density`, `median-income` |
| `share`      | Part ÷ whole, as a percentage                     | `share-65-plus`, `post-secondary-education`                      |
| `rate`       | Count ÷ population, per 1,000                     | `net-migration-rate`                                             |
| `change`     | Year on year, as a percentage                     | `population-change`                                              |
| `difference` | One selection minus another, in the source's unit | **new**, unused until plan 15                                    |

Two modifiers: `inflation-adjust` (`median-income`, `house-prices`) and `min-count`
(`house-prices`).

**D2 — A source is a table, a content LABEL, a per-dimension rule and a year range.** Content codes
stay resolved by their stable Swedish label rather than hardcoded, per decision 0001's trap 2. A
dimension rule is `total` (via `TOTAL_CODES`, falling back to `SUM_SAFE`, throwing otherwise),
`values` (an explicit list) or `all`.

**D3 — Stitching is a property of the definition, not a bespoke module.** A definition may name
several sources; later ones win for years they both cover. This is what `population`,
`net-migration-rate` and `share-65-plus` already do by hand.

**D4 — `TOTAL_CODES` and `SUM_SAFE` do not move and do not soften.** They are the difference
between a correct total and one that silently overcounts by a multiple. A declarative format that
made summing the default would be a worse pipeline with less code.

**D5 — Similarity names its indicators.** `buildSimilar` takes an explicit core set — the current
ten — rather than everything in the pantry. Updates decision 0002.

**D6 — `derivation` stays hand-written.** It is prose explaining how a figure was computed, in a
sentence a reader can check. Generating it from the definition would produce something true and
unreadable, and it is published in the pantry.

## What this plan does not do

- Adds no indicator, and changes no published value. Any diff in `public/pantry/` is a defect.
- Does not touch the site, the tools, or the pantry's file layout.
- Does not change `shared/pantry.ts`.
- Does not remove `TOTAL_CODES` or `SUM_SAFE`.

## Tasks

Sequential. Each ends with the suite green and the pantry byte-identical.

### Task 1 — The source resolver

One function that turns a declared source into fetched rows: resolve the content code by label,
build the selection from the dimension rules, freeze, and return rows keyed by region and year.
Stitching across several sources belongs here, later sources winning.

**Acceptance:** Given `tax-rate`'s declared source, it produces the same rows `taxSelection` +
`freezeData` produce today, offline from `kitchen/raw/`. A dimension with no total code and no
`SUM_SAFE` entry throws, naming the table and dimension.
**Verify:** `yarn test kitchen`. **TDD:** `kitchen/src/indicators/**` is highest-stakes.

### Task 2 — The five builders and the two modifiers

Each takes resolved rows and produces an `IndicatorSeries`, carrying the existing status rules
unchanged: `did-not-exist` before a municipality existed, `not-yet-published` for a missing cell,
`perturbed` where CKM applies, `too-few-cases` under `minCount`, `structural-break` from
`breaks.ts`.

**Acceptance:** Each builder reproduces its existing indicator's series exactly, asserted against
the published pantry rather than against a fixture.
**Verify:** `yarn test kitchen`.

### Task 3 — Migrate the ten, one at a time

In increasing order of difficulty: `tax-rate`, `density`, `mean-age`, `median-income`,
`house-prices`, `post-secondary-education`, `population`, `share-65-plus`, `net-migration-rate`,
`population-change`.

**Acceptance:** after each, `yarn kitchen publish` leaves `public/pantry/` byte-identical.
**Verify:** `yarn kitchen publish && git diff --exit-code public/pantry/`.

### Task 4 — Delete what the definitions replace

The per-indicator build functions and their selection helpers. What stays: the indicator metadata
(names, descriptions, caveats, derivations), `TOTAL_CODES`, `SUM_SAFE`, `breaks.ts`, `round.ts`,
`check.ts`, the CPI fetch, and every module's tests that assert real figures.

**Acceptance:** `kitchen/src/indicators/` is smaller by more than half, and the pantry is still
byte-identical.

### Task 5 — Similarity names its ten

An explicit `CORE_INDICATORS` list, with `buildSimilar` refusing an indicator it does not name
rather than silently including it.

**Acceptance:** `data/similar.json` byte-identical. Adding an eleventh indicator to a test pantry
does not change one neighbour.
**Verify:** `yarn test kitchen`; the published file's diff is empty.

### Task 6 — Prove it, then write it down

**Acceptance:** the measurement table below, a decision record, and `docs/kitchen.md` describing
what a definition is — since the next person adding an indicator reads that, not this.
**Verify:** `yarn typecheck && yarn lint && yarn test && yarn build && yarn e2e`; `yarn budget`.

## Verification, in one line each

| Task | Signal                                                                  |
| ---- | ----------------------------------------------------------------------- |
| 1    | Declared source reproduces today's rows; an unsafe total throws by name |
| 2    | Each builder reproduces its indicator's published series                |
| 3    | `public/pantry/` byte-identical after each of the ten                   |
| 4    | Indicator code more than halved; pantry still byte-identical            |
| 5    | `data/similar.json` byte-identical; an unnamed indicator cannot slip in |
| 6    | Full gate green; docs and decision record written                       |

## What must be measured when it is done

| Gate                                  | Target                               | Result |
| ------------------------------------- | ------------------------------------ | ------ |
| `public/pantry/` after the migration  | **byte-identical**                   |        |
| Lines under `kitchen/src/indicators/` | less than half of 2,919              |        |
| What an eleventh indicator would cost | record it — this is the plan's point |        |
| Unit tests                            | no loss against 1,218                |        |
| Browser tests                         | no loss                              |        |

## Stop conditions

Per the workflow, and one specific to this plan: **if the pantry is not byte-identical after any
single indicator's migration, stop and diff before migrating another.** Ten indicators migrated
together with one diff between them is a bisect nobody wants; the gate is per indicator for that
reason.
