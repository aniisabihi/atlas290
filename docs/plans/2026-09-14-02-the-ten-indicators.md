# Plan 2: The Ten Indicators

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Grow the pantry from one indicator to ten, each with an exact definition, honest per-cell statuses, inflation adjustment where money is involved, fixed colour breaks, and a check stage that refuses to publish anything suspicious.

**Architecture:** Plan 1 built a pipeline shaped around a single hardcoded indicator. This plan generalises it into a registry of indicator definitions sharing one fetch-and-build path, adds a national consumer price index series used by two money indicators, adds three derived indicators computed from data already fetched, flags the structural breaks where municipalities split, and gates publishing behind a check stage.

**Tech Stack:** Unchanged from Plan 1 — Node 22, Yarn 4, TypeScript strict, Vitest, zod, d3, mapshaper.

**Spec:** [docs/DESIGN.md](../DESIGN.md), sections 2 (decisions), 4 (data model and the ten indicators), 8 (known limitations).

## Global Constraints

- SCB PxWeb API v2 only, base `https://statistikdatabasen.scb.se/api/v2`. Never v1.
- SCB limits: 150,000 cells per query, 30 calls per 10 seconds per IP. All network access goes through `freezeData`/`freezeMetadata`, which chunk, rate-limit and cache.
- **All fetching happens in the kitchen.** Raw responses are frozen to `kitchen/raw/` and committed; every later stage runs offline.
- **Determinism:** publishing twice from the same frozen data yields byte-identical files. No timestamps, no randomness, sorted keys, structural (never locale-aware) comparisons.
- **Municipality identity:** the 290 codes derived from the population table are the authority. Never re-derive municipalities by pattern-matching another table's region list.
- **Absence is never zero.** A municipality that did not exist in a year has a null value and the status `did-not-exist`, regardless of what SCB sent.
- **Never sum across overlapping cells.** Select one total code per dimension where one exists; summing is opt-in per table and dimension through the `SUM_SAFE` allowlist.
- Both languages on every human-readable name.
- Conventional Commits. Commit trailer, exactly: `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- Never `--no-verify`. Work on `feat/plan-02-indicators`; do not push, merge or change branches from inside a task.

## Verified SCB facts

Established by live reconnaissance on 2026-09-14 against the real API, not from research notes. Plan 1 lost several review rounds to planning against notes; these were checked.

| Indicator            | Table(s)                  | Content code                                 | Years     | Notes                                                                        |
| -------------------- | ------------------------- | -------------------------------------------- | --------- | ---------------------------------------------------------------------------- |
| Population           | TAB638, TAB5557           | resolved by label "Folkmängd"                | 1968–2025 | Built in Plan 1                                                              |
| Net migration        | TAB1211, TAB1212, TAB6640 | "Flyttningsöverskott"                        | 1968–2025 | **Three** tables. Net migration is published directly; do not subtract flows |
| Median income        | TAB3554                   | "Medianinkomst, tkr" (HE0110J8)              | 1999–2024 | `Alder` has `tot16+`; `Kon` has `1+2`; `Inkomstklass` has `TOT`              |
| Education            | TAB3981                   | "Antal" (000000I2)                           | 1985–2025 | Counts by level, so the share is derived. `Alder` has `tot16-74`             |
| House prices         | TAB1169                   | "Köpeskilling, medelvärde i tkr" and "Antal" | 1981–2025 | `Fastighetstyp` 220 is permanent homes, 221 holiday homes                    |
| Tax rate             | TAB2017                   | "Skattesats, total kommunal"                 | 2000–2026 | Runs a year ahead of every other indicator                                   |
| Density              | TAB628                    | "Invånare per kvadratkilometer"              | 1991–2025 | `Kon` has `1+2`                                                              |
| Consumer price index | TAB4352                   | "Index" (000000KL)                           | 1980–2025 | **No `Region` dimension.** A single national series                          |

Four traps this uncovered, each of which would otherwise have become a defect:

1. **The four-digit filter is unsafe on other tables.** TAB1212's region list has 293 four-digit codes, three of which are not municipalities: `0010` Stor-Stockholm, `0020` Stor-Göteborg, `0030` Stor-Malmö. Join against the known 290 instead.
2. **The same concept has a different content code in every table, and in every era of the same table.** Net migration is `BE0101C5` for 1968–1996, `BE0101AZ` for 1997–2024 and `00000868` for 2025. Only the Swedish label `Flyttningsöverskott` is stable. Plan 1's label-based resolution is therefore the right mechanism and must be used everywhere.
3. **Total codes vary by table.** Plan 1's allowlist knows `tot`, `TotSA`, `TOT1`, `TotSa` and `SC`. The new tables add `1+2` (sex), `tot16+` (income age), `tot16-74` (education age) and `TOT` (income class).
4. **Median income has no age total in the per-age table.** TAB3556 publishes medians by single year of age, and medians cannot be summed. TAB3554 is the correct table because it carries `tot16+`.

**One open question for the architect, deliberately not decided here.** TAB3554 covers residents present the whole year, 1999–2024. TAB3558 is the same measure for residents present on 31 December and reaches back to **1991**, eight years further. The two are different populations and must not be mixed. This plan uses TAB3554 by default as the conventional measure; Task 7 records the choice and switching is a one-line change.

## File structure

```
kitchen/src/indicators/
  registry.ts            the list of indicator definitions and the shared build path
  registry.test.ts
  population.ts          existing; refactored to a definition in the registry
  cpi.ts                 national consumer price index, and the deflator helper
  cpi.test.ts
  migration.ts           net migration per 1,000 residents
  income.ts              median earned income, inflation-adjusted
  education.ts           share with post-secondary education
  housing.ts             mean price of sold single-family houses, inflation-adjusted
  tax.ts                 municipal tax rate
  density.ts             population density
  derived.ts             population change, median age, share aged 65 and over
  derived.test.ts
kitchen/src/check.ts     the check stage: refuses to publish anything suspicious
kitchen/src/check.test.ts
kitchen/src/breaks.ts    parent-municipality break flagging
kitchen/src/breaks.test.ts
kitchen/spikes/age-distribution-cost.ts   one-off probe, Task 2
```

---

### Task 1: Close Plan 1's parked items

**Files:**

- Modify: `kitchen/src/indicators/population.ts`, `kitchen/src/indicators/population.test.ts`

**Interfaces:**

- Produces: `buildPopulationSeries(municipalities, oldChunks, newChunks, years, perturbedFrom?)` — the perturbation year becomes an optional parameter defaulting to `CKM_FROM`, so a test can pass a value distinct from both constants.

Plan 1 parked two items. Both have verified-correct production code; both are tests that cannot yet fail.

- [ ] **Step 1: Write the failing test for the year-constant distinction**

The existing test cannot discriminate `CKM_FROM` from `LATEST_YEAR` because both are 2025. Add a test that passes an explicit perturbation year different from both:

```ts
it('marks perturbed from the perturbation year, not from the latest published year', () => {
  const series = buildPopulationSeries(
    municipalities,
    [oldChunk],
    [newChunk],
    [2002, 2003, 2025],
    2003,
  )
  const status = (i: number, j: number) => OBSERVATION_STATUS[series.status[i]![j]!]
  expect(status(1, 0)).toBe('present') // 2002, before the perturbation year
  expect(status(1, 1)).toBe('perturbed') // 2003, the perturbation year itself
  expect(status(1, 2)).toBe('perturbed') // 2025, after it
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `yarn vitest run kitchen/src/indicators/population.test.ts`
Expected: FAIL, because `buildPopulationSeries` takes no perturbation-year parameter.

- [ ] **Step 3: Add the parameter**

Give `buildPopulationSeries` a final optional parameter `perturbedFrom: number = CKM_FROM` and use it in the status rule in place of the constant. Change nothing else.

- [ ] **Step 4: Move the empty-input guard into `quantileBreaks`**

`withBreaks` throws on an empty value list; `quantileBreaks` itself still returns zero-valued breaks if called directly. Move the throw into `quantileBreaks`, naming the indicator, and keep `withBreaks` working. Add a test calling `quantileBreaks([], 7)` directly and asserting it throws.

- [ ] **Step 5: Verify and commit**

Run: `yarn typecheck && yarn test && yarn lint`
Expected: all clean, previous behaviour unchanged.

```bash
git add kitchen/src/indicators/population.ts kitchen/src/indicators/population.test.ts
git commit -m "test(kitchen): close plan 1's parked items

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Spike — can median age and share 65+ be built at all?

This task touches the network and produces a decision, not product code. Its outcome determines whether Task 11 is feasible as designed.

**The problem.** Median age and share aged 65 and over both need population broken down by age. Plan 1 deliberately fetched only the age _total_ — 290 cells per year. The full distribution is 290 municipalities × 102 ages × 2 sexes × 4 marital states × 57 years ≈ 13.5 million cells, which at roughly 10–20 bytes per cell would add 150–250 MB of frozen JSON to the repository. That is not viable: GitHub warns above 50 MB per file and the repository should stay well under 1 GB.

**What to find out.** SCB's v2 metadata exposes server-side aggregation codelists. Plan 1's research recorded `agg_Ålder5år` and `agg_Ålder10årJ` on TAB638. Establish:

1. Which aggregation codelists TAB638 and TAB5557 actually offer for `Alder`, and whether any exist for `Kon` or `Civilstand`.
2. The real cell count and frozen byte size for each viable option: single years, five-year groups, ten-year groups.
3. Whether a five-year or ten-year grouping is enough to compute a usable interpolated median age, or whether it forces an approximation the design should acknowledge.
4. Whether SCB publishes mean or median age per municipality directly in some other table, which would make the whole question moot.

- [ ] **Step 1: Probe the codelists**

Write `kitchen/spikes/age-distribution-cost.ts`. Read TAB638's and TAB5557's raw metadata from `kitchen/raw/` where already frozen, and print every codelist offered per dimension. The v2 metadata exposes these under each variable; if the project's `parseMetadata` does not surface them, read the raw JSON directly rather than changing the parser.

- [ ] **Step 2: Measure, do not estimate**

For each viable option, fetch **one year for all 290 municipalities** and record the actual frozen file size. Multiply by the number of years for a real projection. Do not guess at bytes per cell.

Respect the limits: a single year of five-year groups is roughly 290 × 21 × 2 × 4 = 48,720 cells, comfortably inside one query. A single year of single ages is 236,640 cells and must chunk.

- [ ] **Step 3: Search for a direct table**

Query `/tables?query=medelålder region` and similar. If SCB publishes mean age per municipality directly, report the table, its coverage and its content code.

- [ ] **Step 4: Record the decision**

Write the findings into `docs/kitchen.md` under a new heading, with the measured sizes. State plainly which option Task 11 should use and why. If no option is viable, say so — dropping or redefining an indicator is a legitimate outcome and better than a repository nobody can clone.

- [ ] **Step 5: Commit the spike and its findings**

```bash
git add kitchen/spikes/age-distribution-cost.ts kitchen/raw docs/kitchen.md
git commit -m "docs(kitchen): measure the cost of population by age

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: The indicator registry

**Files:**

- Create: `kitchen/src/indicators/registry.ts`, `kitchen/src/indicators/registry.test.ts`
- Modify: `kitchen/src/indicators/population.ts`, `kitchen/src/publish.ts`

**Interfaces:**

- Produces:
  - `interface IndicatorDefinition { indicator: Indicator; build(ctx: BuildContext): Promise<IndicatorSeries> }`
  - `interface BuildContext { municipalities: Municipality[]; years: number[]; freeze: FreezeOpts; frozen: Array<FrozenData | FrozenMeta>; cpi?: Map<number, number>; series: Map<string, IndicatorSeries> }`
  - `const REGISTRY: IndicatorDefinition[]`
  - `buildAll(opts?: FreezeOpts): Promise<{ municipalities, indicators, series, frozen }>`

The point is that ten indicators share one path: resolve codes by label, select one total per dimension, fetch through freeze, map onto the known 290 municipalities, apply the status rule, compute fixed breaks. A new indicator should be a definition, not a new pipeline.

`series` in the context lets derived indicators read ones already built. `cpi` is populated by Task 4.

- [ ] **Step 1: Write the failing test**

Assert that `buildAll` returns one series per registered indicator, that every series has exactly `municipalities.length` rows, that every indicator id is unique, and that a definition whose series has the wrong row count causes a throw naming the indicator.

- [ ] **Step 2: Run it and watch it fail**

Run: `yarn vitest run kitchen/src/indicators/registry.test.ts`

- [ ] **Step 3: Implement the registry, then move population into it**

Extract the shared machinery from `population.ts`: the label-resolved content code, the one-total-per-dimension selection, the region-to-municipality mapping, the status rule and `withBreaks`. Population becomes the first registry entry and must produce **byte-identical output** to what is committed.

- [ ] **Step 4: Prove population is unchanged**

Run `yarn kitchen publish` and confirm `git status` shows no change to `public/pantry/data/indicators.json`. If it does, the refactor altered behaviour; fix the refactor rather than accepting the diff.

- [ ] **Step 5: Verify and commit**

---

### Task 4: Consumer price index and inflation adjustment

**Files:**

- Create: `kitchen/src/indicators/cpi.ts`, `kitchen/src/indicators/cpi.test.ts`

**Interfaces:**

- Consumes: `freezeData`, `freezeMetadata`, `toRows`.
- Produces:
  - `CPI_TABLE = 'TAB4352'`
  - `fetchCpi(opts?: FreezeOpts): Promise<{ index: Map<number, number>; frozen: Array<FrozenData | FrozenMeta> }>`
  - `toCurrentKronor(value: number, fromYear: number, index: Map<number, number>, targetYear: number): number`

TAB4352 has no `Region` dimension, so its fetch shape differs from every other indicator: it is a single national series of 46 annual index values on a 1980 = 100 base.

- [ ] **Step 1: Write the failing test**

```ts
it("converts a past value into the target year's kronor", () => {
  const index = new Map([
    [2000, 100],
    [2024, 200],
  ])
  expect(toCurrentKronor(50, 2000, index, 2024)).toBe(100)
  expect(toCurrentKronor(200, 2024, index, 2024)).toBe(200)
})

it('throws naming the year when the index has no entry for it', () => {
  const index = new Map([[2024, 200]])
  expect(() => toCurrentKronor(50, 1999, index, 2024)).toThrow(/1999/)
})
```

A missing index year must throw, never silently pass the nominal value through — a nominal figure presented as inflation-adjusted is exactly the kind of quiet wrongness this pipeline exists to prevent.

- [ ] **Step 2–5: Run, implement, re-run, commit**

Fetch the real series and assert in a test that the index rises monotonically over the covered period and that 1980 is 100.

---

### Task 5: Tax rate and population density

**Files:**

- Create: `kitchen/src/indicators/tax.ts`, `kitchen/src/indicators/density.ts` and their tests

The two simplest indicators, done together because they exercise the registry with no derivation and no inflation.

- **Tax rate**: TAB2017, content "Skattesats, total kommunal", 2000–2026, no dimensions beyond region and year. Unit `percent`. Note it extends a year beyond every other indicator, which the check stage in Task 12 must tolerate.
- **Density**: TAB628, content "Invånare per kvadratkilometer", 1991–2025, `Kon` total `1+2`. Unit `per-km2`. The same table's land-area content code can fill `Municipality.landAreaKm2`, which the schema has carried as optional since Plan 1.

- [ ] **Step 1: Write failing tests for both**

Assert the correct content code is resolved by label, that the `1+2` sex total is selected rather than the sexes being summed, and that years outside each indicator's coverage are `not-yet-published` rather than absent.

- [ ] **Step 2: Add `1+2` to the total-code allowlist**

`TOTAL_CODES` gains `'1+2'` for `Kon`. Add a test proving a table offering `1+2` selects it instead of falling through to summation.

- [ ] **Steps 3–6: Implement, fetch for real, verify against reality, commit**

Spot-check: Stockholm's 2024 municipal tax rate is roughly 30 percent, and its density is in the thousands per square kilometre while Arjeplog's is well under one. Report the actual figures.

---

### Task 6: Net migration per 1,000 residents

**Files:**

- Create: `kitchen/src/indicators/migration.ts`, `kitchen/src/indicators/migration.test.ts`

Three tables spanning one series: TAB1211 (1968–1996), TAB1212 (1997–2024), TAB6640 (2025). The content code differs in all three and only the label `Flyttningsöverskott` is stable. TAB6640 carries the perturbed 2025 shape with `TotSa` and `TOT1`.

The published figure is a count, so a map of it would largely reproduce population. The design specifies a rate: net migration divided by that municipality's population in the same year, times 1,000. Population is already in the registry, so read it from the build context rather than refetching.

- [ ] **Step 1: Write the failing test**

Cover: the three-table stitch produces one continuous series; the rate is computed against the same year's population; a municipality with a null population yields a null rate rather than a division by zero; and a year before a municipality existed is `did-not-exist` even though SCB returns `0`.

- [ ] **Steps 2–6: Run, implement, fetch, spot-check, commit**

The scale hint is **diverging** around zero, not sequential: this indicator is meaningfully positive or negative and the design requires the colour scale to say so.

Spot-check a municipality known to be shrinking and one known to be growing, and report both.

---

### Task 7: Median income, inflation-adjusted

**Files:**

- Create: `kitchen/src/indicators/income.ts`, `kitchen/src/indicators/income.test.ts`

TAB3554, content "Medianinkomst, tkr", 1999–2024. Select `Alder` = `tot16+`, `Kon` = `1+2`, `Inkomstklass` = `TOT`. Values are thousands of kronor.

**Do not sum anything.** Medians are not additive; the whole reason for this table over TAB3556 is that it publishes a median for an age total.

- [ ] **Step 1: Record the population-basis decision**

Write into the indicator's `derivation` and `caveat` fields, in both languages, that this is earned income for people resident in Sweden the whole year, median, aged 16 and over, adjusted to the latest year's kronor. Note in a code comment that TAB3558 offers the same measure for residents on 31 December back to 1991, that the two populations differ and must not be mixed, and that switching is a one-line change.

- [ ] **Steps 2–6: Test, implement, fetch, spot-check, commit**

`priceBasis` is `fixed-latest-year`. Assert in a test that an early year's adjusted value is meaningfully higher than its nominal value, so a regression that dropped the adjustment would fail.

Spot-check Danderyd, which should be among the highest, against a low-income municipality, and report both nominal and adjusted figures for an early year.

---

### Task 8: House prices, inflation-adjusted, with a minimum-count rule

**Files:**

- Create: `kitchen/src/indicators/housing.ts`, `kitchen/src/indicators/housing.test.ts`

TAB1169, 1981–2025. Two content codes are needed: "Köpeskilling, medelvärde i tkr" for the price and "Antal" for the number of sales. `Fastighetstyp` must be `220`, permanent homes; `221` is holiday homes and would badly distort coastal and mountain municipalities.

The design requires a minimum-count rule: in a small municipality a mean price can rest on a handful of sales. Fetch the count alongside the price, and where it falls below the indicator's `minCount` mark the observation `too-few-cases` and null the value rather than publishing a figure built on three houses.

- [ ] **Step 1: Write the failing test**

Cover: the permanent-home property type is selected; a cell whose sale count is below the threshold is nulled and marked `too-few-cases`; a cell at or above the threshold is kept; and inflation adjustment applies.

- [ ] **Step 2: Choose the threshold deliberately**

Fetch the real sale-count distribution and look at it before picking a number. Report the distribution and how many municipality-years each candidate threshold would suppress. A threshold that suppresses a third of the map is too high; one that suppresses nothing is not doing its job. Record the reasoning in the indicator's `caveat`.

- [ ] **Steps 3–6: Implement, fetch, spot-check, commit**

---

### Task 9: Share with post-secondary education

**Files:**

- Create: `kitchen/src/indicators/education.ts`, `kitchen/src/indicators/education.test.ts`

TAB3981 publishes **counts** by education level, so the share is derived. The eight levels are:

| Code | Level                              |
| ---- | ---------------------------------- |
| 1    | Pre-upper-secondary, under 9 years |
| 2    | Pre-upper-secondary, 9 or 10 years |
| 3    | Upper-secondary, up to 2 years     |
| 4    | Upper-secondary, 3 years           |
| 5    | Post-secondary, under 3 years      |
| 6    | Post-secondary, 3 years or more    |
| 7    | Postgraduate research              |
| US   | Unknown                            |

- [ ] **Step 1: Fix the definition explicitly**

Post-secondary is levels **5, 6 and 7**. The denominator is **every level including unknown**, so the share is of the whole population aged 16–74 rather than of those whose education is recorded. Both choices go into the indicator's `derivation` and bilingual `description`, because a reader comparing this figure to SCB's own published share needs to know which convention it uses.

Select `Alder` = `tot16-74` and both sexes, summing sex only if no total code exists for it.

- [ ] **Step 2: Write the failing test**

Use a fixture with known counts across all eight levels and assert the share to a stated precision. Include a case where the unknown level is non-trivial, so the denominator choice is actually exercised.

- [ ] **Steps 3–6: Implement, fetch, spot-check, commit**

Spot-check Lund or Danderyd, which should be high, against a rural municipality, and confirm the national figure is plausible against SCB's published share.

---

### Task 10: Population change

**Files:**

- Create: `kitchen/src/indicators/derived.ts`, `kitchen/src/indicators/derived.test.ts`

The first derived indicator: percentage change in population against the previous year, computed from the population series already in the build context. No fetch.

- [ ] **Step 1: Write the failing test**

Cover: the first year of coverage has no previous year and is therefore null with status `not-yet-published`; a municipality's first year of existence has no previous year and is `did-not-exist`; a year whose previous value is null yields null rather than a nonsense percentage; and a normal year computes correctly.

The year a municipality is carved out of another is the case most likely to produce a wrong number, so test it explicitly with Knivsta.

- [ ] **Steps 2–5: Run, implement, re-run, commit**

Scale hint is **diverging** around zero. This is the indicator the design opens the site on, so its breaks matter: growth and decline must be visually distinguishable at a glance.

---

### Task 11: Median age and share aged 65 and over

**Files:**

- Modify: `kitchen/src/indicators/derived.ts`, `kitchen/src/indicators/derived.test.ts`

**Depends on Task 2.** Build these using whatever age granularity that spike found viable, and do not exceed it.

- **Share 65 and over** is a ratio of two counts and works at any granularity, provided the grouping has a boundary at 65. Confirm the chosen codelist does.
- **Median age** needs a distribution. From grouped ages it is an interpolation within the group containing the median, which is an approximation. If Task 2 forced grouping, say so in the indicator's bilingual `caveat` — a median age stated to one decimal that is actually interpolated from five-year bands should admit it.

- [ ] **Step 1: Write the failing tests**

For the median, use a fixture whose answer can be worked out by hand, and include an even-sized population where the median falls between two ages. For the share, include a municipality where the 65+ boundary falls inside a group if grouping was used.

- [ ] **Steps 2–5: Run, implement, re-run, commit**

Spot-check against reality: Sweden's median age is around 41, and the oldest municipalities are well above the youngest. Report the national figure and the extremes.

---

### Task 12: Parent breaks and the check stage

**Files:**

- Create: `kitchen/src/breaks.ts`, `kitchen/src/breaks.test.ts`, `kitchen/src/check.ts`, `kitchen/src/check.test.ts`
- Modify: `kitchen/src/publish.ts`

**Parent breaks.** `SPLIT_PARENT` has been sitting unused since Plan 1. When a municipality is carved out, its parent drops by the child's size in that year — Uppsala falls by 11,437 in 2002. For a level indicator that is a real change. For a change indicator it is an artefact of redrawing a boundary, not of people moving, and publishing it as growth or decline would be wrong.

Flag the parent's split year so derived change indicators can null it. Add a `structural-break` status, appended to `OBSERVATION_STATUS` — the list is append-only because its index is a stored byte.

**The check stage.** Runs before publishing and refuses anything suspicious:

- Exactly 290 municipalities, matching the geometry.
- Every series has one row per municipality and one column per year.
- No year outside an indicator's declared coverage carries a `present` value.
- No implausible jump that is not a flagged break: a year-on-year population change beyond a stated threshold is an error unless the cell is marked `structural-break`.
- Every value lies inside a declared plausible range per indicator — a tax rate outside 0 to 100, a share outside 0 to 100, a negative population.
- No indicator has zero non-null values.

Failures name the indicator, the municipality, the year and the value. The check stage is the thing that turns "we think the data is right" into "the build refuses to ship data that is wrong".

- [ ] **Step 1: Write the failing tests for both**

For the check stage, feed it deliberately broken inputs — one per rule — and assert each throws with a message naming the offending cell. A check stage whose rules are untested is decoration.

- [ ] **Steps 2–5: Run, implement, re-run, commit**

---

### Task 13: Publish all ten

**Files:**

- Modify: `kitchen/src/publish.ts`, `kitchen/src/publish.test.ts`, `docs/kitchen.md`

- [ ] **Step 1: Wire the registry into publish**

Publish every registered indicator, run the check stage before writing anything, and extend the manifest so each indicator's sources appear with their selection keys and resolved content codes.

- [ ] **Step 2: Confirm the size is still sane**

Report the resulting `indicators.json` size. Ten indicators over 58 years for 290 municipalities is roughly 170,000 cells; if the file approaches a megabyte, note it for Plan 3, which will have to decide whether to split per indicator for lazy loading.

- [ ] **Step 3: Prove determinism again**

Delete `public/pantry`, publish twice, confirm byte-identical output both times.

- [ ] **Step 4: Update the self-proving test**

Extend the published-pantry test to assert the headline facts for every indicator, not just population: coverage years, non-null counts, and one known real value per indicator.

- [ ] **Step 5: Update `docs/kitchen.md`**

Document every table the kitchen now fetches, with its content code and coverage. This is the page a reader consults to trace a number back to SCB.

- [ ] **Step 6: Verify and commit**

---

### Task 14: Finish the branch

- [ ] **Step 1: Full verification**

Run: `yarn typecheck && yarn lint && yarn test && yarn build && yarn kitchen publish && git status --short`
Expected: all clean, no pantry diff after republishing.

- [ ] **Step 2: Update the plans index**

Mark Plan 2 done and Plan 3 next.

- [ ] **Step 3: Present merge options to the owner**

Do not merge without their explicit choice.

---

## Self-review against the spec

**Spec coverage.** All ten indicators in DESIGN.md section 4 are covered: population (Plan 1), population change (Task 10), median age and share 65+ (Task 11), net migration (Task 6), median income (Task 7), education (Task 9), house prices (Task 8), tax rate and density (Task 5). Inflation adjustment (Task 4) serves the two money indicators as the decisions table requires. Fixed colour breaks come from the shared registry path. The check stage and parent breaks are Task 12. Per-cell statuses, the minimum-count rule, bilingual caveats and the sensitivity field are all carried by the existing `Indicator` schema from Plan 1 and populated per indicator.

**Placeholder scan.** Task 2's outcome is deliberately unknown — that is what a spike is — and Task 11 states its dependency explicitly. The income population-basis choice is flagged as an open decision with a stated default rather than left blank. No other section defers work without saying so.

**Type consistency.** `BuildContext` and `IndicatorDefinition` are defined in Task 3 and consumed by Tasks 5 to 11 under the same names. `OBSERVATION_STATUS` gains `structural-break` in Task 12 by appending, which preserves every existing stored index. `toCurrentKronor` has one signature, used by Tasks 7 and 8.

**Known risk.** This plan is large — fourteen tasks against Plan 1's twelve, and the indicator tasks are repetitive. Tasks 2 and 11 carry real uncertainty and could force a redefinition of one indicator. Tasks 5 through 9 are mechanical once Task 3 lands, and could be batched if the review loop proves them low-risk.
